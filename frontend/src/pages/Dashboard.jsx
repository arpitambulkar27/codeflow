import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Code2, Plus, Search, Folder, Users, Bot, 
  Clock, Cpu, ShieldCheck, ChevronRight, Zap, Trash2, GitFork,
  Loader2, LogOut, X, Play, BookOpen, Coffee, Terminal,
  Activity, Flame, Target, Sparkles, ArrowRight, ExternalLink,
  Layers, CheckCircle, HelpCircle, User, Edit3, Mail, Check, AlertCircle,
  Radio, RefreshCw, Database, Server
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import LandingPage from "./LandingPage";

import { API_BASE_URL } from "../config/api";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");

  // Modals State
  const [isNewWorkspaceModalOpen, setIsNewWorkspaceModalOpen] = useState(false);
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // New Workspace State
  const [newTitle, setNewTitle] = useState("");
  const [newLang, setNewLang] = useState("python");
  const [creating, setCreating] = useState(false);

  // Edit Profile State
  const { user, logout } = useAuth() || {};
  const [editUsername, setEditUsername] = useState(user?.username || "");
  const [editEmail, setEditEmail] = useState(user?.email || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Workspaces State
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  // Live Telemetry State
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryLoading, setTelemetryLoading] = useState(true);
  const [telemetryLastUpdated, setTelemetryLastUpdated] = useState(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (user) {
      setEditUsername(user.username || "");
      setEditEmail(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    fetchWorkspaces();
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTelemetry = async () => {
    try {
      setTelemetryLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/telemetry`);
      setTelemetry(res.data);
      setTelemetryLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn("Failed to fetch telemetry metrics:", err.message);
    } finally {
      setTelemetryLoading(false);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      if (!token) {
        setWorkspaces([]);
        return;
      }
      const res = await axios.get(`${API_BASE_URL}/api/workspaces`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWorkspaces(res.data || []);
    } catch (err) {
      console.error("Failed to load workspaces:", err);
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e, titleOverride = null, langOverride = null) => {
    if (e) e.preventDefault();
    const titleToUse = titleOverride || newTitle.trim();
    const langToUse = langOverride || newLang;

    if (!titleToUse) return;
    try {
      setCreating(true);
      const activeToken = localStorage.getItem("token");
      if (activeToken) {
        const res = await axios.post(
          `${API_BASE_URL}/api/workspaces`,
          { title: titleToUse, language: langToUse },
          { headers: { Authorization: `Bearer ${activeToken}` } }
        );
        setIsNewWorkspaceModalOpen(false);
        setNewTitle("");
        if (res.data && res.data._id) {
          navigate(`/workspace/${res.data._id}`);
          return;
        }
      }
      setIsNewWorkspaceModalOpen(false);
      setNewTitle("");
      navigate(`/workspace?title=${encodeURIComponent(titleToUse)}&lang=${encodeURIComponent(langToUse)}`);
    } catch (err) {
      console.error("Error creating workspace:", err);
      setIsNewWorkspaceModalOpen(false);
      setNewTitle("");
      navigate(`/workspace?title=${encodeURIComponent(titleToUse)}&lang=${encodeURIComponent(langToUse)}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteWorkspace = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this workspace?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/workspaces/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWorkspaces((prev) => prev.filter((w) => w._id !== id));
    } catch (err) {
      console.error("Error deleting workspace:", err);
    }
  };

  const handleForkWorkspace = async (e, id) => {
    e.stopPropagation();
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/workspaces/${id}/fork`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorkspaces((prev) => [res.data, ...prev]);
      navigate(`/workspace/${res.data._id}`);
    } catch (err) {
      console.error("Error forking workspace:", err);
    }
  };

  // Collaboration Options
  const handleCreateRoom = () => {
    setIsCollabModalOpen(false);
    const randomRoomId = `CF-${Math.floor(1000 + Math.random() * 9000)}`;
    navigate(`/workspace?room=${randomRoomId}&mode=host`);
  };

  const handleJoinRoom = () => {
    if (roomCodeInput.trim()) {
      setIsCollabModalOpen(false);
      navigate(`/workspace?room=${encodeURIComponent(roomCodeInput.trim())}`);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      setProfileMsg("");
      const res = await axios.put(
        `${API_BASE_URL}/api/auth/profile`,
        { username: editUsername, email: editEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data) {
        localStorage.setItem("user", JSON.stringify(res.data));
        setProfileMsg("Profile updated successfully!");
        setTimeout(() => {
          setProfileMsg("");
          setIsProfileModalOpen(false);
        }, 1200);
      }
    } catch (err) {
      setProfileMsg(err.response?.data?.error || "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = () => {
    if (logout) logout();
    else localStorage.clear();
    navigate("/");
  };

  const getLanguageLabel = (lang) => {
    switch (lang?.toLowerCase()) {
      case "python": return "Python 3";
      case "javascript": return "JavaScript";
      case "java": return "Java 21";
      case "cpp": return "C++ 20";
      default: return lang || "Code";
    }
  };

  // Live Real-Time Search Filter
  const filteredWorkspaces = workspaces.filter(
    (w) =>
      (w.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.language || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-foreground">
      {/* BACKGROUND LAYER: Blurred reflection of the Landing Page */}
      <div 
        aria-hidden="true" 
        className="fixed inset-0 pointer-events-none select-none overflow-hidden z-0 filter blur-[10px] brightness-75 scale-105 transform-gpu opacity-75"
      >
        <LandingPage />
      </div>

      {/* OVERLAY: Dark glassmorphic backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-0 pointer-events-none" />

      {/* FOREGROUND DASHBOARD ROOT */}
      <div className="cd-root">
        <style>{`
          .cd-root {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            width: 100vw;
            background-color: transparent;
            color: #ffffff;
            font-family: inherit;
            overflow-x: hidden;
            position: relative;
            z-index: 10;
          }

          .cd-scrollable {
            overflow-y: auto;
          }
          .cd-scrollable::-webkit-scrollbar {
            width: 6px;
          }
          .cd-scrollable::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
          }

          /* Smooth Page Fade-In Transition */
          @keyframes pageFadeIn {
            0% {
              opacity: 0;
              transform: translateY(8px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .cd-page-fade {
            animation: pageFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          /* Smooth Card Pop Animations */
          @keyframes smoothPop {
            0% {
              opacity: 0;
              transform: scale(0.97) translateY(6px);
            }
            100% {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
          .cd-animate-pop {
            animation: smoothPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          .cd-topbar {
            height: 64px;
            background-color: rgba(10, 10, 15, 0.55);
            backdrop-filter: blur(20px) saturate(180%);
            border-bottom: 1px solid rgba(255, 255, 255, 0.12);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 28px;
            position: sticky;
            top: 0;
            z-index: 40;
            flex-shrink: 0;
          }

          /* HIGH-CONTRAST MONOCHROMATIC BUTTONS MATCHING LANDING PAGE */
          .cd-btn-bw {
            background-color: #ffffff;
            color: #000000;
            border: none;
            border-radius: 9999px;
            padding: 8px 20px;
            font-family: monospace;
            font-size: 12px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
          }
          .cd-btn-bw:hover {
            transform: translateY(-1px);
            background-color: rgba(255, 255, 255, 0.9);
            box-shadow: 0 0 25px rgba(255, 255, 255, 0.35);
          }

          .cd-btn-outline {
            background-color: rgba(255, 255, 255, 0.08);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 9999px;
            padding: 8px 18px;
            font-family: monospace;
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .cd-btn-outline:hover {
            background-color: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.35);
          }

          /* Hero Cards Translucent Glass Style */
          .cd-hero-card {
            background: rgba(10, 10, 15, 0.55);
            backdrop-filter: blur(24px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 20px;
            padding: 24px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          }
          .cd-hero-card:hover {
            border-color: rgba(236, 168, 214, 0.6);
            background: rgba(18, 18, 26, 0.65);
            transform: translateY(-2px);
          }

          .cd-list-item {
            background-color: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 14px;
            padding: 18px 22px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: all 0.2s ease;
          }
          .cd-list-item:hover {
            border-color: rgba(255, 255, 255, 0.3);
            background-color: rgba(255, 255, 255, 0.08);
          }

          .cd-card {
            background: rgba(10, 10, 15, 0.55);
            backdrop-filter: blur(24px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          }
        `}</style>

        {/* 1. TOPBAR */}
        <header className="cd-topbar">
          <div 
            onClick={() => navigate("/")} 
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
          >
            <span className="font-display tracking-tight text-xl text-white">CODEFLOW</span>
            <span className="font-mono text-[10px] text-[#eca8d6] mt-0.5">IDE</span>
          </div>

          {/* Live Working Search Input */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "9999px", padding: "8px 16px", width: "360px" }}>
            <Search size={15} color="#8b949e" />
            <input 
              type="text" 
              placeholder="Search workspaces by title or language..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: "transparent", border: "none", outline: "none", color: "#ffffff", fontSize: "13px", width: "100%" }}
            />
          </div>

          {/* Topbar Action Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button className="cd-btn-bw" onClick={() => setIsNewWorkspaceModalOpen(true)}>
              <Plus size={14} /> New Workspace
            </button>

            <div 
              onClick={() => setIsProfileModalOpen(true)}
              style={{ width: "34px", height: "34px", borderRadius: "50%", background: "rgba(236, 168, 214, 0.15)", border: "1px solid rgba(236, 168, 214, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#eca8d6", fontWeight: "bold", cursor: "pointer" }}
              title="View / Edit Profile"
            >
              {user?.username ? user.username.charAt(0).toUpperCase() : "U"}
            </div>

            <button 
              onClick={handleLogout}
              style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", borderRadius: "9999px", padding: "7px 14px", fontSize: "12px", fontFamily: "monospace", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
              title="Log Out"
            >
              <LogOut size={14} color="#f87171" />
            </button>
          </div>
        </header>

        {/* 2. MAIN DASHBOARD CONTENT AREA WITH SMOOTH FADE-IN */}
        <main className="cd-scrollable cd-page-fade" style={{ flex: 1, padding: "32px 28px", zIndex: 10 }}>
          <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
            
            {/* PAGE TITLE */}
            <div style={{ marginBottom: "28px" }}>
              <h1 className="font-display tracking-tight text-3xl md:text-4xl text-white mb-2">
                My Workspace Dashboard
              </h1>
              <p style={{ margin: 0, fontSize: "14px", color: "#8b949e" }}>
                Welcome back, <strong style={{ color: "#ffffff" }}>{user?.username || "Developer"}</strong>! Manage cloud sandboxes, multi-language files, and pair programming rooms.
              </p>
            </div>

            {/* HERO CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "32px" }}>
              
              {/* Card 1: My Workspace */}
              <div className="cd-hero-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">ACTIVE WORKSPACES</span>
                  <Folder size={20} color="#eca8d6" />
                </div>
                <div className="font-display text-4xl text-white">
                  {workspaces.length}
                </div>
                <div style={{ fontSize: "12px", color: "#8b949e", marginTop: "8px" }} className="font-mono">
                  Cloud code sandboxes in Docker runner &rarr;
                </div>
              </div>

              {/* Card 2: Live Collaboration */}
              <div className="cd-hero-card" onClick={() => setIsCollabModalOpen(true)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">LIVE COLLABORATION</span>
                  <Users size={20} color="#eca8d6" />
                </div>
                <div className="font-display text-2xl text-white">
                  Room Options
                </div>
                <div style={{ fontSize: "12px", color: "#8b949e", marginTop: "14px" }} className="font-mono">
                  Create or join room &rarr;
                </div>
              </div>

              {/* Card 3: DSA Practice Sheets */}
              <div className="cd-hero-card" onClick={() => navigate("/sheets")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">DSA PRACTICE SHEETS</span>
                  <Target size={20} color="#eca8d6" />
                </div>
                <div className="font-display text-2xl text-white">
                  Curated DSA Sheets
                </div>
                <div style={{ fontSize: "12px", color: "#8b949e", marginTop: "14px" }} className="font-mono">
                  Browse curated roadmaps & solve &rarr;
                </div>
              </div>

            </div>

            {/* CONTENT SECTION: 2 COLUMNS (WORKSPACES LEFT, COMPACT TELEMETRY SIDE CARD RIGHT) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px", alignItems: "start" }}>
              
              {/* RECENT WORKSPACES LIST GRID (LEFT COLUMN) */}
              <div className="cd-card" style={{ margin: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
                  <h3 className="font-display text-xl text-white">Recent Workspaces</h3>
                  <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#8b949e", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)", padding: "4px 12px", borderRadius: "9999px" }}>
                    {filteredWorkspaces.length} workspace(s)
                  </span>
                </div>

                {loading ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#8b949e", fontSize: "14px" }}>
                    Loading workspaces...
                  </div>
                ) : filteredWorkspaces.length === 0 ? (
                  <div style={{ padding: "40px", border: "1px dashed rgba(255, 255, 255, 0.2)", borderRadius: "16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Folder size={22} color="#8b949e" />
                    </div>
                    <div>
                      <h4 className="font-display text-lg text-white mb-1">No Workspaces Found</h4>
                      <p style={{ margin: 0, fontSize: "13px", color: "#8b949e" }}>
                        {searchQuery ? `No workspace matches "${searchQuery}".` : "Create your first multi-file cloud sandbox with 1-click templates below!"}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", marginTop: "6px" }}>
                      <button 
                        onClick={(e) => handleCreateWorkspace(e, "Python Algorithm Sandbox", "python")} 
                        className="cd-btn-bw"
                      >
                        + Python 3 Sandbox
                      </button>
                      <button 
                        onClick={(e) => handleCreateWorkspace(e, "JavaScript Web App", "javascript")} 
                        className="cd-btn-outline"
                      >
                        + JavaScript Sandbox
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {filteredWorkspaces.map((ws) => {
                      const langLabel = getLanguageLabel(ws.language);
                      const updatedDate = new Date(ws.updatedAt || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                      const filesArray = Array.isArray(ws.files) ? ws.files.filter(f => f.type !== "folder") : [];
                      const fileCount = filesArray.length > 0 ? filesArray.length : 1;

                      return (
                        <div 
                          key={ws._id}
                          className="cd-list-item"
                          onClick={() => navigate(`/workspace/${ws._id}`)}
                          style={{ cursor: "pointer" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(236, 168, 214, 0.15)", border: "1px solid rgba(236, 168, 214, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Folder size={20} color="#eca8d6" />
                            </div>
                            <div>
                              <div style={{ fontSize: "15px", fontWeight: "600", color: "#ffffff", marginBottom: "4px" }}>{ws.title}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                <span style={{ fontSize: "12px", color: "#eca8d6", fontFamily: "monospace", fontWeight: "600" }}>{langLabel}</span>
                                <span style={{ fontSize: "12px", color: "#8b949e" }}>• {fileCount} {fileCount === 1 ? "file" : "files"}</span>
                                <span style={{ fontSize: "12px", color: "#8b949e" }}>• Updated {updatedDate}</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <button 
                              onClick={(e) => handleDeleteWorkspace(e, ws._id)}
                              style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#f87171", borderRadius: "9999px", padding: "6px 10px", fontSize: "11px", cursor: "pointer" }}
                              title="Delete Workspace"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* COMPACT SYSTEM TELEMETRY SIDE CARD (RIGHT COLUMN) */}
              <div className="cd-card" style={{ margin: 0, padding: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Activity size={16} color="#eca8d6" />
                    <span className="font-display text-base text-white">Engine Telemetry</span>
                  </div>
                  <span style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: "700", backgroundColor: "rgba(236, 168, 214, 0.15)", border: "1px solid rgba(236, 168, 214, 0.35)", color: "#eca8d6", padding: "2px 8px", borderRadius: "9999px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#eca8d6" }} className="animate-pulse" /> LIVE
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
                  
                  {/* 1. Database & Persistence */}
                  <div style={{ padding: "12px", backgroundColor: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px" }}>
                    <div style={{ fontSize: "10px", color: "#8b949e", fontFamily: "monospace", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "6px" }}>DATABASE & STORE</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ color: "#8b949e" }}>MongoDB Database:</span>
                      <span style={{ color: telemetry?.database?.mongoDB === "Connected" ? "#eca8d6" : "#f87171", fontWeight: "700" }}>● {telemetry?.database?.mongoDB || "Connected"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#8b949e" }}>Total Workspaces:</span>
                      <span style={{ color: "#ffffff", fontWeight: "600" }}>{telemetry?.database?.totalWorkspaces ?? filteredWorkspaces.length}</span>
                    </div>
                  </div>

                  {/* 2. Redis Cache */}
                  <div style={{ padding: "12px", backgroundColor: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px" }}>
                    <div style={{ fontSize: "10px", color: "#8b949e", fontFamily: "monospace", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "6px" }}>CACHE & QUEUE</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#8b949e" }}>Redis Status:</span>
                      <span style={{ color: telemetry?.database?.redis === "Connected" ? "#eca8d6" : "#8b949e", fontWeight: "700" }}>● {telemetry?.database?.redis || "Offline"}</span>
                    </div>
                  </div>

                  {/* 3. Server Process Runtime */}
                  <div style={{ padding: "12px", backgroundColor: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px" }}>
                    <div style={{ fontSize: "10px", color: "#8b949e", fontFamily: "monospace", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "6px" }}>SERVER METRICS</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ color: "#8b949e" }}>Memory RSS:</span>
                      <span style={{ color: "#ffffff", fontWeight: "600" }}>{telemetry?.system?.memoryUsageMB ? `${telemetry.system.memoryUsageMB} MB` : "Active"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#8b949e" }}>Server Uptime:</span>
                      <span style={{ color: "#eca8d6", fontWeight: "600" }}>{telemetry?.system?.uptimeSeconds ? `${telemetry.system.uptimeSeconds}s` : "Active"}</span>
                    </div>
                  </div>

                </div>

                <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#8b949e", fontFamily: "monospace" }}>
                    {telemetryLastUpdated ? `Updated ${telemetryLastUpdated}` : "Connecting..."}
                  </span>
                  <button 
                    onClick={fetchTelemetry} 
                    style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", padding: "2px 4px" }}
                    title="Refresh Telemetry Metrics"
                  >
                    <RefreshCw size={13} className={telemetryLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

            </div>

          </div>
        </main>

        {/* 1. NEW WORKSPACE CARD MODAL */}
        {isNewWorkspaceModalOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, backgroundColor: "rgba(0, 0, 0, 0.8)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <div className="cd-animate-pop" style={{ width: "100%", maxWidth: "440px", backgroundColor: "rgba(10, 10, 15, 0.75)", backdropFilter: "blur(28px)", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "24px", padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 className="font-display text-xl text-white">Create Cloud Workspace</h3>
                <button onClick={() => setIsNewWorkspaceModalOpen(false)} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer" }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={(e) => handleCreateWorkspace(e)}>
                <div style={{ marginBottom: "16px" }}>
                  <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Workspace Title</label>
                  <input 
                    type="text"
                    placeholder="e.g. Binary Search Tree Sandbox"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-[#eca8d6]"
                    required
                  />
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Default Language</label>
                  <select
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value)}
                    className="w-full bg-black/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#eca8d6]"
                  >
                    <option value="python">Python 3</option>
                    <option value="javascript">JavaScript</option>
                    <option value="java">Java 21</option>
                    <option value="cpp">C++ 20</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button type="button" onClick={() => setIsNewWorkspaceModalOpen(false)} className="cd-btn-outline">Cancel</button>
                  <button type="submit" disabled={creating} className="cd-btn-bw">
                    {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    <span>Create</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2. COLLABORATION ROOM MODAL */}
        {isCollabModalOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, backgroundColor: "rgba(0, 0, 0, 0.8)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <div className="cd-animate-pop" style={{ width: "100%", maxWidth: "460px", backgroundColor: "rgba(10, 10, 15, 0.75)", backdropFilter: "blur(28px)", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "24px", padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 className="font-display text-xl text-white flex items-center gap-2">
                  <Users size={20} className="text-[#eca8d6]" /> Live Pair Programming
                </h3>
                <button onClick={() => setIsCollabModalOpen(false)} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer" }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ padding: "18px", backgroundColor: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "16px" }}>
                  <h4 className="font-display text-base text-white mb-1">Create New Room</h4>
                  <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#8b949e" }}>Generate a random room code and share it with peers for live code syncing.</p>
                  <button onClick={handleCreateRoom} className="cd-btn-bw" style={{ width: "100%", justifyContent: "center" }}>
                    <Plus size={15} /> Create Host Room
                  </button>
                </div>

                <div style={{ padding: "18px", backgroundColor: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "16px" }}>
                  <h4 className="font-display text-base text-white mb-1">Join Existing Room</h4>
                  <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                    <input 
                      type="text" 
                      placeholder="Enter room code (e.g. CF-4829)"
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#eca8d6]"
                    />
                    <button onClick={handleJoinRoom} className="cd-btn-outline">Join</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. EDIT PROFILE MODAL */}
        {isProfileModalOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, backgroundColor: "rgba(0, 0, 0, 0.8)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <div className="cd-animate-pop" style={{ width: "100%", maxWidth: "420px", backgroundColor: "rgba(10, 10, 15, 0.75)", backdropFilter: "blur(28px)", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "24px", padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 className="font-display text-xl text-white flex items-center gap-2">
                  <User size={20} className="text-[#eca8d6]" /> Edit User Profile
                </h3>
                <button onClick={() => setIsProfileModalOpen(false)} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer" }}>
                  <X size={18} />
                </button>
              </div>

              {profileMsg && (
                <div style={{ padding: "12px 14px", borderRadius: "12px", fontSize: "13px", marginBottom: "16px", backgroundColor: profileMsg.includes("successfully") ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", border: profileMsg.includes("successfully") ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)", color: profileMsg.includes("successfully") ? "#34d399" : "#f87171" }}>
                  {profileMsg}
                </div>
              )}

              <form onSubmit={handleUpdateProfile}>
                <div style={{ marginBottom: "16px" }}>
                  <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Username</label>
                  <input 
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#eca8d6]"
                    required
                  />
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Email Address</label>
                  <input 
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#eca8d6]"
                    required
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button type="button" onClick={() => setIsProfileModalOpen(false)} className="cd-btn-outline">Cancel</button>
                  <button type="submit" disabled={profileSaving} className="cd-btn-bw">
                    {profileSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;