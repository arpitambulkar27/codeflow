import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import axios from "axios";
import { io } from "socket.io-client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE_URL } from "../config/api";
import { executeCodeJob } from "../services/executionService";
import {
  Play,
  Bot,
  Terminal as TerminalIcon,
  MessageSquare,
  Users,
  Copy,
  Check,
  ArrowLeft,
  Loader2,
  Code2,
  Save,
  BookOpen,
  Send,
  Trash2,
  CheckCircle,
  XCircle,
  Sparkles,
  Edit2,
  Folder,
  FolderPlus,
  FilePlus,
  FileCode,
  ChevronRight,
  ChevronDown,
  FileText,
  GripVertical,
  GripHorizontal
} from "lucide-react";

import striverA2ZData from "../data/striverA2Z.json";
import loveBabbar450Data from "../data/loveBabbar450.json";
import { getFormattedProblemMarkdown } from "../data/dsaProblemDetails";

// Default clean starter code templates (Scratch code from user)
const LANGUAGE_BOILERPLATE = {
  python: '# Write your Python solution here\ndef main():\n    # write your code here\n    pass\n\nif __name__ == "__main__":\n    main()',
  javascript: '// Write your JavaScript solution here\nfunction main() {\n  // write your code here\n}\n\nmain();',
  java: '// Write your Java solution here\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // write your code here\n    }\n}',
  cpp: '// Write your C++ solution here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // write your code here\n    return 0;\n}',
};

const DEFAULT_FILE_NAMES = {
  python: "main.py",
  javascript: "main.js",
  java: "Main.java",
  cpp: "main.cpp",
};

// Helper to extract clean slug from URLs or strings
const extractCleanSlug = (val) => {
  if (!val) return "";
  let str = String(val).trim();
  if (str.includes("leetcode.com/problems/")) {
    const match = str.match(/leetcode\.com\/problems\/([^/]+)/);
    if (match && match[1]) return match[1];
  }
  str = str.replace(/\/$/, "");
  const parts = str.split("/");
  return parts[parts.length - 1] || str;
};

// Initialize Socket connection
const socket = io(API_BASE_URL, {
  autoConnect: true,
});

export default function Workspace() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Query Params
  const roomParam = searchParams.get("room") || (id ? `CF-${id.slice(-6)}` : "default-room");
  const langParam = searchParams.get("lang") || "python";
  const titleParam = searchParams.get("title");
  const rawProblemSlug = searchParams.get("problem");
  const problemSlug = extractCleanSlug(rawProblemSlug);

  // Workspace & Code State
  const [workspaceTitle, setWorkspaceTitle] = useState(titleParam || "Untitled Workspace");
  const [editingTitle, setEditingTitle] = useState(false);
  const [language, setLanguage] = useState(langParam);
  const [code, setCode] = useState(LANGUAGE_BOILERPLATE[langParam] || LANGUAGE_BOILERPLATE.python);
  const [stdinInput, setStdinInput] = useState("");
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [runButtonText, setRunButtonText] = useState("Run Code");
  const localRunActiveRef = useRef(false);
  const runInFlightRef = useRef(false);
  const abortControllerRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(1);
  const [activeTab, setActiveTab] = useState("output"); // 'output' | 'stdin'
  const [copied, setCopied] = useState(false);

  // File & Folder Tree State (Starts Folder Only, No Files by Default)
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [explorerOpen, setExplorerOpen] = useState(true);

  // Problem State (LeetCode Live View)
  const [problem, setProblem] = useState(null);
  const [problemLoading, setProblemLoading] = useState(false);
  const [problemLeftPanelOpen, setProblemLeftPanelOpen] = useState(!!problemSlug);
  const [codeSnippets, setCodeSnippets] = useState([]);

  // True whenever the workspace is being used to solve a DSA problem — either the
  // question is still loading (problemSlug present in the URL) or has finished
  // loading (problem object populated). Used to hide file-explorer / workspace-only
  // chrome (file tree, file creation buttons, Save Workspace) and show the clean
  // DSA-solving layout (Problem Statement + Editor + Run/Submit/AI Hint) instead.
  const isDsaMode = Boolean(problemSlug) || Boolean(problem);

  // Test Case Submission State (DSA Mode)
  const [submitting, setSubmitting] = useState(false);
  const [submitResults, setSubmitResults] = useState(null);
  const [submitError, setSubmitError] = useState("");

  // Panel Resizing States (Horizontal Width & Vertical Height)
  const [problemPanelWidth, setProblemPanelWidth] = useState(480);
  const [isResizingProblem, setIsResizingProblem] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(230);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);

  // Gemini AI Drawer State
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiMode, setAiMode] = useState("hints"); // 'hints' | 'analysis'
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");

  const editorRef = useRef(null);
  const isRemoteChange = useRef(false);
  const lastRemoteChangeTime = useRef(0);
  const codeRef = useRef(code);
  const languageRef = useRef(language);
  const token = localStorage.getItem("token");

  // Keep refs in sync with state for socket callbacks
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Cleanup in-flight execution polling on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Handle Problem Panel Resizing (Horizontal Width)
  const handleMouseDownProblemResize = (e) => {
    e.preventDefault();
    setIsResizingProblem(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingProblem) return;
      const newWidth = e.clientX;
      if (newWidth > 280 && newWidth < window.innerWidth - 350) {
        setProblemPanelWidth(newWidth);
        if (editorRef.current && typeof editorRef.current.layout === "function") {
          editorRef.current.layout();
        }
      }
    };

    const handleMouseUp = () => {
      if (isResizingProblem) setIsResizingProblem(false);
    };

    if (isResizingProblem) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingProblem]);

  // Handle Bottom Terminal Resizing (Vertical Height)
  const handleMouseDownTerminalResize = (e) => {
    e.preventDefault();
    setIsResizingTerminal(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingTerminal) return;
      const calculatedHeight = window.innerHeight - e.clientY;
      // Reserve at least 200px for Monaco Editor & Header Bar
      const maxAllowedHeight = Math.max(60, window.innerHeight - 200);
      const newHeight = Math.max(60, Math.min(calculatedHeight, maxAllowedHeight));
      setTerminalHeight(newHeight);
      if (editorRef.current && typeof editorRef.current.layout === "function") {
        editorRef.current.layout();
      }
    };

    const handleMouseUp = () => {
      if (isResizingTerminal) setIsResizingTerminal(false);
    };

    if (isResizingTerminal) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingTerminal]);

  // Trigger Monaco Editor relayout on panel resize
  useEffect(() => {
    if (editorRef.current && typeof editorRef.current.layout === "function") {
      editorRef.current.layout();
    }
  }, [problemPanelWidth, terminalHeight, problemLeftPanelOpen, explorerOpen]);

  // 1. Fetch Saved Workspace Data if ID exists
  useEffect(() => {
    if (id) {
      fetchWorkspaceData(id);
    } else if (!problemSlug) {
      const rootFolder = {
        id: `folder-root-${Date.now()}`,
        name: titleParam || "src",
        type: "folder",
        parentId: null,
      };
      const defaultFile = {
        id: `file-main-${Date.now()}`,
        name: DEFAULT_FILE_NAMES[langParam || "python"] || "main.py",
        type: "file",
        parentId: rootFolder.id,
        content: LANGUAGE_BOILERPLATE[langParam || "python"] || LANGUAGE_BOILERPLATE.python,
        language: langParam || "python",
      };
      setFiles([rootFolder, defaultFile]);
      setSelectedFolderId(rootFolder.id);
      setExpandedFolders({ [rootFolder.id]: true });
      setExplorerOpen(true);
      setActiveFileId(defaultFile.id);
      setCode(defaultFile.content);
    }
  }, [id]);

  // 2. Fetch Official Problem Data (LeetCode or GFG) if problem slug exists
  useEffect(() => {
    if (problemSlug) {
      fetchOfficialProblem(problemSlug);
    }
  }, [problemSlug]);

  // Update starter code whenever selected language or code snippets change
  useEffect(() => {
    if (codeSnippets && codeSnippets.length > 0) {
      const targetLang = language === "python" ? "python3" : language;
      const snippet = codeSnippets.find(
        (s) => s.langSlug === language || s.langSlug === targetLang || (s.lang && s.lang.toLowerCase() === language.toLowerCase())
      );
      if (snippet && snippet.code) {
        setCode(snippet.code);
      }
    }
  }, [language, codeSnippets]);

  const fetchWorkspaceData = async (wsId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/workspaces/${wsId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
        setWorkspaceTitle(res.data.title || "Untitled Workspace");
        const loadedLang = res.data.language || "python";
        setLanguage(loadedLang);

        if (res.data.stdinInput) {
          setStdinInput(res.data.stdinInput);
        }

        let fileList = Array.isArray(res.data.files) ? res.data.files : [];
        let firstFolder = fileList.find((f) => f.type === "folder");
        let firstFile = fileList.find((f) => f.type === "file");

        if (!firstFolder) {
          firstFolder = {
            id: `folder-root-${Date.now()}`,
            name: res.data.title || "src",
            type: "folder",
            parentId: null,
          };
          fileList = [firstFolder, ...fileList];
        }

        if (!firstFile) {
          const rootFolderId = firstFolder.id;
          const defaultFileName = DEFAULT_FILE_NAMES[loadedLang] || "main.py";
          const defaultContent = res.data.code || LANGUAGE_BOILERPLATE[loadedLang] || LANGUAGE_BOILERPLATE.python;
          firstFile = {
            id: `file-main-${Date.now()}`,
            name: defaultFileName,
            type: "file",
            parentId: rootFolderId,
            content: defaultContent,
            language: loadedLang,
          };
          fileList = [...fileList, firstFile];
        }

        setFiles(fileList);
        setSelectedFolderId(firstFolder.id);
        setExpandedFolders({ [firstFolder.id]: true });
        setExplorerOpen(true);
        setActiveFileId(firstFile.id);
        setCode(firstFile.content || res.data.code || "");
      }
    } catch (err) {
      console.error("Failed to load workspace:", err);
    }
  };

  // Fetch official question from backend unified problem details endpoint (/api/problems/details)
  const fetchOfficialProblem = async (slug) => {
    setProblemLoading(true);
    setProblemLeftPanelOpen(true);
    setExplorerOpen(false);

    const platformParam = searchParams.get("platform") || "LeetCode";
    const titleParam = searchParams.get("title") || "";
    const externalUrlParam = searchParams.get("url") || "";
    const isGfg = platformParam === "GFG" || (rawProblemSlug && rawProblemSlug.includes("geeksforgeeks"));

    try {
      const res = await axios.get(`${API_BASE_URL}/api/problems/details`, {
        params: {
          slug,
          platform: platformParam,
          url: externalUrlParam,
          title: titleParam,
        },
      });
      const data = res.data;

      if (data && data.title) {
        setProblem({
          title: data.title,
          slug: data.titleSlug || slug,
          difficulty: data.difficulty || "Medium",
          descriptionHtml: data.content,
          externalUrl: externalUrlParam || (isGfg
            ? `https://www.geeksforgeeks.org/problems/${slug}/1`
            : `https://leetcode.com/problems/${slug}/`),
          platform: data.platform || (isGfg ? "GeeksforGeeks" : "LeetCode"),
        });

        if (Array.isArray(data.codeSnippets) && data.codeSnippets.length > 0) {
          setCodeSnippets(data.codeSnippets);
          const targetLang = language === "python" ? "python3" : language;
          const snippet = data.codeSnippets.find(
            (s) => s.langSlug === language || s.langSlug === targetLang || (s.lang && s.lang.toLowerCase() === language.toLowerCase())
          );
          const activeSnippetCode = snippet && snippet.code ? snippet.code : (LANGUAGE_BOILERPLATE[language] || LANGUAGE_BOILERPLATE.python);
          setCode(activeSnippetCode);
          socket.emit("code-change", { roomId: roomParam, roomCode: roomParam, code: activeSnippetCode, language });
        }
        return;
      }
    } catch (err) {
      console.warn("Unified API fetch failed, trying fallback:", err.message);
    } finally {
      setProblemLoading(false);
    }

    // Fallback to static datasets if live fetch fails
    fetchFallbackProblemData(slug);
  };

  const fetchFallbackProblemData = async (slug) => {
    let foundStaticProb = null;
    const allSheets = [striverA2ZData, loveBabbar450Data];
    
    for (const sheetObj of allSheets) {
      for (const topic of sheetObj.topics || []) {
        for (const prob of topic.problems || []) {
          if (prob.slug === slug || prob.id === slug) {
            foundStaticProb = prob;
            break;
          }
        }
        if (foundStaticProb) break;
      }
      if (foundStaticProb) break;
    }

    if (foundStaticProb) {
      const fullMarkdown = getFormattedProblemMarkdown(
        foundStaticProb.title,
        foundStaticProb.slug || slug,
        foundStaticProb.difficulty || "Easy",
        foundStaticProb.platform || "LeetCode/GFG",
        foundStaticProb.url || "https://leetcode.com/"
      );

      const formattedProb = {
        title: foundStaticProb.title,
        slug: foundStaticProb.slug || slug,
        category: foundStaticProb.category || "DSA",
        difficulty: foundStaticProb.difficulty || "Easy",
        externalUrl: foundStaticProb.url || "https://leetcode.com/",
        platform: foundStaticProb.platform || "LeetCode/GFG",
        description: fullMarkdown,
      };

      const fallbackCode = LANGUAGE_BOILERPLATE[language] || LANGUAGE_BOILERPLATE.python;
      setProblem(formattedProb);
      setCode(fallbackCode);
      setProblemLoading(false);

      // Ensure the room's authoritative state is updated so any Guest already
      // connected (or joining shortly after) receives this starter code via
      // the "sync-initial-state" handshake instead of stale boilerplate.
      socket.emit("code-change", { roomId: roomParam, roomCode: roomParam, code: fallbackCode, language });
    }
  };

  // 3. Socket.io Multiplayer Setup
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    let username = "Anonymous";
    if (userStr) {
      try {
        username = JSON.parse(userStr).username || "Developer";
      } catch (e) {
        username = "Developer";
      }
    }

    socket.emit("join-room", { roomId: roomParam, roomCode: roomParam, username });

    const handleRemoteCodeUpdate = (data) => {
      const newCode = typeof data === "string" ? data : (data?.code !== undefined ? data.code : "");
      if (newCode === codeRef.current) return;
      lastRemoteChangeTime.current = Date.now();
      isRemoteChange.current = true;
      setCode(newCode);
      if (activeFileId) {
        setFiles((prev) =>
          prev.map((f) => (f.id === activeFileId ? { ...f, content: newCode } : f))
        );
      }
    };

    const handleInitialStateSync = (state) => {
      if (state) {
        if (state.language) setLanguage(state.language);
        if (state.code !== undefined && state.code !== codeRef.current) {
          lastRemoteChangeTime.current = Date.now();
          isRemoteChange.current = true;
          setCode(state.code);
          if (activeFileId) {
            setFiles((prev) =>
              prev.map((f) => (f.id === activeFileId ? { ...f, content: state.code } : f))
            );
          }
        }
      }
    };

    const handleLanguageSync = (data) => {
      if (data && data.language) {
        setLanguage(data.language);
        if (data.code !== undefined && data.code !== codeRef.current) {
          lastRemoteChangeTime.current = Date.now();
          isRemoteChange.current = true;
          setCode(data.code);
        }
      }
    };

    socket.on("code-update", handleRemoteCodeUpdate);
    socket.on("code-change", handleRemoteCodeUpdate);
    socket.on("sync-initial-state", handleInitialStateSync);
    socket.on("language-update", handleLanguageSync);

    socket.on("user-joined", () => {
      // Broadcast active host code and language to newly joined participant
      socket.emit("code-change", {
        roomId: roomParam,
        roomCode: roomParam,
        code: codeRef.current,
        language: languageRef.current,
      });
    });

    socket.on("room-participants", (data) => {
      if (data.count) setConnectedUsers(data.count);
    });

    socket.on("execution-result", (data) => {
      // If this client initiated the run, ignore socket event to prevent duplicate render (polling handles it)
      if (localRunActiveRef.current) return;

      setIsLoading(false);
      setActiveTab("output");

      const outputText = data.output || data.stdout;
      const errorText = data.error || data.stderr;

      if (errorText && errorText.trim() !== "") {
        setOutput(`Execution Output:\n${outputText || ""}\n\nErrors:\n${errorText}`);
      } else if (outputText !== undefined && outputText.trim() !== "") {
        setOutput(outputText);
      } else {
        setOutput("Program executed successfully with no stdout output.");
      }
    });

    return () => {
      socket.off("code-update", handleRemoteCodeUpdate);
      socket.off("code-change", handleRemoteCodeUpdate);
      socket.off("sync-initial-state", handleInitialStateSync);
      socket.off("language-update", handleLanguageSync);
      socket.off("user-joined");
      socket.off("room-participants");
      socket.off("execution-result");
    };
  }, [roomParam, activeFileId]);

  // Language Change Handler
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    let targetCode = codeRef.current;
    
    // Check if we have an official LeetCode snippet for this language
    if (codeSnippets && codeSnippets.length > 0) {
      const targetLang = newLang === "python" ? "python3" : newLang;
      const snippet = codeSnippets.find(
        (s) => s.langSlug === newLang || s.langSlug === targetLang || (s.lang && s.lang.toLowerCase() === newLang.toLowerCase())
      );
      if (snippet && snippet.code) {
        targetCode = snippet.code;
        setCode(targetCode);
      }
    } else {
      targetCode = LANGUAGE_BOILERPLATE[newLang] || LANGUAGE_BOILERPLATE.python;
      setCode(targetCode);
      if (activeFileId) {
        setFiles((prev) =>
          prev.map((f) => (f.id === activeFileId ? { ...f, content: targetCode, language: newLang } : f))
        );
      }
    }

    socket.emit("language-change", { roomId: roomParam, roomCode: roomParam, language: newLang, code: targetCode });
  };

  // Handle Monaco Editor Change
  const handleEditorChange = (value) => {
    const val = value || "";
    // 1. If value is identical to current codeRef, do not emit
    if (val === codeRef.current) return;

    // 2. Ignore echo events within 400ms of receiving a remote update
    if (Date.now() - lastRemoteChangeTime.current < 400) {
      return;
    }

    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      return;
    }

    setCode(val);
    if (activeFileId) {
      setFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, content: val } : f))
      );
    }
    socket.emit("code-change", { roomId: roomParam, roomCode: roomParam, code: val, language: languageRef.current });
  };

  // File & Folder Operations
  const handleCreateFile = (targetParentId = null) => {
    const parent = targetParentId !== null ? targetParentId : (selectedFolderId || files.find(f => f.type === "folder")?.id || null);
    const defaultExt = DEFAULT_FILE_NAMES[language] || "main.txt";
    const name = window.prompt(`Enter new file name (e.g. ${defaultExt}, utils.py):`);
    if (!name || !name.trim()) return;

    const initialContent = LANGUAGE_BOILERPLATE[language] || LANGUAGE_BOILERPLATE.python;

    const newFile = {
      id: `file-${Date.now()}`,
      name: name.trim(),
      type: "file",
      parentId: parent,
      content: initialContent,
      language,
    };

    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setCode(initialContent);
  };

  const handleCreateFolder = (targetParentId = null) => {
    const parent = targetParentId !== null ? targetParentId : selectedFolderId;
    const name = window.prompt("Enter new folder name (e.g. components, src):");
    if (!name || !name.trim()) return;

    const newFolder = {
      id: `folder-${Date.now()}`,
      name: name.trim(),
      type: "folder",
      parentId: parent,
    };

    setFiles((prev) => [...prev, newFolder]);
    setExpandedFolders((prev) => ({ ...prev, [newFolder.id]: true }));
    setSelectedFolderId(newFolder.id);
  };

  const handleDeleteItem = (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${item.type} "${item.name}"?`)) return;

    const idsToDelete = new Set([item.id]);
    if (item.type === "folder") {
      const collectChildren = (folderId) => {
        files.filter((f) => f.parentId === folderId).forEach((child) => {
          idsToDelete.add(child.id);
          if (child.type === "folder") collectChildren(child.id);
        });
      };
      collectChildren(item.id);
    }

    setFiles((prev) => prev.filter((f) => !idsToDelete.has(f.id)));
    if (idsToDelete.has(activeFileId)) {
      const remainingFiles = files.filter((f) => !idsToDelete.has(f.id) && f.type === "file");
      if (remainingFiles.length > 0) {
        setActiveFileId(remainingFiles[0].id);
        setCode(remainingFiles[0].content || "");
      } else {
        setActiveFileId(null);
        setCode("");
      }
    }
  };

  const handleSelectFile = (file) => {
    setActiveFileId(file.id);
    setCode(file.content || "");
  };

  const toggleFolder = (folderId) => {
    setSelectedFolderId(folderId);
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Keyboard Shortcuts (Ctrl+S to Save)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSaveWorkspace();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, workspaceTitle, code, language, files, stdinInput]);

  // Save Workspace State to MongoDB
  const handleSaveWorkspace = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await axios.put(
        `${API_BASE_URL}/api/workspaces/${id}`,
        {
          title: workspaceTitle,
          language,
          code,
          files,
          stdinInput,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Save Workspace Error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Run Code Execution inside Docker Sandbox via BullMQ Queue
  const handleRunCode = async () => {
    // Synchronous guard against rapid clicks stacking jobs; ignore subsequent clicks
    if (runInFlightRef.current) return;
    runInFlightRef.current = true;
    localRunActiveRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setRunButtonText("Queued...");
    setActiveTab("output");
    setOutput("⏳ Job queued in execution runner...");

    try {
      const result = await executeCodeJob(
        {
          language,
          code,
          stdin: stdinInput,
          stdinInput,
          roomId: roomParam,
          roomCode: roomParam,
        },
        {
          signal: abortController.signal,
          onStateChange: (state) => {
            if (state === "waiting") {
              setRunButtonText("Queued...");
              setOutput("⏳ Job queued in execution runner...");
            } else if (state === "active") {
              setRunButtonText("Running...");
              setOutput("🚀 Executing in Docker sandbox...");
            }
          },
        }
      );

      const outStr = result.output || result.stdout;
      const errStr = result.stderr;
      if (errStr && errStr.trim() !== "") {
        setOutput(`Execution Output:\n${outStr || ""}\n\nErrors:\n${errStr}`);
      } else {
        setOutput(outStr || "Program executed successfully with no stdout output.");
      }
    } catch (error) {
      if (
        axios.isCancel(error) ||
        error.name === "AbortError" ||
        error.name === "CanceledError" ||
        error.message === "aborted"
      ) {
        return;
      }
      const errMsg =
        error.response?.data?.error ||
        error.message ||
        "Error executing code in Docker container runner.";
      setOutput(`Execution Error:\n${errMsg}`);
    } finally {
      if (!abortController.signal.aborted) {
        runInFlightRef.current = false;
        localRunActiveRef.current = false;
        setIsLoading(false);
        setRunButtonText("Run Code");
      }
    }
  };

  // Submit Code Against Test Cases (DSA Mode)
  const handleSubmitTestCases = async () => {
    if (!problem || !problem.slug) return;

    setSubmitting(true);
    setSubmitError("");
    setSubmitResults(null);
    setActiveTab("tests");

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/problems/${encodeURIComponent(problem.slug)}/submit`,
        { language, code },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setSubmitResults(res.data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        setSubmitError(
          "No stored test cases are available for this problem yet, so it can't be auto-graded here. Use \"Run Code\" with the examples from the problem statement instead."
        );
      } else if (status === 401) {
        setSubmitError("Please log in again to submit your solution for grading.");
      } else {
        setSubmitError(err.response?.data?.error || "Failed to run your solution against the test cases.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle AI Drawer without auto-running AI request
  const toggleAIDrawer = () => {
    setAiDrawerOpen((prev) => !prev);
  };

  // Gemini AI Code Review / Hints / Analysis Handler
  const handleAIReview = async (mode = "hints") => {
    setAiDrawerOpen(true);
    setAiMode(mode);
    setAiLoading(true);
    setAiAnalysis("");

    try {
      const response = await axios.post(`${API_BASE_URL}/api/ai/review`, {
        code,
        language,
        type: mode,
        problemTitle: problem ? problem.title : undefined,
        problemDescription: problem ? (problem.descriptionHtml || problem.description) : undefined,
      });

      let rawOutput = response.data.review || response.data.analysis || "No AI output returned.";
      const cleanOutput = rawOutput.replace(/\$|\\mathcal|\{|\}/g, "");
      setAiAnalysis(cleanOutput);
    } catch (error) {
      setAiAnalysis(`⚠️ Gemini AI Request Failed:\n${error.response?.data?.error || error.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomParam);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render Tree Component
  const renderTree = (parentId = null, level = 0) => {
    const children = files.filter((f) => f.parentId === parentId);
    if (children.length === 0) return null;

    return children.map((item) => {
      const isFolder = item.type === "folder";
      const isExpanded = expandedFolders[item.id];
      const isActive = item.id === activeFileId;
      const isSelectedFolder = item.id === selectedFolderId;

      return (
        <div key={item.id} style={{ paddingLeft: `${level * 12}px` }}>
          <div
            onClick={() => (isFolder ? toggleFolder(item.id) : handleSelectFile(item))}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 8px",
              borderRadius: "6px",
              cursor: "pointer",
              backgroundColor: isActive ? "#27272a" : isSelectedFolder ? "#18181b" : "transparent",
              color: isActive ? "#ffffff" : "#f4f4f5",
              fontSize: "12.5px",
              margin: "1px 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
              {isFolder ? (
                <>
                  {isExpanded ? <ChevronDown size={14} color="#a1a1aa" /> : <ChevronRight size={14} color="#a1a1aa" />}
                  <Folder size={15} color="#ffffff" />
                </>
              ) : (
                <FileCode size={15} color={isActive ? "#ffffff" : "#a1a1aa"} />
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.name}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {isFolder && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleCreateFile(item.id); }}
                  title="Add file inside folder"
                  style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", padding: "2px" }}
                >
                  <FilePlus size={13} />
                </button>
              )}
              <button
                onClick={(e) => handleDeleteItem(e, item)}
                title="Delete"
                style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", padding: "2px" }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {isFolder && isExpanded && renderTree(item.id, level + 1)}
        </div>
      );
    });
  };

  // Handle Navigation Back Button (DSA Sheets vs Dashboard)
  // Note: the DSA sheets browser is registered in App.jsx at the "/sheets" route
  // (DsaSheets.jsx reads its active sheet from the "sheet" query param), so that is
  // the path we must return the user to — navigating to a non-existent "/dsa-sheets"
  // route would just bounce through the catch-all redirect back to the landing page.
  const handleBackNavigation = () => {
    const sheet = searchParams.get("sheet");
    const fromParam = searchParams.get("from");
    if (problemSlug || problem || sheet || fromParam === "dsa-sheets") {
      const activeSheetId = sheet || sessionStorage.getItem("codeforge_active_sheet") || "striver-a2z";
      navigate(`/sheets?sheet=${encodeURIComponent(activeSheetId)}`);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#09090b", color: "#ffffff", fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif", overflow: "hidden", position: "relative" }}>
      
      {/* DRAG OVERLAY TO PREVENT MOUSE EVENT LOSS OVER MONACO / HTML PANELS */}
      {(isResizingProblem || isResizingTerminal) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            cursor: isResizingProblem ? "col-resize" : "row-resize",
            userSelect: "none",
          }}
        />
      )}
      
      {/* 1. Left Vertical Activity Bar (File Explorer, Live Collab, AI Help) */}
      <div style={{ width: "52px", minWidth: "52px", borderRight: "1px solid #27272a", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "12px", paddingBottom: "12px", gap: "12px", backgroundColor: "#0c0c0e", zIndex: 25, flexShrink: 0, overflowY: "auto", overflowX: "hidden" }}>
        <button onClick={handleBackNavigation} title={(problemSlug || problem) ? "Back to DSA Sheets" : "Back to Dashboard"} style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", padding: "6px", borderRadius: "8px" }}>
          <ArrowLeft size={18} />
        </button>

        {problem && (
          <button onClick={() => setProblemLeftPanelOpen(!problemLeftPanelOpen)} title="Problem Description (Left Panel)" style={{ background: problemLeftPanelOpen ? "#27272a" : "none", border: "none", color: problemLeftPanelOpen ? "#ffffff" : "#a1a1aa", cursor: "pointer", padding: "6px", borderRadius: "8px" }}>
            <BookOpen size={18} />
          </button>
        )}

        {!isDsaMode && (
          <button onClick={() => setExplorerOpen(!explorerOpen)} title="Toggle File Explorer" style={{ background: explorerOpen ? "#27272a" : "none", border: "none", color: explorerOpen ? "#ffffff" : "#a1a1aa", cursor: "pointer", padding: "6px", borderRadius: "8px" }}>
            <Folder size={18} />
          </button>
        )}

        <button onClick={toggleAIDrawer} title="Gemini AI Assistance" style={{ background: aiDrawerOpen ? "#27272a" : "none", border: "none", color: aiDrawerOpen ? "#ffffff" : "#a1a1aa", cursor: "pointer", padding: "6px", borderRadius: "8px" }}>
          <Bot size={18} color="#ffffff" />
        </button>

        <button onClick={copyRoomCode} title="Live Collab / Share Room Code" style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", padding: "6px", borderRadius: "8px" }}>
          {copied ? <Check size={18} color="#ffffff" /> : <Users size={18} />}
        </button>
      </div>

      {/* 2. LEETCODE-STYLE LEFT PROBLEM PANEL (RENDERS LIVE GRAPHQL HTML) */}
      {problemLeftPanelOpen && (problem || problemLoading) && (
        <>
          <div style={{ width: `${problemPanelWidth}px`, backgroundColor: "#0c0c0e", display: "flex", flexDirection: "column", flexShrink: 0, zIndex: 15, position: "relative" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #18181b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <BookOpen size={17} color="#ffffff" />
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#ffffff" }}>
                  Official {problem?.platform || ((searchParams.get("platform") === "GFG" || (rawProblemSlug && rawProblemSlug.includes("geeksforgeeks"))) ? "GeeksforGeeks" : "LeetCode")} Statement
                </span>
              </div>
              <button onClick={() => setProblemLeftPanelOpen(false)} style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer" }}>
                ✕
              </button>
            </div>

            <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
              {problemLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "12px", color: "#a1a1aa" }}>
                  <Loader2 size={26} className="animate-spin" color="#3b82f6" />
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>
                    Fetching official {(searchParams.get("platform") === "GFG" || (rawProblemSlug && rawProblemSlug.includes("geeksforgeeks"))) ? "GeeksforGeeks" : "LeetCode"} statement...
                  </span>
                </div>
              ) : problem ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#ffffff" }}>{problem.title}</h2>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#ffffff", backgroundColor: "#18181b", border: "1px solid #3f3f46", padding: "3px 8px", borderRadius: "6px" }}>
                      {problem.difficulty}
                    </span>
                  </div>

                  {/* Render Official LeetCode HTML content or Markdown fallback */}
                  {problem.descriptionHtml ? (
                    <div
                      className="text-sm text-slate-300 leading-relaxed [&_pre]:bg-[#161b22] [&_pre]:p-3.5 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[#30363d] [&_pre]:overflow-x-auto [&_code]:text-blue-400 [&_code]:font-mono [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_strong]:text-white [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#30363d] [&_th]:p-2 [&_td]:border [&_td]:border-[#30363d] [&_td]:p-2"
                      dangerouslySetInnerHTML={{ __html: problem.descriptionHtml }}
                    />
                  ) : (
                    <div style={{ margin: "18px 0", fontSize: "13px", color: "#a1a1aa", lineHeight: "1.6" }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.description}</ReactMarkdown>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>

          {/* PROBLEM PANEL HORIZONTAL RESIZER (DOUBLE-ARROW ADJUSTMENT) */}
          <div
            onMouseDown={handleMouseDownProblemResize}
            title="Drag left/right to adjust question screen size"
            style={{
              width: "6px",
              cursor: "col-resize",
              backgroundColor: isResizingProblem ? "#ffffff" : "#18181b",
              borderLeft: "1px solid #27272a",
              borderRight: "1px solid #27272a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 20,
              userSelect: "none",
              transition: isResizingProblem ? "none" : "background-color 0.15s ease",
            }}
          >
            <GripVertical size={12} color={isResizingProblem ? "#ffffff" : "#71717a"} />
          </div>
        </>
      )}

      {/* 3. File Explorer Sidebar — never shown while solving a DSA problem */}
      {explorerOpen && !problemLeftPanelOpen && !isDsaMode && (
        <div style={{ width: "230px", borderRight: "1px solid #27272a", backgroundColor: "#0c0c0e", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #18181b", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", color: "#a1a1aa", textTransform: "uppercase" }}>EXPLORER</span>
            
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => handleCreateFile(null)} title="New File in Folder" style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer" }}>
                <FilePlus size={15} />
              </button>
              <button onClick={() => handleCreateFolder(null)} title="New Folder" style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer" }}>
                <FolderPlus size={15} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
            {files.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#71717a", padding: "12px 8px" }}>
                No folder created.
              </div>
            ) : (
              renderTree(null, 0)
            )}
          </div>
        </div>
      )}

      {/* 4. MAIN IDE AREA */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* TOP HEADER BAR */}
        <div style={{ height: "54px", backgroundColor: "#121215", borderBottom: "1px solid #27272a", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
            <div style={{ padding: "6px", backgroundColor: "#18181b", borderRadius: "8px", border: "1px solid #3f3f46", flexShrink: 0 }}>
              <Code2 size={18} color="#ffffff" />
            </div>

            {problem ? (
              <div style={{ fontWeight: "700", fontSize: "14px", color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Problem: {problem.title}
              </div>
            ) : editingTitle ? (
              <input
                type="text"
                value={workspaceTitle}
                onChange={(e) => setWorkspaceTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                autoFocus
                style={{ backgroundColor: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#ffffff", padding: "4px 8px", fontSize: "14px", fontWeight: "bold", outline: "none" }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", overflow: "hidden" }} onClick={() => setEditingTitle(true)}>
                <span style={{ fontWeight: "700", fontSize: "14px", color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{workspaceTitle}</span>
                <Edit2 size={13} color="#a1a1aa" style={{ flexShrink: 0 }} />
              </div>
            )}

            {/* Auto-Save Indicator */}
            {id && !isDsaMode && (
              <span style={{ fontSize: "11px", color: saveSuccess ? "#ffffff" : "#a1a1aa", display: "flex", alignItems: "center", gap: "4px", backgroundColor: "#18181b", padding: "3px 8px", borderRadius: "6px", border: "1px solid #27272a", flexShrink: 0 }}>
                {saveSuccess ? <Check size={12} color="#ffffff" /> : null}
                {saving ? "Saving..." : saveSuccess ? "Saved" : "Ctrl+S to save"}
              </span>
            )}
          </div>

          {/* Action Button Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            
            {/* Language Selector */}
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              style={{ backgroundColor: "#09090b", color: "#ffffff", border: "1px solid #27272a", borderRadius: "8px", padding: "6px 12px", fontSize: "13px", outline: "none", cursor: "pointer", fontWeight: "600" }}
            >
              <option value="python">Python 3</option>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="java">Java 21</option>
              <option value="cpp">C++ 20</option>
            </select>

            {/* Room Share Pill */}
            <button
              onClick={copyRoomCode}
              style={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "6px 12px", color: "#a1a1aa", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
            >
              <Users size={14} color="#ffffff" />
              <span>Room: {roomParam}</span>
              <span style={{ backgroundColor: "#27272a", color: "#ffffff", fontSize: "10px", padding: "1px 5px", borderRadius: "4px", fontWeight: "bold" }}>{connectedUsers} online</span>
            </button>

            {/* Save Button — hidden entirely in DSA question mode */}
            {id && !isDsaMode && (
              <button
                onClick={handleSaveWorkspace}
                disabled={saving}
                style={{ backgroundColor: "#121215", border: "1px solid #27272a", color: "#ffffff", padding: "7px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Save size={14} />
                <span>{saving ? "Saving..." : "Save"}</span>
              </button>
            )}

            {/* Run Code Button */}
            <button
              onClick={handleRunCode}
              disabled={isLoading}
              style={{ backgroundColor: "#ffffff", color: "#09090b", border: "none", padding: "7px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{runButtonText}</span>
                </>
              ) : (
                <>
                  <Play size={14} />
                  <span>Run Code</span>
                </>
              )}
            </button>

            {/* Submit Test Cases Button — DSA Mode only */}
            {isDsaMode && problem && (
              <button
                onClick={handleSubmitTestCases}
                disabled={submitting}
                style={{ backgroundColor: "#16a34a", color: "#ffffff", border: "none", padding: "7px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    <span>Submit</span>
                  </>
                )}
              </button>
            )}

          </div>
        </div>

        {/* MONACO EDITOR & BOTTOM TERMINAL */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          
          {/* Monaco Editor Canvas or Folder Placeholder */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}>
            {!activeFileId && !isDsaMode ? (
              <div style={{ width: "100%", height: "100%", backgroundColor: "#09090b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", boxSizing: "border-box" }}>
                <div style={{ width: "54px", height: "54px", borderRadius: "14px", background: "#18181b", border: "1px solid #3f3f46", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <Folder size={26} color="#ffffff" />
                </div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "17px", fontWeight: "800", color: "#ffffff" }}>Root Folder Initialized</h3>
                <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#a1a1aa", maxWidth: "380px", textAlign: "center" }}>
                  This workspace starts with a root folder. Create a file inside this folder to start writing your code!
                </p>
                <button 
                  onClick={() => handleCreateFile(selectedFolderId || files.find(f => f.type === "folder")?.id || null)}
                  style={{ backgroundColor: "#ffffff", color: "#09090b", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "bold", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <FilePlus size={15} /> Create File in Folder
                </button>
              </div>
            ) : (
              <Editor
                height="100%"
                language={language === "cpp" ? "cpp" : language}
                theme="vs-dark"
                value={code}
                onChange={handleEditorChange}
                onMount={(editor, monaco) => {
                  editorRef.current = editor;

                  const remeasure = () => {
                    if (monaco && monaco.editor && typeof monaco.editor.remeasureFonts === "function") {
                      monaco.editor.remeasureFonts();
                    }
                    if (editor && typeof editor.layout === "function") {
                      editor.layout();
                    }
                  };

                  remeasure();
                  setTimeout(remeasure, 100);

                  if (document.fonts && document.fonts.ready) {
                    document.fonts.ready.then(remeasure);
                  }
                }}
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  readOnly: false,
                  cursorStyle: "line",
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  matchBrackets: "always",
                  renderLineHighlight: "all",
                  selectionHighlight: true,
                  occurrencesHighlight: "on",
                  bracketPairColorization: { enabled: true },
                }}
              />
            )}
          </div>

          {/* TERMINAL VERTICAL RESIZER (DOUBLE-ARROW ADJUSTMENT) */}
          <div
            onMouseDown={handleMouseDownTerminalResize}
            title="Drag up/down to adjust terminal height"
            style={{
              height: "6px",
              cursor: "row-resize",
              backgroundColor: isResizingTerminal ? "#ffffff" : "#18181b",
              borderTop: "1px solid #27272a",
              borderBottom: "1px solid #27272a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 20,
              userSelect: "none",
              transition: isResizingTerminal ? "none" : "background-color 0.15s ease",
            }}
          >
            <GripHorizontal size={12} color={isResizingTerminal ? "#ffffff" : "#71717a"} />
          </div>

          {/* DUAL TERMINAL */}
          <div style={{ height: `${terminalHeight}px`, minHeight: "60px", flexShrink: 0, backgroundColor: "#121215", display: "flex", flexDirection: "column" }}>
            
            <div style={{ height: "36px", backgroundColor: "#18181b", borderBottom: "1px solid #27272a", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={() => setActiveTab("output")}
                  style={{ backgroundColor: activeTab === "output" ? "#121215" : "transparent", border: "1px solid", borderColor: activeTab === "output" ? "#27272a" : "transparent", borderBottom: activeTab === "output" ? "none" : "transparent", color: activeTab === "output" ? "#ffffff" : "#a1a1aa", padding: "4px 12px", borderRadius: "6px 6px 0 0", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <TerminalIcon size={14} color="#ffffff" /> Output Terminal
                </button>

                <button
                  onClick={() => setActiveTab("stdin")}
                  style={{ backgroundColor: activeTab === "stdin" ? "#121215" : "transparent", border: "1px solid", borderColor: activeTab === "stdin" ? "#27272a" : "transparent", borderBottom: activeTab === "stdin" ? "none" : "transparent", color: activeTab === "stdin" ? "#ffffff" : "#a1a1aa", padding: "4px 12px", borderRadius: "6px 6px 0 0", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <MessageSquare size={14} color="#a1a1aa" /> Custom Stdin Input
                </button>

                {isDsaMode && problem && (
                  <button
                    onClick={() => setActiveTab("tests")}
                    style={{ backgroundColor: activeTab === "tests" ? "#121215" : "transparent", border: "1px solid", borderColor: activeTab === "tests" ? "#27272a" : "transparent", borderBottom: activeTab === "tests" ? "none" : "transparent", color: activeTab === "tests" ? "#ffffff" : "#a1a1aa", padding: "4px 12px", borderRadius: "6px 6px 0 0", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <CheckCircle size={14} color="#a1a1aa" /> Test Results
                  </button>
                )}
              </div>

              <div style={{ fontSize: "11px", color: "#a1a1aa" }}>
                Docker Sandbox Console
              </div>
            </div>

            <div style={{ flex: 1, padding: "14px 18px", overflowY: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", lineHeight: "1.6", color: "#ffffff" }}>
              {activeTab === "output" ? (
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {output || "Output will appear here after clicking Run Code..."}
                </pre>
              ) : activeTab === "stdin" ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <label style={{ display: "block", fontSize: "11px", color: "#a1a1aa", marginBottom: "6px", fontWeight: "bold" }}>
                    ENTER PROGRAM INPUT (ENTER INPUT VALUES HERE BEFORE CLICKING RUN CODE):
                  </label>
                  <textarea
                    value={stdinInput}
                    onChange={(e) => setStdinInput(e.target.value)}
                    placeholder="Type custom program input values here (one per line)...&#10;e.g.&#10;5&#10;10 20 30 40 50"
                    style={{ flex: 1, width: "100%", boxSizing: "border-box", backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: "8px", padding: "10px", color: "#ffffff", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", outline: "none", resize: "none" }}
                  />
                </div>
              ) : (
                <div style={{ height: "100%" }}>
                  {submitting ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#a1a1aa" }}>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Running your solution against the test cases...</span>
                    </div>
                  ) : submitError ? (
                    <div style={{ color: "#f87171" }}>{submitError}</div>
                  ) : submitResults ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontWeight: "700",
                          color: submitResults.passed ? "#4ade80" : "#f87171",
                        }}
                      >
                        {submitResults.passed ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        <span>
                          {submitResults.passedCount}/{submitResults.totalTestCases} test cases passed
                        </span>
                      </div>

                      {(submitResults.scoreCard || []).map((tc) => (
                        <div
                          key={tc.testCaseIndex}
                          style={{
                            border: "1px solid #27272a",
                            borderRadius: "8px",
                            padding: "10px 12px",
                            backgroundColor: "#0c0c0e",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", color: tc.passed ? "#4ade80" : "#f87171", marginBottom: "6px" }}>
                            {tc.passed ? <CheckCircle size={13} /> : <XCircle size={13} />}
                            <span>Test Case {tc.testCaseIndex}</span>
                          </div>
                          {!tc.isHidden && (
                            <div style={{ fontSize: "12px", color: "#a1a1aa", display: "flex", flexDirection: "column", gap: "2px" }}>
                              <span>Input: {tc.input}</span>
                              <span>Expected: {tc.expectedOutput}</span>
                              <span>Got: {tc.actualOutput}</span>
                            </div>
                          )}
                          {tc.error && (
                            <div style={{ fontSize: "12px", color: "#f87171", marginTop: "4px" }}>Error: {tc.error}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: "#a1a1aa" }}>
                      Click "Submit" to run your solution against this problem's test cases.
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* GEMINI AI ASSISTANCE DRAWER */}
      {aiDrawerOpen && (
        <div style={{ width: "420px", backgroundColor: "#121215", borderLeft: "1px solid #27272a", display: "flex", flexDirection: "column", zIndex: 30 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #27272a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
              <Bot size={18} color="#ffffff" /> Gemini AI Assistant
            </h3>
            <button onClick={() => setAiDrawerOpen(false)} style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer" }}>
              ✕
            </button>
          </div>

          <div style={{ padding: "10px 18px", borderBottom: "1px solid #27272a", display: "flex", gap: "10px", backgroundColor: "#0c0c0e" }}>
            <button
              onClick={() => handleAIReview("hints")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: "700",
                cursor: "pointer",
                backgroundColor: aiMode === "hints" && aiAnalysis ? "#ffffff" : "#121215",
                color: aiMode === "hints" && aiAnalysis ? "#09090b" : "#a1a1aa",
                border: aiMode === "hints" && aiAnalysis ? "none" : "1px solid #27272a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.2s ease"
              }}
            >
              <Sparkles size={14} /> 💡 Get Hints
            </button>

            <button
              onClick={() => handleAIReview("analysis")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: "700",
                cursor: "pointer",
                backgroundColor: aiMode === "analysis" && aiAnalysis ? "#ffffff" : "#121215",
                color: aiMode === "analysis" && aiAnalysis ? "#09090b" : "#a1a1aa",
                border: aiMode === "analysis" && aiAnalysis ? "none" : "1px solid #27272a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.2s ease"
              }}
            >
              <TerminalIcon size={14} /> 📊 Complexity Analysis
            </button>
          </div>

          <div style={{ flex: 1, padding: "18px", overflowY: "auto", fontSize: "13px", lineHeight: "1.6" }}>
            {aiLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "12px", color: "#a1a1aa" }}>
                <Loader2 size={28} className="animate-spin" color="#ffffff" />
                <span>{aiMode === "hints" ? "Formulating GFG-style hint..." : "Evaluating Big-O complexity of your code..."}</span>
              </div>
            ) : aiAnalysis ? (
              <div className="markdown-body" style={{ color: "#ffffff" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiAnalysis}</ReactMarkdown>
              </div>
            ) : (
              <div style={{ padding: "40px 16px", textAlign: "center", color: "#a1a1aa", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <Bot size={32} color="#52525b" />
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "700", color: "#ffffff" }}>Gemini AI Assistant</h4>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#a1a1aa" }}>
                    Select an option above to generate a short GFG-style hint or analyze your code's Big-O complexity.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}