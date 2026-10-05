import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Code2, Search, ExternalLink, CheckCircle, Circle, 
  ArrowLeft, BookOpen, LogOut, ChevronRight, ChevronDown, 
  Flame
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import LandingPage from "./LandingPage";

import striverData from "../data/striverA2Z.json";
import babbarData from "../data/loveBabbar450.json";

// Dynamic Animated Cosmic Background Canvas
const DynamicCosmosCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.4 + 0.15,
      color: ["#ffffff", "#e4e4e7", "#a1a1aa", "#71717a"][Math.floor(Math.random() * 4)],
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.06 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.5,
      }}
    />
  );
};

// Safe Problem Filtering Helper
const getFilteredProblems = (problems, searchQuery, difficultyFilter) => {
  if (!Array.isArray(problems)) return [];
  const q = (searchQuery || "").trim().toLowerCase();
  const diff = (difficultyFilter || "All").trim().toLowerCase();

  return problems.filter((prob) => {
    if (!prob) return false;
    const title = (prob.title || "").toLowerCase();
    const probDiff = (prob.difficulty || "").toLowerCase();

    const matchesSearch = q === "" || title.includes(q);
    const matchesDiff = diff === "all" || probDiff === diff;

    return matchesSearch && matchesDiff;
  });
};

export default function DsaSheets() {
  const navigate = useNavigate();
  const { user, logout } = useAuth() || {};

  // Sheet ID persistence (sessionStorage + URL query params)
  const [activeSheetId, setActiveSheetId] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlSheet = urlParams.get("sheet");
      if (urlSheet) return urlSheet;
      return sessionStorage.getItem("codeforge_active_sheet") || "striver-a2z";
    } catch {
      return "striver-a2z";
    }
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("All");

  const currentSheet = activeSheetId === "striver-a2z" ? striverData : babbarData;
  const rawTopics = useMemo(() => currentSheet?.topics || [], [currentSheet]);

  // Local Storage Solved Tracking
  const [solvedMap, setSolvedMap] = useState(() => {
    try {
      const saved = localStorage.getItem("codeforge_solved_problems");
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const map = {};
        parsed.forEach((id) => { map[id] = true; });
        return map;
      }
      return parsed || {};
    } catch {
      return {};
    }
  });

  // Group topics cleanly by Step/Category (delimited by ' → ')
  const groupedData = useMemo(() => {
    const groups = [];
    const groupMap = new Map();

    rawTopics.forEach((topic, idx) => {
      let parentTitle = topic.topicName || `Topic ${idx + 1}`;
      let subTitle = "";
      let hasArrow = false;

      if (topic.topicName && topic.topicName.includes(" → ")) {
        hasArrow = true;
        const parts = topic.topicName.split(" → ");
        parentTitle = parts[0].trim();
        subTitle = parts.slice(1).join(" → ").trim();
      }

      if (!groupMap.has(parentTitle)) {
        const newGroup = {
          groupKey: `group-${groupMap.size}`,
          groupTitle: parentTitle,
          hasSubcategories: hasArrow,
          subcategories: []
        };
        groupMap.set(parentTitle, newGroup);
        groups.push(newGroup);
      }

      const currentGroup = groupMap.get(parentTitle);
      if (hasArrow) {
        currentGroup.hasSubcategories = true;
      }
      currentGroup.subcategories.push({
        topicId: topic.topicId || `sub-${idx}`,
        subTitle: subTitle || topic.topicName,
        problems: topic.problems || []
      });
    });

    return groups;
  }, [rawTopics]);

  // Accordion state persistence per sheet
  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      const initialSheet = new URLSearchParams(window.location.search).get("sheet") || sessionStorage.getItem("codeforge_active_sheet") || "striver-a2z";
      const saved = sessionStorage.getItem(`codeforge_expanded_groups_${initialSheet}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [expandedSubcategories, setExpandedSubcategories] = useState(() => {
    try {
      const initialSheet = new URLSearchParams(window.location.search).get("sheet") || sessionStorage.getItem("codeforge_active_sheet") || "striver-a2z";
      const saved = sessionStorage.getItem(`codeforge_expanded_subcategories_${initialSheet}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Sync activeSheetId to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem("codeforge_active_sheet", activeSheetId);
      const savedG = sessionStorage.getItem(`codeforge_expanded_groups_${activeSheetId}`);
      if (savedG) setExpandedGroups(JSON.parse(savedG));
      const savedS = sessionStorage.getItem(`codeforge_expanded_subcategories_${activeSheetId}`);
      if (savedS) setExpandedSubcategories(JSON.parse(savedS));
    } catch (e) {
      // ignore
    }
  }, [activeSheetId]);

  // Restore scroll position on mount
  useEffect(() => {
    try {
      const savedScroll = sessionStorage.getItem("codeforge_scroll_y");
      if (savedScroll) {
        setTimeout(() => {
          window.scrollTo(0, parseInt(savedScroll, 10));
        }, 120);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Save scroll position on scroll
  useEffect(() => {
    const handleScroll = () => {
      try {
        sessionStorage.setItem("codeforge_scroll_y", String(window.scrollY));
      } catch (e) {}
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isFiltering = searchQuery.trim() !== "" || difficultyFilter.toLowerCase() !== "all";

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => {
      const next = { ...prev, [groupKey]: !prev[groupKey] };
      try {
        sessionStorage.setItem(`codeforge_expanded_groups_${activeSheetId}`, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const toggleSubcategory = (topicId) => {
    setExpandedSubcategories((prev) => {
      const next = { ...prev, [topicId]: !prev[topicId] };
      try {
        sessionStorage.setItem(`codeforge_expanded_subcategories_${activeSheetId}`, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const toggleSolved = (probId, slug) => {
    setSolvedMap((prev) => {
      const isAlreadySolved = !!prev[probId] || (slug && !!prev[slug]);
      const updated = { ...prev };
      if (isAlreadySolved) {
        delete updated[probId];
        if (slug) delete updated[slug];
      } else {
        updated[probId] = true;
        if (slug) updated[slug] = true;
      }
      localStorage.setItem("codeforge_solved_problems", JSON.stringify(updated));
      return updated;
    });
  };

  const handleLogout = () => {
    if (logout) logout();
    else localStorage.clear();
    navigate("/?auth=login");
  };

  // Compute stats
  let allSheetProblems = [];
  rawTopics.forEach((topic) => {
    allSheetProblems = allSheetProblems.concat(topic.problems || []);
  });

  const totalProblemsCount = currentSheet.totalProblems || allSheetProblems.length;
  const solvedProblemsCount = allSheetProblems.filter(
    (p) => p && (solvedMap[p.id] || (p.slug && solvedMap[p.slug]))
  ).length;
  const overallProgressPercent =
    totalProblemsCount > 0 ? Math.round((solvedProblemsCount / totalProblemsCount) * 100) : 0;

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

      {/* FOREGROUND CONTENT LAYER */}
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

          .cd-btn-bw {
            background-color: #ffffff;
            color: #000000;
            border: none;
            border-radius: 9999px;
            padding: 8px 18px;
            font-family: monospace;
            font-size: 12px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.15);
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
            padding: 8px 16px;
            font-family: monospace;
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .cd-btn-outline:hover {
            background-color: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.35);
          }

          .cd-card {
            background: rgba(10, 10, 15, 0.55);
            backdrop-filter: blur(24px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          }

          /* Sheet Accordion Card Style */
          .cd-sheet-accordion {
            background: rgba(10, 10, 15, 0.55);
            backdrop-filter: blur(24px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            overflow: hidden;
            transition: all 0.2s ease;
          }
          .cd-sheet-accordion:hover {
            border-color: rgba(236, 168, 214, 0.5);
          }

        .cd-sheet-header {
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          background-color: #121215;
          user-select: none;
          transition: background-color 0.2s ease;
        }
        .cd-sheet-header:hover {
          background-color: #18181b;
        }

        .cd-list-item {
          background-color: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s ease;
        }
        .cd-list-item:hover {
          border-color: #3f3f46;
          background-color: #141418;
        }
      `}</style>

      {/* 1. TOPBAR */}
      <header className="cd-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button 
            onClick={() => navigate("/dashboard")} 
            className="cd-btn-outline"
            style={{ padding: "6px 12px", fontSize: "12px" }}
          >
            <ArrowLeft size={14} /> Dashboard
          </button>
          <div style={{ height: "18px", width: "1px", backgroundColor: "#27272a" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="cd-logo-btn">
              <Code2 size={18} color="#ffffff" />
            </div>
            <div>
              <span style={{ fontSize: "15px", fontWeight: "800", color: "#ffffff", display: "block" }}>DSA Practice Sheets</span>
              <span style={{ fontSize: "10px", color: "#a1a1aa", display: "block" }}>Curated roadmaps with Solve in IDE & platform redirection</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div 
            style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#18181b", border: "1px solid #3f3f46", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#ffffff", fontWeight: "bold" }}
            title={user?.email || "User Profile"}
          >
            {user?.username ? user.username.charAt(0).toUpperCase() : "U"}
          </div>
          <button 
            onClick={handleLogout}
            style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#f87171", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", cursor: "pointer" }}
            title="Log Out"
          >
            <LogOut size={15} color="#f87171" />
          </button>
        </div>
      </header>

      {/* 2. MAIN CONTENT AREA */}
      <main className="cd-scrollable" style={{ flex: 1, padding: "32px 28px", zIndex: 10 }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* HEADER & SHEET SELECTOR TABS */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: "#ffffff", display: "flex", alignItems: "center", gap: "10px", letterSpacing: "-0.02em" }}>
                Structured DSA Practice Sheets
              </h1>
              <p style={{ margin: "4px 0 0 0", fontSize: "13.5px", color: "#a1a1aa" }}>
                Select a sheet to view topic modules, problem lists, Solve in IDE, and direct platform links.
              </p>
            </div>

            {/* SHEET SELECTOR TABS */}
            <div style={{ display: "flex", gap: "10px", background: "#121215", padding: "4px", borderRadius: "10px", border: "1px solid #27272a" }}>
              <button
                onClick={() => {
                  setActiveSheetId("striver-a2z");
                  setSearchQuery("");
                  setDifficultyFilter("All");
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                  backgroundColor: activeSheetId === "striver-a2z" ? "#ffffff" : "transparent",
                  color: activeSheetId === "striver-a2z" ? "#09090b" : "#a1a1aa",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s ease"
                }}
              >
                <BookOpen size={15} /> A2Z DSA Roadmap
              </button>

              <button
                onClick={() => {
                  setActiveSheetId("love-babbar-450");
                  setSearchQuery("");
                  setDifficultyFilter("All");
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                  backgroundColor: activeSheetId === "love-babbar-450" ? "#ffffff" : "transparent",
                  color: activeSheetId === "love-babbar-450" ? "#09090b" : "#a1a1aa",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s ease"
                }}
              >
                <Flame size={15} /> Top 450 DSA Sheet
              </button>
            </div>
          </div>

          {/* OVERALL SHEET PROGRESS BANNER */}
          <div className="cd-card cd-animate-pop" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fbbf24", marginBottom: "4px" }}>
                  <Flame size={16} />
                  <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sheet Progress</span>
                </div>
                <h2 style={{ margin: 0, fontSize: "19px", fontWeight: "800", color: "#ffffff" }}>
                  {currentSheet?.sheetTitle || "DSA Practice Sheet"}
                </h2>
                <span style={{ fontSize: "12px", color: "#a1a1aa", display: "block", marginTop: "4px" }}>
                  {solvedProblemsCount} of {totalProblemsCount} problems completed ({overallProgressPercent}%)
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#ffffff", background: "#18181b", border: "1px solid #3f3f46", padding: "6px 14px", borderRadius: "8px" }}>
                  {overallProgressPercent}% Completed
                </span>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div style={{ width: "100%", height: "8px", backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${overallProgressPercent}%`, backgroundColor: "#ffffff", borderRadius: "4px", transition: "width 0.3s ease" }} />
            </div>
          </div>

          {/* SEARCH & DIFFICULTY FILTER CONTROLS */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            
            {/* Title Search Input */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#121215", border: "1px solid #27272a", borderRadius: "8px", padding: "8px 14px", width: "340px" }}>
              <Search size={16} color="#71717a" />
              <input 
                type="text" 
                placeholder="Search problem title..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: "transparent", border: "none", outline: "none", color: "#ffffff", fontSize: "13px", width: "100%" }}
              />
            </div>

            {/* Difficulty Filter Pills */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12.5px", color: "#a1a1aa", fontWeight: "600" }}>Filter:</span>
              {["All", "Easy", "Medium", "Hard"].map((diff) => {
                const isActive = difficultyFilter.toLowerCase() === diff.toLowerCase();
                return (
                  <button
                    key={diff}
                    onClick={() => setDifficultyFilter(diff)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                      backgroundColor: isActive ? "#ffffff" : "#121215",
                      color: isActive ? "#09090b" : "#a1a1aa",
                      border: isActive ? "none" : "1px solid #27272a",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {diff.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TOPIC ACCORDION LIST */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {groupedData.map((group) => {
              // Compute filtered subcategories safely
              const filteredSubcategories = group.subcategories.map((sub) => {
                const matching = getFilteredProblems(sub.problems, searchQuery, difficultyFilter);
                return {
                  ...sub,
                  matchingProblems: matching
                };
              }).filter((sub) => !isFiltering || sub.matchingProblems.length > 0);

              const groupHasMatches = filteredSubcategories.some((sub) => sub.matchingProblems.length > 0);
              if (isFiltering && !groupHasMatches) return null;

              const isGroupOpen = isFiltering ? true : !!expandedGroups[group.groupKey];

              // Group totals
              const groupTotalCount = group.subcategories.reduce((acc, s) => acc + (s.problems ? s.problems.length : 0), 0);
              const groupSolvedCount = group.subcategories.reduce(
                (acc, s) => acc + (s.problems || []).filter((p) => p && (solvedMap[p.id] || (p.slug && solvedMap[p.slug]))).length,
                0
              );

              // CASE 1: Single-level Flat Topic Accordion (e.g. Love Babbar: Array, Matrix, String, etc.)
              if (!group.hasSubcategories || group.subcategories.length === 1) {
                const singleSub = filteredSubcategories[0] || group.subcategories[0] || { problems: [], matchingProblems: [] };
                const problemsToDisplay = isFiltering ? (singleSub.matchingProblems || []) : (singleSub.problems || []);

                return (
                  <div key={group.groupKey} className="cd-sheet-accordion cd-animate-pop">
                    {/* Header */}
                    <div 
                      onClick={() => toggleGroup(group.groupKey)}
                      className="cd-sheet-header"
                      style={{ borderBottom: isGroupOpen ? "1px solid #27272a" : "none" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <span style={{ fontSize: "15px", fontWeight: "700", color: "#ffffff" }}>
                          {group.groupTitle}
                        </span>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#a1a1aa" }}>
                          {groupSolvedCount} / {groupTotalCount}
                        </span>
                      </div>

                      <div>
                        {isGroupOpen ? <ChevronDown size={16} color="#a1a1aa" /> : <ChevronRight size={16} color="#a1a1aa" />}
                      </div>
                    </div>

                    {/* Problems Table */}
                    {isGroupOpen && (
                      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px", backgroundColor: "#09090b" }}>
                        {problemsToDisplay.length === 0 ? (
                          <div style={{ padding: "12px", textAlign: "center", color: "#a1a1aa", fontSize: "12.5px" }}>
                            No problems match the filter in this topic.
                          </div>
                        ) : (
                          problemsToDisplay.map((prob) => {
                            if (!prob) return null;
                            const isSolved = !!solvedMap[prob.id] || (prob.slug && !!solvedMap[prob.slug]);
                            const probDiff = (prob.difficulty || "Medium").toLowerCase();

                            return (
                              <div 
                                key={prob.id}
                                className="cd-list-item"
                                style={{ opacity: isSolved ? 0.75 : 1 }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
                                  <button
                                    onClick={() => toggleSolved(prob.id, prob.slug)}
                                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
                                    title={isSolved ? "Mark Unsolved" : "Mark Solved"}
                                  >
                                    {isSolved ? (
                                      <CheckCircle size={18} color="#10b981" />
                                    ) : (
                                      <Circle size={18} color="#52525b" />
                                    )}
                                  </button>

                                  <span 
                                    style={{ 
                                      fontSize: "13.5px", 
                                      fontWeight: "600", 
                                      color: "#ffffff", 
                                      textDecoration: isSolved ? "line-through" : "none",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap"
                                    }}
                                    title={prob.title}
                                  >
                                    {prob.title}
                                  </span>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                                  {/* Difficulty Pill */}
                                  <span style={{ 
                                    fontSize: "10.5px", 
                                    fontWeight: "700", 
                                    textTransform: "uppercase",
                                    width: "62px",
                                    textAlign: "center",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: probDiff === "easy" ? "#34d399" : probDiff === "medium" ? "#fbbf24" : "#f87171", 
                                    background: probDiff === "easy" ? "rgba(16, 185, 129, 0.1)" : probDiff === "medium" ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)", 
                                    border: probDiff === "easy" ? "1px solid rgba(16, 185, 129, 0.25)" : probDiff === "medium" ? "1px solid rgba(245, 158, 11, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)", 
                                    padding: "3px 0", 
                                    borderRadius: "5px",
                                    flexShrink: 0
                                  }}>
                                    {prob.difficulty || "Medium"}
                                  </span>

                                  {/* ACTION BUTTONS */}
                                  {(() => {
                                    const url = prob.url || prob.externalUrl || "";
                                    const isGfg = (prob.platform || "").toUpperCase() === "GFG" || url.includes("geeksforgeeks.org");
                                    const isArticle = (prob.platform || "").toLowerCase() === "article" || 
                                                      ((prob.url || "").includes("takeuforward.org") && !(prob.url || "").includes("leetcode.com"));

                                    return (
                                      <>
                                        {!isGfg && (
                                          <button
                                            onClick={() => {
                                              const platformParam = "LeetCode";
                                              let cleanSlug = "";
                                              if (url.includes("leetcode.com/problems/")) {
                                                const match = url.match(/leetcode\.com\/problems\/([^/#?]+)/);
                                                if (match && match[1]) cleanSlug = match[1].toLowerCase().trim();
                                              }

                                              if (!cleanSlug) {
                                                cleanSlug = prob.slug || prob.id || "";
                                                if (cleanSlug.includes("leetcode.com")) {
                                                  const match = cleanSlug.match(/leetcode\.com\/problems\/([^/#?]+)/);
                                                  if (match && match[1]) cleanSlug = match[1].toLowerCase().trim();
                                                }
                                                cleanSlug = cleanSlug.split("#")[0].split("?")[0].replace(/\/$/, "").split("/").pop().trim();
                                              }
                                              const probTitle = prob.title || "";
                                              const randomRoom = `CF-${Math.floor(100000 + Math.random() * 900000)}`;
                                              navigate(`/workspace?problem=${encodeURIComponent(cleanSlug)}&platform=${encodeURIComponent(platformParam)}&url=${encodeURIComponent(url)}&title=${encodeURIComponent(probTitle)}&room=${randomRoom}&sheet=${activeSheetId}&from=dsa-sheets`);
                                            }}
                                            className="cd-btn-outline"
                                            style={{ width: "120px", padding: "6px 0", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", flexShrink: 0 }}
                                            title="Solve inside CodeForge IDE"
                                          >
                                            <Code2 size={13} /> Solve in IDE
                                          </button>
                                        )}

                                        <a
                                          href={prob.url || "https://leetcode.com/"}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="cd-btn-bw"
                                          style={{ width: "155px", padding: "6px 0", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", textDecoration: "none", flexShrink: 0 }}
                                        >
                                          <span>{isArticle ? "Read Article" : `Solve on ${prob.platform || "Platform"}`}</span> <ExternalLink size={12} />
                                        </a>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // CASE 2: Multi-subcategories Step Accordion (e.g. Striver A2Z Steps)
              return (
                <div key={group.groupKey} className="cd-sheet-accordion cd-animate-pop">
                  {/* Step Header */}
                  <div 
                    onClick={() => toggleGroup(group.groupKey)}
                    className="cd-sheet-header"
                    style={{ borderBottom: isGroupOpen ? "1px solid #27272a" : "none" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <span style={{ fontSize: "15px", fontWeight: "800", color: "#ffffff" }}>
                        {group.groupTitle}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#a1a1aa" }}>
                        {groupSolvedCount} / {groupTotalCount}
                      </span>
                    </div>

                    <div>
                      {isGroupOpen ? <ChevronDown size={16} color="#a1a1aa" /> : <ChevronRight size={16} color="#a1a1aa" />}
                    </div>
                  </div>

                  {/* Subcategories List */}
                  {isGroupOpen && (
                    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px", backgroundColor: "#0c0c0e" }}>
                      {filteredSubcategories.map((sub) => {
                        const isSubOpen = isFiltering ? true : !!expandedSubcategories[sub.topicId];
                        const problemsToDisplay = isFiltering ? (sub.matchingProblems || []) : (sub.problems || []);

                        const subTotalCount = (sub.problems || []).length;
                        const subSolvedCount = (sub.problems || []).filter(
                          (p) => p && (solvedMap[p.id] || (p.slug && solvedMap[p.slug]))
                        ).length;

                        return (
                          <div 
                            key={sub.topicId} 
                            style={{ 
                              backgroundColor: "#121215", 
                              border: "1px solid #27272a", 
                              borderRadius: "8px", 
                              overflow: "hidden" 
                            }}
                          >
                            {/* Subcategory Header */}
                            <div 
                              onClick={() => toggleSubcategory(sub.topicId)}
                              style={{ 
                                padding: "12px 16px", 
                                display: "flex", 
                                justifyContent: "space-between", 
                                alignItems: "center", 
                                cursor: "pointer", 
                                backgroundColor: "#121215",
                                borderBottom: isSubOpen ? "1px solid #27272a" : "none" 
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                {isSubOpen ? <ChevronDown size={15} color="#a1a1aa" /> : <ChevronRight size={15} color="#a1a1aa" />}
                                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#e4e4e7" }}>
                                  {sub.subTitle}
                                </h4>
                              </div>

                              <span style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: "600" }}>
                                {subSolvedCount} / {subTotalCount}
                              </span>
                            </div>

                            {/* Subcategory Problems List */}
                            {isSubOpen && (
                              <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px", backgroundColor: "#09090b" }}>
                                {problemsToDisplay.length === 0 ? (
                                  <div style={{ padding: "10px", textAlign: "center", color: "#a1a1aa", fontSize: "12.5px" }}>
                                    No problems match the filter.
                                  </div>
                                ) : (
                                  problemsToDisplay.map((prob) => {
                                    if (!prob) return null;
                                    const isSolved = !!solvedMap[prob.id] || (prob.slug && !!solvedMap[prob.slug]);
                                    const probDiff = (prob.difficulty || "Medium").toLowerCase();

                                    return (
                                      <div 
                                        key={prob.id}
                                        className="cd-list-item"
                                        style={{ opacity: isSolved ? 0.75 : 1 }}
                                      >
                                        <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
                                          <button
                                            onClick={() => toggleSolved(prob.id, prob.slug)}
                                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
                                            title={isSolved ? "Mark Unsolved" : "Mark Solved"}
                                          >
                                            {isSolved ? (
                                              <CheckCircle size={18} color="#10b981" />
                                            ) : (
                                              <Circle size={18} color="#52525b" />
                                            )}
                                          </button>

                                          <span 
                                            style={{ 
                                              fontSize: "13.5px", 
                                              fontWeight: "600", 
                                              color: "#ffffff", 
                                              textDecoration: isSolved ? "line-through" : "none",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap"
                                            }}
                                            title={prob.title}
                                          >
                                            {prob.title}
                                          </span>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                                          {/* Difficulty Pill */}
                                          <span style={{ 
                                            fontSize: "10.5px", 
                                            fontWeight: "700", 
                                            textTransform: "uppercase",
                                            width: "62px",
                                            textAlign: "center",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: probDiff === "easy" ? "#34d399" : probDiff === "medium" ? "#fbbf24" : "#f87171", 
                                            background: probDiff === "easy" ? "rgba(16, 185, 129, 0.1)" : probDiff === "medium" ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)", 
                                            border: probDiff === "easy" ? "1px solid rgba(16, 185, 129, 0.25)" : probDiff === "medium" ? "1px solid rgba(245, 158, 11, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)", 
                                            padding: "3px 0", 
                                            borderRadius: "5px",
                                            flexShrink: 0
                                          }}>
                                            {prob.difficulty || "Medium"}
                                          </span>

                                          {/* ACTION BUTTONS */}
                                          {(() => {
                                            const url = prob.url || prob.externalUrl || "";
                                            const isGfg = (prob.platform || "").toUpperCase() === "GFG" || url.includes("geeksforgeeks.org");
                                            const isArticle = (prob.platform || "").toLowerCase() === "article" || 
                                                              ((prob.url || "").includes("takeuforward.org") && !(prob.url || "").includes("leetcode.com"));

                                            return (
                                              <>
                                                {!isGfg && (
                                                  <button
                                                    onClick={() => {
                                                      const platformParam = "LeetCode";
                                                      let cleanSlug = "";
                                                      if (url.includes("leetcode.com/problems/")) {
                                                        const match = url.match(/leetcode\.com\/problems\/([^/#?]+)/);
                                                        if (match && match[1]) cleanSlug = match[1].toLowerCase().trim();
                                                      }

                                                      if (!cleanSlug) {
                                                        cleanSlug = prob.slug || prob.id || "";
                                                        if (cleanSlug.includes("leetcode.com")) {
                                                          const match = cleanSlug.match(/leetcode\.com\/problems\/([^/#?]+)/);
                                                          if (match && match[1]) cleanSlug = match[1].toLowerCase().trim();
                                                        }
                                                        cleanSlug = cleanSlug.split("#")[0].split("?")[0].replace(/\/$/, "").split("/").pop().trim();
                                                      }
                                                      const probTitle = prob.title || "";
                                                      const randomRoom = `CF-${Math.floor(100000 + Math.random() * 900000)}`;
                                                      navigate(`/workspace?problem=${encodeURIComponent(cleanSlug)}&platform=${encodeURIComponent(platformParam)}&url=${encodeURIComponent(url)}&title=${encodeURIComponent(probTitle)}&room=${randomRoom}&sheet=${activeSheetId}&from=dsa-sheets`);
                                                    }}
                                                    className="cd-btn-outline"
                                                    style={{ width: "120px", padding: "6px 0", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", flexShrink: 0 }}
                                                    title="Solve inside CodeForge IDE"
                                                  >
                                                    <Code2 size={13} /> Solve in IDE
                                                  </button>
                                                )}

                                                <a
                                                  href={prob.url || "https://leetcode.com/"}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="cd-btn-bw"
                                                  style={{ width: "155px", padding: "6px 0", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", textDecoration: "none", flexShrink: 0 }}
                                                >
                                                  <span>{isArticle ? "Read Article" : `Solve on ${prob.platform || "Platform"}`}</span> <ExternalLink size={12} />
                                                </a>
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </main>
    </div>
    </div>
  );
}
