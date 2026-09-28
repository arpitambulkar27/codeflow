// backend/src/routes/auth.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const OTP = require("../models/OTP");
const { protect } = require("../middleware/authMiddleware");
const { authRateLimiter } = require("../middleware/rateLimiter");
const { validateBody, authSchemas } = require("../middleware/schemaValidation");
const { validateEmail } = require("../utils/verifyEmailDomain");
const { sendOTP } = require("../utils/mailer");

// RFC 5322 Compliant Email Regex Validator
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// In-memory rate limiting map for OTP requests (email -> timestamps array)
const otpRateLimitMap = new Map();

// Periodic cleanup to prevent memory leak (runs every 10 minutes)
setInterval(() => {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  for (const [email, timestamps] of otpRateLimitMap.entries()) {
    const valid = timestamps.filter((ts) => now - ts < windowMs);
    if (valid.length === 0) {
      otpRateLimitMap.delete(email);
    } else {
      otpRateLimitMap.set(email, valid);
    }
  }
}, 10 * 60 * 1000);

/**
 * Enforces rate limit: max 3 requests per email per 10 minutes.
 * @param {string} email
 * @returns {boolean} true if allowed, false if limit exceeded
 */
const checkOtpRateLimit = (email) => {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxRequests = 3;

  const timestamps = otpRateLimitMap.get(email) || [];
  const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);

  if (validTimestamps.length >= maxRequests) {
    return false;
  }

  validTimestamps.push(now);
  otpRateLimitMap.set(email, validTimestamps);
  return true;
};

// Helper function to generate JWT
const generateToken = (id) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("FATAL CONFIG ERROR: JWT_SECRET environment variable is missing.");
  }
  return jwt.sign({ id }, secret, {
    expiresIn: "7d",
  });
};

// @route   POST /api/auth/send-otp
// @desc    Generate and send 6-digit OTP to user's email
router.post("/send-otp", authRateLimiter, validateBody(authSchemas.sendOtp), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email address is required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    // Rate limit check: max 3 requests per email per 10 minutes
    if (!checkOtpRateLimit(cleanEmail)) {
      return res.status(429).json({
        error: "Too many OTP requests. Please wait 10 minutes before requesting a new code.",
      });
    }

    // Generate random 6-digit OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before saving in DB
    const hashedOtp = await bcrypt.hash(rawOtp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Upsert OTP document for email
    await OTP.findOneAndUpdate(
      { email: cleanEmail },
      { otp: hashedOtp, expiresAt, attempts: 0 },
      { upsert: true, new: true }
    );

    // Send OTP email via Nodemailer
    await sendOTP(cleanEmail, rawOtp);

    res.json({ message: "Verification OTP code sent to your email." });
  } catch (error) {
    console.error("Send OTP Error:", error.message);
    res.status(500).json({ error: "Failed to send OTP code. Please try again." });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify 6-digit OTP and activate user account
router.post("/verify-otp", authRateLimiter, validateBody(authSchemas.verifyOtp), async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP code are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const inputOtp = String(otp).trim();

    // Look up OTP document
    const otpDoc = await OTP.findOne({ email: cleanEmail });
    if (!otpDoc || !otpDoc.expiresAt || otpDoc.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired verification OTP code." });
    }

    // Compare bcrypt hash
    const isMatch = await bcrypt.compare(inputOtp, otpDoc.otp);

    if (!isMatch) {
      otpDoc.attempts += 1;
      if (otpDoc.attempts >= 5) {
        await OTP.deleteOne({ _id: otpDoc._id });
      } else {
        await otpDoc.save();
      }
      return res.status(400).json({ error: "Invalid or expired verification OTP code." });
    }

    // On match: mark user as verified
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired verification OTP code." });
    }

    user.isVerified = true;
    await user.save();

    // Delete used OTP document
    await OTP.deleteOne({ _id: otpDoc._id });

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isVerified: true,
      token: generateToken(user._id),
      message: "Email verified successfully!",
    });
  } catch (error) {
    console.error("Verify OTP Error:", error.message);
    res.status(500).json({ error: "OTP verification failed. Please try again." });
  }
});

// @route   POST /api/auth/google
// @desc    Authenticate user via Google OAuth ID Token
router.post("/google", authRateLimiter, validateBody(authSchemas.googleAuth), async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: "Google credential token is required." });
    }

    const rawClientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientId = rawClientId.trim().replace(/^["']|["']$/g, "");

    if (!clientId) {
      console.error("GOOGLE_CLIENT_ID is missing in backend environment variables.");
      return res.status(500).json({
        error: "Server configuration issue: GOOGLE_CLIENT_ID is missing in backend environment.",
      });
    }

    const audiences = clientId
      .split(",")
      .map((id) => id.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);

    const googleClient = new OAuth2Client(audiences[0]);

    // Verify ID token with Google
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: audiences.length === 1 ? audiences[0] : audiences,
      });
    } catch (verifyError) {
      console.error("Google ID Token Verification Error:", verifyError.message || verifyError);
      const msg = verifyError.message || "";
      if (msg.includes("recipient") || msg.includes("audience")) {
        return res.status(401).json({
          error: "Google sign-in failed: Client ID mismatch between frontend (Vercel) and backend (Render). Ensure VITE_GOOGLE_CLIENT_ID on Vercel matches GOOGLE_CLIENT_ID on Render.",
        });
      }
      return res.status(401).json({
        error: `Google sign-in failed: ${msg || "Token validation error."}`,
      });
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: "Invalid Google token payload." });
    }

    const { email, name, picture } = payload;
    const cleanEmail = email.trim().toLowerCase();

    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      const baseUsername = (name || cleanEmail.split("@")[0]).trim();
      let finalUsername = baseUsername;
      const existingUserWithUsername = await User.findOne({ username: finalUsername });
      if (existingUserWithUsername) {
        finalUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      user = await User.create({
        username: finalUsername,
        email: cleanEmail,
        avatar: picture || "https://api.dicebear.com/7.x/bottts/svg?seed=CodeFlow",
        authProvider: "google",
        isVerified: true,
      });
    } else {
      if (!user.isVerified) {
        user.isVerified = true;
        await user.save();
      }
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isVerified: true,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Google Auth Handler Error:", error.message || error);
    res.status(500).json({ error: error.message || "Google authentication failed." });
  }
});

// @route   POST /api/auth/github
// @desc    Authenticate user via GitHub OAuth Code
router.post("/github", authRateLimiter, validateBody(authSchemas.githubAuth), async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "GitHub authorization code is required." });
    }

    const clientId = (process.env.GITHUB_CLIENT_ID || "").trim();
    const clientSecret = (process.env.GITHUB_CLIENT_SECRET || "").trim();

    if (!clientId || !clientSecret) {
      console.error("GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing in backend environment.");
      return res.status(500).json({
        error: "Server configuration issue: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing.",
      });
    }

    // Exchange authorization code for GitHub access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) {
      console.error("GitHub Access Token Exchange Failed:", tokenResponse.data);
      return res.status(401).json({
        error: tokenResponse.data?.error_description || "Failed to exchange GitHub authorization code.",
      });
    }

    // Fetch user profile details from GitHub API
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "CodeFlow-App",
      },
    });

    const githubUser = userResponse.data;
    if (!githubUser || !githubUser.id) {
      return res.status(400).json({ error: "Failed to fetch GitHub user profile." });
    }

    let userEmail = githubUser.email;

    if (!userEmail) {
      try {
        const emailsResponse = await axios.get("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "CodeFlow-App",
          },
        });

        const emails = emailsResponse.data || [];
        const primaryEmailObj = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0];
        if (primaryEmailObj && primaryEmailObj.email) {
          userEmail = primaryEmailObj.email;
        }
      } catch (emailErr) {
        console.warn("Could not fetch GitHub private emails:", emailErr.message);
      }
    }

    if (!userEmail) {
      userEmail = `${githubUser.login || `github_${githubUser.id}`}@users.noreply.github.com`;
    }

    const cleanEmail = userEmail.trim().toLowerCase();

    let user = await User.findOne({
      $or: [{ email: cleanEmail }, { githubId: String(githubUser.id) }],
    });

    if (!user) {
      const baseUsername = (githubUser.login || githubUser.name || cleanEmail.split("@")[0]).trim();
      let finalUsername = baseUsername;
      const existingUserWithUsername = await User.findOne({ username: finalUsername });
      if (existingUserWithUsername) {
        finalUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      user = await User.create({
        username: finalUsername,
        email: cleanEmail,
        avatar: githubUser.avatar_url || "https://api.dicebear.com/7.x/bottts/svg?seed=CodeFlow",
        authProvider: "github",
        githubId: String(githubUser.id),
        isVerified: true,
      });
    } else {
      let shouldSave = false;
      if (!user.githubId) {
        user.githubId = String(githubUser.id);
        shouldSave = true;
      }
      if (!user.isVerified) {
        user.isVerified = true;
        shouldSave = true;
      }
      if (shouldSave) await user.save();
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isVerified: true,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("GitHub Auth Route Error:", error.response?.data || error.message || error);
    res.status(500).json({
      error: error.response?.data?.error_description || error.message || "GitHub authentication failed.",
    });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new user (isVerified: false), sends OTP
router.post("/register", authRateLimiter, validateBody(authSchemas.register), async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Please fill in all required fields." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Verify format, disposable domains blocklist, and active DNS MX records
    const domainVerification = await validateEmail(cleanEmail);
    if (!domainVerification.isValid) {
      return res.status(400).json({ error: domainVerification.error });
    }

    let user = await User.findOne({ email: cleanEmail });

    if (user) {
      if (user.isVerified) {
        return res.status(400).json({ error: "An account already exists with this email address." });
      } else {
        // User exists but unverified: update username & password
        user.username = username.trim();
        user.password = password;
        await user.save();
      }
    } else {
      user = await User.create({
        username: username.trim(),
        email: cleanEmail,
        password,
        authProvider: "local",
        isVerified: false,
      });
    }

    // Generate & send 6-digit OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(rawOtp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OTP.findOneAndUpdate(
      { email: cleanEmail },
      { otp: hashedOtp, expiresAt, attempts: 0 },
      { upsert: true, new: true }
    );

    await sendOTP(cleanEmail, rawOtp);

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      isVerified: false,
      requiresOtp: true,
      message: "Registration successful. Please enter the 6-digit OTP sent to your email.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Registration failed." });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token with verification check
router.post("/login", authRateLimiter, validateBody(authSchemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        error: "Please enter a valid email address.",
      });
    }

    const user = await User.findOne({ email: cleanEmail });

    if (user && (await user.matchPassword(password))) {
      // Block login if account is unverified
      if (!user.isVerified && user.authProvider === "local") {
        // Auto-send OTP if rate limit allows
        try {
          if (checkOtpRateLimit(cleanEmail)) {
            const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
            const hashedOtp = await bcrypt.hash(rawOtp, 10);
            await OTP.findOneAndUpdate(
              { email: cleanEmail },
              { otp: hashedOtp, expiresAt: new Date(Date.now() + 5 * 60 * 1000), attempts: 0 },
              { upsert: true, new: true }
            );
            await sendOTP(cleanEmail, rawOtp);
          }
        } catch (otpErr) {
          console.warn("Auto resend OTP error:", otpErr.message);
        }

        return res.status(401).json({
          error: "Please verify your email address before logging in.",
          isUnverified: true,
          email: cleanEmail,
        });
      }

      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isVerified: true,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ error: "Invalid email address or password." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message || "Authentication failed." });
  }
});

// @route   POST /api/auth/social
// @desc    Disabled endpoint: OAuth sign-ins must be verified via /api/auth/google or /api/auth/github
router.post("/social", async (req, res) => {
  return res.status(410).json({
    error: "This endpoint is disabled for security reasons. Please use Google or GitHub OAuth buttons.",
  });
});

// @route   GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  res.json(req.user);
});

// @route   PUT /api/auth/profile
// @desc    Update user profile username or email with validation
router.put("/profile", protect, validateBody(authSchemas.updateProfile), async (req, res) => {
  try {
    const { username, email } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }
      user.email = cleanEmail;
    }

    if (username) user.username = username.trim();

    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      isVerified: updatedUser.isVerified,
      token: generateToken(updatedUser._id),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update profile." });
  }
});

module.exports = router;
