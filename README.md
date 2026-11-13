<div align="center">

<!-- CAPSULE RENDER HEADER -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:7928CA,100:FF0080&height=240&section=header&text=CodeFlow%20IDE%20%E2%9A%A1&fontSize=70&fontColor=ffffff&animation=fadeIn&fontAlignY=36&desc=Cloud-Native%20Collaborative%20Workspace%20%E2%80%A2%20Docker%20Sandbox%20%E2%80%A2%20Gemini%20AI&descAlignY=58&descSize=18&descColor=dddddd"/>

<!-- ANIMATED TYPING SVG -->
<a href="https://git.io/typing-svg">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=22&duration=3000&pause=800&color=7928CA&center=true&vCenter=true&width=750&height=60&lines=Welcome+to+CodeFlow!+%F0%9F%99%8C;Real-time+Multiplayer+Collaborative+IDE+%F0%9F%91%AC;Sandboxed+Docker+Code+Execution+%F0%9F%94%92;AI-Powered+Code+Review+via+Gemini+%F0%9F%A4%96;PM2+Cluster+%2B+NGINX+Load+Balancing+%E2%9A%96%EF%B8%8F" alt="Typing SVG" />
</a>

<br/>

<!-- BADGES -->
<a href="https://codeflow-sand.vercel.app/"><img src="https://img.shields.io/badge/Live_Demo-Vercel-black?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo"></a>
<a href="https://react.dev/"><img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"></a>
<a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js_20-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"></a>
<a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"></a>
<a href="https://redis.io/"><img src="https://img.shields.io/badge/Redis_Queue-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis"></a>
<a href="https://socket.io/"><img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io"></a>
<a href="https://deepmind.google/technologies/gemini/"><img src="https://img.shields.io/badge/Google_Gemini_AI-8E75B2?style=for-the-badge&logo=google&logoColor=white" alt="Gemini AI"></a>

</div>

---

## <img src="https://media.giphy.com/media/iY8CRBdQXODJSCERIr/giphy.gif" width="32"> About CodeFlow

<img align="right" alt="CodeFlow Development" width="380" src="./Development.svg" />

```yaml
Project Name   : CodeFlow 🛠️⚡
Type           : Enterprise Cloud-Native Collaborative IDE
Frontend       : React 19, Monaco Editor, Tailwind CSS v4
Backend        : Node.js 20, Express, Socket.io, Mongoose
Sandboxing     : Ephemeral Isolated Docker Containers
Queue System   : Redis + BullMQ Asynchronous Task Queue
AI Engine      : Google Gemini 2.5 Flash API
Load Balancer  : NGINX Reverse Proxy (Sticky Sessions) + PM2 Cluster
Deployment     : Vercel (Frontend) + Render / Ubuntu VPS (Backend)
```

**CodeFlow** is a production-grade, cloud-native collaborative development workspace and online IDE engineered for high availability and low-latency interaction. 

It combines a **VS Code-grade in-browser editor** with isolated multi-language execution sandboxes, real-time multiplayer pair programming, an asynchronous distributed job queue, and automated AI-driven code reviews.

---

## 🏛️ System Architecture

```mermaid
flowchart LR
    Client["Client (Browser / Monaco IDE)"] -->|"POST /api/run"| API["API (Express.js)"]
    API -->|"Enqueue Job"| Queue["BullMQ / Redis"]
    Queue -->|"Process Job"| Worker["Worker (BullMQ Worker)"]
    Worker -->|"Execute"| Sandbox["Docker Sandbox (or External Provider)"]
    Client -.->|"Poll Status / WebSocket"| API
```

---

## 📊 Benchmarks & Performance

### Execution Pipeline Benchmark

| Architecture / Path | Language | Workload & Concurrency | Test Runs | Throughput | Enqueue Latency | End-to-End Latency | Reliability & Errors |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **Direct (synchronous) path** | Python | 50 users, 60s | 1 run | 4.85 jobs/s | N/A (blocking) | p95 9.75s | 39 execution timeouts |
| **Queued path** | Python | 50 users, 60s, worker concurrency 8 | 2 runs | 4.95 jobs/s avg | p95 ~132ms | e2e p95 ~14.9s | 0 timeouts, 0 errors |
| **Queued path** | JavaScript | 25 users, 60s, concurrency 8 and 12 | 4 runs total | 6.1-7.0 jobs/s | p50 ~25-35ms | e2e p95 4.3-7.3s | 0 errors across 1,537 jobs |

**Methodology:** single laptop (12-core i5-12500H, 16GB, Windows 11 + Docker Desktop/WSL2), k6 running on the same machine, 2 runs per config.

---

## ⚠️ Limitations

* DSA submit endpoint still runs test cases synchronously outside the queue;
* Under heavy load latency grows instead of requests failing;
* Live demo uses an external execution API because Render has no Docker daemon, while benchmarks ran on local Docker.

---

## 🚀 Powerful & Scalable Features

### 🔒 1. Secure Containerized Execution Sandbox
* **Multi-Language Runtimes:** Instant code execution for **Python 3**, **JavaScript (Node.js)**, **C++ (GCC)**, and **Java**.
* **Strict Docker Security Constraints:**
  * Network isolation (`--network none`)
  * Hard RAM caps (`-m 256m`) and CPU quota limits
  * Execution timeout enforcement to prevent infinite loops and resource exhaustion attacks.

### 👥 2. Real-Time Multiplayer Collaboration
* **Synchronized Editor Buffers:** Sub-10ms WebSocket room synchronization powered by **Socket.io**.
* **Workspace Forking & Sharing:** Instantly fork any public or team workspace into an independent workspace with 1 click.
* **Sticky Session Load Balancing:** Configured with NGINX `ip_hash` so WebSocket connections maintain sticky sessions across worker processes.

### ⚡ 3. Asynchronous Queue Architecture
* **Non-Blocking Infrastructure:** Heavy code execution workloads are dispatched to a **BullMQ** queue backed by **Redis**, ensuring API worker threads stay fast and responsive.
* **PM2 Cluster Scaling:** Automatically scales Node.js Express across all available CPU cores using PM2 (`instances: "max"`).

### 🤖 4. AI-Powered Code Intelligence
* **Google Gemini 2.5 Flash Engine:** Integrated AI code companion providing:
  * **Automated Code Reviews:** Instant feedback on logic bugs, syntax errors, and edge cases.
  * **Big-O Complexity Analysis:** Real-time Time & Space complexity calculation.
  * **Refactoring Suggestions:** Production-ready code improvements with detailed explanations.

### 📚 5. DSA & Competitive Programming Engine
* **Love Babbar 450 Integration:** Pre-loaded with curated Data Structures & Algorithms sheets categorized by topic and difficulty.
* **LeetCode-Style Submissions:** Automated test case validation with custom input support.
* **Telemetry & Analytics:** Tracks submission history, streak statistics, and completion metrics.

---

## 🛠️ Complete Tech Stack Grid

| Layer | Technologies & Badges |
| :--- | :--- |
| **Frontend UI** | ![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) ![Lucide](https://img.shields.io/badge/Lucide_Icons-F05032?style=flat-square) |
| **Editor Core** | ![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white) *(VS Code Core Engine)* |
| **Backend API** | ![Node.js](https://img.shields.io/badge/Node.js_20-339933?style=flat-square&logo=nodedotjs&logoColor=white) ![Express](https://img.shields.io/badge/Express.js-000000?style=flat-square&logo=express&logoColor=white) |
| **WebSockets** | ![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat-square&logo=socketdotio&logoColor=white) *(Live Editor Room Sync)* |
| **Database & Storage** | ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white) ![Mongoose](https://img.shields.io/badge/Mongoose-880000?style=flat-square&logo=mongoose&logoColor=white) |
| **Queue & Cache** | ![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white) ![BullMQ](https://img.shields.io/badge/BullMQ-FF4500?style=flat-square) |
| **Execution Sandbox** | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) *(Isolated OCI Containers)* |
| **AI Intelligence** | ![Google Gemini](https://img.shields.io/badge/Google_Gemini_AI-8E75B2?style=flat-square&logo=google&logoColor=white) |
| **Load Balancers** | ![NGINX](https://img.shields.io/badge/NGINX-009639?style=flat-square&logo=nginx&logoColor=white) ![PM2](https://img.shields.io/badge/PM2_Cluster-2B037A?style=flat-square&logo=pm2&logoColor=white) |

---

## 📁 Repository Structure

```text
CodeWorkspace/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, Redis & AI Configurations
│   │   ├── middleware/      # Auth (JWT) & Schema Validation
│   │   ├── models/          # MongoDB Models (User, Workspace, Problem)
│   │   ├── routes/          # Express Routes (Auth, Workspaces, AI, Problems)
│   │   ├── services/        # Execution Worker, Docker Runner, BullMQ Queue
│   │   └── index.js         # Main Server Entry Point
│   ├── docker/              # Multi-Language Docker Base Files
│   └── ecosystem.config.js  # PM2 Cluster Load Balancer Config
├── frontend/
│   ├── src/
│   │   ├── assets/          # Static Assets & Graphics
│   │   ├── components/      # UI Components & Landing Sections
│   │   ├── config/          # Central API & Environment Resolution (api.js)
│   │   ├── context/         # AuthContext & State Management
│   │   ├── data/            # Pre-loaded Problem Sheets (Love Babbar 450)
│   │   ├── pages/           # Dashboard, Workspace IDE, Login, Signup
│   │   └── App.jsx          # React Router Setup
│   └── vite.config.js       # Vite Bundler & Plugin Configuration
├── deploy.sh                # 1-Click Production Ubuntu VPS Deploy Script
├── nginx.conf               # NGINX Load Balancer & WebSocket Reverse Proxy Config
└── vercel.json              # Vercel Single-Page Application (SPA) Rewrites
```

---

## 📦 Quickstart & Local Setup Guide

### 📋 Prerequisites
* **Node.js:** v20.x or higher
* **Docker Desktop:** Installed and active
* **Redis Server:** Running locally or via Docker container
* **MongoDB Instance:** Local MongoDB or MongoDB Atlas URI

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/arpitambulkar27/codeflow.git
cd codeflow
```

### 2️⃣ Configure Backend Environment (`backend/.env`)
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/codeflow
JWT_SECRET=your_super_secret_jwt_key
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=your_google_gemini_api_key
NODE_ENV=development
```

### 3️⃣ Configure Frontend Environment (`frontend/.env`)
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

### 5️⃣ Run locally
```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to launch **CodeFlow**!

---

## 🌐 Production Deployment Guide

### Option 1: Managed Cloud Deployment (Vercel + Render)
* **Frontend:** Deployed on **Vercel** with automatic SPA routing. Set `VITE_API_BASE_URL` in Vercel settings pointing to Render.
* **Backend:** Deployed on **Render** linked to MongoDB Atlas and Redis Cloud.

### Option 2: Self-Hosted VPS Deployment (1-Click Script)
To deploy on AWS EC2, DigitalOcean, or Ubuntu VPS:
```bash
chmod +x deploy.sh
./deploy.sh
```
The script handles Node.js 20, Docker, Redis, NGINX reverse proxy, PM2 cluster initialization, and static build serving.

---

## 📡 REST API Reference

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :---: |
| **POST** | `/api/auth/register` | Register a new user | ❌ |
| **POST** | `/api/auth/login` | Authenticate user & issue JWT | ❌ |
| **GET** | `/api/auth/me` | Fetch logged-in user profile | 🔒 |
| **GET** | `/api/workspaces` | Fetch all user workspaces | 🔒 |
| **POST** | `/api/workspaces` | Create new workspace | 🔒 |
| **POST** | `/api/workspaces/:id/fork`| Fork existing workspace | 🔒 |
| **POST** | `/api/run` | Execute code in Docker container queue | 🔒 |
| **POST** | `/api/ai/review` | Generate AI Code Review & Complexity | 🔒 |

---

<div align="center">

### 🤝 Connect & Support

Made with ❤️ by [Arpit Ambulkar](https://github.com/arpitambulkar27)

Distributed under the **MIT License**.

</div>
