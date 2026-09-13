# ⚡ CodeFlow — Cloud-Native Collaborative Developer Workspace & IDE

<p align="center">
  <img src="frontend/src/assets/hero.png" alt="CodeFlow Banner" width="100%" style="border-radius: 10px;" />
</p>

<p align="center">
  <a href="https://codeflow-sand.vercel.app/"><img src="https://img.shields.io/badge/Live_Demo-Vercel-black?style=for-the-badge&logo=vercel" alt="Live Demo"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js_20-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"></a>
  <a href="https://redis.io/"><img src="https://img.shields.io/badge/Redis_Queue-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis"></a>
  <a href="https://socket.io/"><img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io"></a>
  <a href="https://deepmind.google/technologies/gemini/"><img src="https://img.shields.io/badge/Google_Gemini_AI-8E75B2?style=for-the-badge&logo=google&logoColor=white" alt="Gemini AI"></a>
</p>

---

## 🌟 Executive Overview

**CodeFlow** is an enterprise-grade, cloud-native collaborative development workspace and online IDE. Engineered for high availability and low-latency interaction, CodeFlow combines a VS Code-grade in-browser editor with isolated multi-language execution sandboxes, real-time multiplayer pair programming, an asynchronous distributed job queue, and automated AI-driven code reviews.

Whether used for technical interviews, real-time pair programming, remote team collaboration, or mastering Data Structures & Algorithms, CodeFlow delivers an end-to-end scalable developer experience.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        User[Browser Client / Monaco IDE]
    end

    subgraph Infra ["Edge & Load Balancing"]
        NGINX["NGINX Reverse Proxy / Load Balancer\n(ip_hash Sticky Sessions)"]
    end

    subgraph AppCluster ["Backend Application Cluster (PM2)"]
        PM2_1[Express Worker Process 1]
        PM2_2[Express Worker Process 2]
        PM2_N[Express Worker Process N]
    end

    subgraph Services ["Backend Ecosystem & Storage"]
        MongoDB[(MongoDB Database\nUsers & Workspaces)]
        Redis[(Redis Data Store\nBullMQ Queue & Socket.io Adapter)]
        Docker[Docker Execution Sandbox\n(Python, JS, C++, Java Containers)]
        Gemini[Google Gemini 2.5 Flash\nAI Code Review Engine]
    end

    User <-->|HTTPS / WebSockets| NGINX
    NGINX <--> PM2_1 & PM2_2 & PM2_N
    PM2_1 & PM2_2 & PM2_N <--> MongoDB
    PM2_1 & PM2_2 & PM2_N <--> Redis
    PM2_1 & PM2_2 & PM2_N <--> Docker
    PM2_1 & PM2_2 & PM2_N <--> Gemini
```

---

## 🔥 Key Features & Technical Capabilities

### 🔒 1. Secure Containerized Code Execution
* **Multi-Language Support:** Instant execution for **Python 3**, **JavaScript (Node.js)**, **C++ (GCC)**, and **Java**.
* **Isolated Docker Sandboxes:** Code is executed in ephemeral, non-root Docker containers with strict security constraints:
  * Network isolation (`--network none`)
  * Memory limits (`-m 256m`) & CPU quota caps
  * Execution timeout enforcement (prevents infinite loops & resource exhaustion)

### 👥 2. Real-Time Multiplayer Collaboration
* **Synchronized Editor State:** Low-latency WebSocket room communication powered by **Socket.io**.
* **Live Workspace Forking:** Instantly fork any public or team workspace into an independent environment.
* **Sticky Session Load Balancing:** Configured with NGINX `ip_hash` to ensure client WebSocket connections maintain state across worker nodes.

### ⚡ 3. Asynchronous Queue & Distributed Architecture
* **Non-Blocking Execution:** Heavy containerized code runs are queued via **BullMQ** on **Redis**, preventing thread blocking on HTTP workers.
* **PM2 Cluster Mode:** Horizontal scaling across all available CPU cores using PM2 process management (`instances: "max"`).

### 🤖 4. AI-Powered Code Intelligence
* **Google Gemini AI Integration:** Built-in AI assistant offering:
  * **Automated Code Reviews:** Instant feedback on logic, security vulnerabilities, and code style.
  * **Big-O Complexity Analysis:** Estimates Time & Space complexity.
  * **Smart Optimization:** Recommends refactored code snippets with explanations.

### 📚 5. DSA & Competitive Programming Engine
* **Love Babbar 450 Sheet Integration:** Pre-loaded with curated Data Structures & Algorithms problems categorized by topic and difficulty.
* **Interactive Code Runner & Submitter:** Automated test case validation with custom user input support.
* **Telemetry & Progress Tracking:** Tracks completion metrics, active streaks, and telemetry analytics.

### 🛡️ 6. Enterprise Security & Authentication
* **Multi-Factor Auth & OAuth 2.0:** Supports Standard Email/Password, Email OTP Verification, Google One-Tap OAuth, and GitHub OAuth.
* **JWT Token Security:** Stateless, signed JWT authentication with dynamic token validation middleware.

---

## 🛠️ Complete Tech Stack

| Domain | Technologies Used |
| :--- | :--- |
| **Frontend UI** | React 19, Vite, Tailwind CSS v4, Lucide Icons, Framer Motion |
| **Editor Engine** | Monaco Editor (`@monaco-editor/react`) — *VS Code Core* |
| **Backend Runtime** | Node.js 20, Express.js |
| **Real-time WebSockets**| Socket.io, Socket.io-client |
| **Database & ORM** | MongoDB, Mongoose |
| **Caching & Queues** | Redis, BullMQ |
| **Execution Sandboxes**| Docker Engine, Custom OCI Base Runtime Images |
| **AI Infrastructure** | Google Gemini API (`@google/genai`) |
| **Load Balancing & Infra** | NGINX, PM2 Cluster Mode, Docker Compose |
| **Deployment Options** | Vercel (Frontend), Render / VPS (Backend), Automated Bash Deploy Script |

---

## 📁 Repository Structure

```text
CodeWorkspace/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, Redis & AI Configurations
│   │   ├── middleware/      # Auth (JWT) & Body Validation Middleware
│   │   ├── models/          # Mongoose Schemas (User, Workspace, Problem)
│   │   ├── routes/          # Express API Endpoints (Auth, Workspaces, AI, Problems)
│   │   ├── services/        # Execution Worker, Docker Runner, Queue Logic
│   │   └── index.js         # Main Server Entry Point
│   ├── docker/              # Multi-Language Execution Dockerfiles
│   └── ecosystem.config.js  # PM2 Cluster Mode Load Balancer Config
├── frontend/
│   ├── src/
│   │   ├── assets/          # Static Assets & Graphics
│   │   ├── components/      # UI Components & Landing Sections
│   │   ├── config/          # Central API & Environment Resolution
│   │   ├── context/         # AuthContext & Global State Management
│   │   ├── data/            # Pre-loaded Problem Sheets (Love Babbar 450)
│   │   ├── pages/           # Dashboard, Workspace IDE, Login, Signup
│   │   └── App.jsx          # React Router Configuration
│   └── vite.config.js       # Vite Bundler & Plugin Configuration
├── deploy.sh                # 1-Click Production Ubuntu VPS Deployment Script
├── nginx.conf               # NGINX Load Balancer & WebSocket Reverse Proxy Config
└── vercel.json              # Vercel Single-Page Application (SPA) Routing
```

---

## 🚀 Quickstart & Local Setup Guide

### 📋 Prerequisites
* **Node.js:** v20.x or higher
* **Docker Desktop:** Installed and running (for code execution)
* **Redis Server:** Running locally or via Docker
* **MongoDB Instance:** Local MongoDB or MongoDB Atlas URI

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/arpitambulkar27/codeflow.git
cd codeflow
```

### 2️⃣ Configure Backend Environment
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/codeflow
JWT_SECRET=your_super_secret_jwt_key
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=your_google_gemini_api_key
NODE_ENV=development
```

### 3️⃣ Configure Frontend Environment
Create a `.env` file in the `frontend/` directory:
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GITHUB_CLIENT_ID=your_github_client_id
```

### 4️⃣ Start Redis & Docker Sandbox
```bash
# Start Redis Container
docker run -d --name codeflow-redis -p 6379:6379 redis:alpine
```

### 5️⃣ Run the Application Locally
```bash
# Install and start Backend
cd backend
npm install
npm run dev

# In a new terminal, install and start Frontend
cd ../frontend
npm install
npm run dev
```

Visit `http://localhost:5173` in your browser to launch **CodeFlow**.

---

## 🌐 Production Deployment

### Option A: Cloud SaaS (Vercel + Render)
* **Frontend:** Deployed on **Vercel** with automatic SPA routing. Environment variable `VITE_API_BASE_URL` points to the Render backend.
* **Backend:** Deployed on **Render** linked to MongoDB Atlas and Redis Cloud.

### Option B: Self-Hosted Ubuntu VPS (1-Click Automated Script)
For deployment on AWS EC2, DigitalOcean, or Linux VPS, run the included deployment script:
```bash
chmod +x deploy.sh
./deploy.sh
```
The script automatically installs Node.js, Docker, NGINX, PM2, spins up Redis, builds execution containers, compiles frontend static assets, and configures NGINX sticky session load balancing.

---

## 📡 Key REST API Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **POST** | `/api/auth/register` | Register new user account | ❌ |
| **POST** | `/api/auth/login` | Authenticate user & receive JWT | ❌ |
| **GET** | `/api/auth/me` | Fetch current user profile | 🔒 |
| **GET** | `/api/workspaces` | Fetch all user workspaces | 🔒 |
| **POST** | `/api/workspaces` | Create new workspace folder/files | 🔒 |
| **POST** | `/api/workspaces/:id/fork`| Fork existing workspace | 🔒 |
| **POST** | `/api/run` | Execute code in sandboxed Docker queue | 🔒 |
| **POST** | `/api/ai/review` | Generate AI Code Review & Analysis | 🔒 |

---

## 🤝 Contributing & License

Distributed under the **MIT License**. Contributions, bug reports, and feature requests are welcome!

Made with ❤️ by [Arpit Ambulkar](https://github.com/arpitambulkar27).
