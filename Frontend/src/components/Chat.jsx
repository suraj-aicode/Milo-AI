import React, { useState, useEffect, useRef } from "react";
import { getRandomPrompts } from "../data/quickPrompts";
import { chatApi } from "../services/api";

const LOGO_IMG = (
  <img src="/logo.svg" alt="MILO Logo" className="w-full h-full object-contain" />
);

export default function Chat({ user, onLogout, isDarkMode, toggleDarkMode }) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileUsage, setFileUsage] = useState({ uploads_today: 0, limit: 2, remaining: 2 });
  const [fileError, setFileError] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [quickPrompts, setQuickPrompts] = useState([]);

  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // On initial login/mount: load recent chats list, randomize quick prompts, load file usage
  useEffect(() => {
    if (user?.token) {
      fetchRecentChats();
      fetchFileUsage();
      setQuickPrompts(getRandomPrompts(6));
      setActiveSessionId(null);
      setMessages([
        {
          id: "welcome-init",
          sender: "assistant",
          text: `Hello ${user?.name || ""}! I'm MILO. Ask me anything to start a conversation!`,
        },
      ]);
    }
  }, [user]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const fetchRecentChats = async () => {
    try {
      const data = await chatApi.listChats(user.token);
      setRecentChats(data);
    } catch (err) {
      console.error("Failed to load recent chats:", err);
    }
  };

  const fetchFileUsage = async () => {
    try {
      const data = await chatApi.getFileUsage(user.token);
      setFileUsage(data);
    } catch (err) {
      console.error("Failed to fetch file usage:", err);
    }
  };

  const loadChatSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    setSelectedFile(null);
    setFileError("");
    try {
      const data = await chatApi.getMessages(user.token, sessionId);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load session messages:", err);
    }
  };

  const handleNewChat = () => {
    setQuickPrompts(getRandomPrompts(6));
    setSelectedFile(null);
    setFileError("");
    setPrompt("");
    setActiveSessionId(null);
    setMessages([
      {
        id: "welcome-new",
        sender: "assistant",
        text: `Started a new chat! What would you like to explore?`,
      },
    ]);
  };

  const handleDeleteChat = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await chatApi.deleteChat(user.token, sessionId);
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
      fetchRecentChats();
    } catch (err) {
      console.error("Failed to delete chat session:", err);
    }
  };

  const handleAttachClick = () => {
    setFileError("");
    if (fileUsage.uploads_today >= 2 || fileUsage.remaining <= 0) {
      setFileError("Daily file upload limit reached (2/2 for today). You can upload files again tomorrow.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileUsage.uploads_today >= 2) {
      setFileError("Daily file upload limit reached (2/2 for today). You can upload files again tomorrow.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        content: event.target.result,
      });
      setFileError("");
    };

    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSend = async () => {
    const trimmedPrompt = prompt.trim();
    if ((!trimmedPrompt && !selectedFile) || isLoading) return;

    if (selectedFile && fileUsage.uploads_today >= 2) {
      setFileError("Daily file upload limit reached (2/2 for today). You can upload files again tomorrow.");
      return;
    }

    const displayMsgText = selectedFile
      ? `📎 ${selectedFile.name}\n${trimmedPrompt}`
      : trimmedPrompt;

    const userMsg = {
      id: Date.now().toString(),
      sender: "user",
      text: displayMsgText,
    };

    setMessages((prev) => [...prev, userMsg]);

    const payload = {
      prompt: trimmedPrompt,
      session_id: activeSessionId,
      file_name: selectedFile?.name || null,
      file_content: selectedFile?.content || null,
    };

    const isUploadingFile = !!selectedFile;
    setPrompt("");
    setSelectedFile(null);
    setFileError("");
    setApiKeyError("");
    setIsLoading(true);

    try {
      const data = await chatApi.generate(user.token, payload);

      if (data.session_id) {
        setActiveSessionId(data.session_id);
      }

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: data.response || "No response generated.",
      };
      setMessages((prev) => [...prev, aiMsg]);
      fetchRecentChats();
      if (isUploadingFile) {
        fetchFileUsage();
      }
    } catch (err) {
      console.error(err);
      const errorMsgText =
        err.response?.data?.detail ||
        "Unable to process request with Gemini backend API. Please check your backend connection.";

      if (errorMsgText.includes("Daily file upload limit")) {
        setFileError(errorMsgText);
      } else if (errorMsgText.includes("credits or quota exhausted") || err.response?.status === 429) {
        setApiKeyError("⚠️ API Key credits or quota exhausted. Please update your GEMINI_API_KEY in the backend environment.");
      } else if (errorMsgText.includes("Invalid or unauthorized") || err.response?.status === 401) {
        setApiKeyError("⚠️ Invalid or unauthorized GEMINI_API_KEY. Please verify your API key in the backend environment.");
      }

      const errorMsg = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        isError: true,
        text: errorMsgText,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-on-surface bg-[#f8f9ff] dark:bg-[#242423] transition-colors duration-300">
      <div className="liquid-bg"></div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
        accept=".txt,.csv,.json,.py,.js,.html,.css,.md,.xml,.sql,.pdf"
      />

      {/* SideNavBar (280px) */}
      <aside className="w-[280px] h-screen flex flex-col py-md px-sm z-50 glass-surface border-r border-white/40 dark:border-white/10 flex-shrink-0">
        <div className="px-sm mb-lg">
          <div className="flex items-center gap-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden p-0.5">
              {LOGO_IMG}
            </div>
            <div>
              <h1 className="font-headline-md text-headline-md font-bold text-on-surface">
                MILO AI
              </h1>
              <p className="font-label-md text-label-md text-on-surface-variant">
                Personal Assistant
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleNewChat}
          className="flex items-center justify-center gap-base w-full p-3 mb-md bg-primary/10 text-primary font-bold rounded-xl border border-primary/20 hover:translate-x-1 transition-all active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined">add_box</span>
          <span className="font-label-md text-label-md">New Chat</span>
        </button>

        {/* Recent Chats Section */}
        <nav className="flex-1 space-y-xs overflow-y-auto hide-scrollbar">
          <div className="px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant/70">
            Recent Chats
          </div>

          {recentChats.length === 0 ? (
            <div className="px-3 py-2 text-xs text-on-surface-variant/60 italic">
              No recent conversations
            </div>
          ) : (
            recentChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => loadChatSession(chat.id)}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                  activeSessionId === chat.id
                    ? "bg-primary/15 text-primary font-bold border border-primary/20"
                    : "text-on-surface-variant hover:bg-white/30 dark:hover:bg-white/5 hover:translate-x-1"
                }`}
              >
                <div className="flex items-center gap-sm truncate">
                  <span className="material-symbols-outlined text-sm">chat_bubble_outline</span>
                  <span className="font-label-md text-label-md truncate max-w-[160px]">
                    {chat.title}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDeleteChat(e, chat.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity cursor-pointer"
                  title="Delete Chat"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            ))
          )}
        </nav>

        {/* Bottom Navigation & Profile */}
        <div className="mt-auto space-y-xs pt-md border-t border-white/20 dark:border-white/10">
          <button
            onClick={toggleDarkMode}
            className="flex items-center gap-sm w-full p-3 rounded-xl text-on-surface-variant hover:bg-white/30 dark:hover:bg-white/5 transition-all text-left cursor-pointer"
          >
            <span className="material-symbols-outlined">
              {isDarkMode ? "light_mode" : "dark_mode"}
            </span>
            <span className="font-label-md text-label-md">
              {isDarkMode ? "Light Theme" : "Dark Theme"}
            </span>
          </button>

          <div
            onClick={onLogout}
            title="Click to Logout"
            className="flex items-center justify-between p-3 mt-sm rounded-xl hover:bg-white/40 dark:hover:bg-white/10 cursor-pointer transition-all border border-transparent hover:border-white/30"
          >
            <div className="flex items-center gap-sm">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/20 bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex flex-col truncate max-w-[120px]">
                <span className="font-label-md text-label-md truncate">
                  {user?.name || "User"}
                </span>
                <span className="text-[10px] text-on-surface-variant truncate">
                  {user?.email}
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-sm" title="Logout">
              logout
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* TopNavBar */}
        <header className="h-20 glass-surface border-b border-white/40 dark:border-white/10 flex justify-between items-center px-margin-desktop z-40 flex-shrink-0">
          <div className="flex items-center gap-lg">
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
              MILO AI
            </h2>
            <span className="px-3 py-1 rounded-full text-xs bg-primary/10 text-primary font-semibold border border-primary/20 flex items-center gap-1">
              <span>Files Today: {fileUsage.uploads_today}/2 used</span>
            </span>
          </div>

          <div className="flex items-center gap-sm">
            <button
              onClick={toggleDarkMode}
              className="p-2 text-on-surface-variant hover:bg-white/30 dark:hover:bg-white/10 rounded-full transition-all cursor-pointer"
              title="Toggle Dark Mode"
            >
              <span className="material-symbols-outlined">
                {isDarkMode ? "light_mode" : "dark_mode"}
              </span>
            </button>
            <button
              onClick={() => setShowInfoPanel(!showInfoPanel)}
              className="p-2 text-on-surface-variant hover:bg-white/30 dark:hover:bg-white/10 rounded-full transition-all cursor-pointer"
              title="Toggle Info Panel"
            >
              <span className="material-symbols-outlined">
                {showInfoPanel ? "dock_to_right" : "more_vert"}
              </span>
            </button>
          </div>
        </header>

        {/* Conversation Stream */}
        <section className="flex-1 overflow-y-auto px-margin-desktop pt-xl pb-[150px] space-y-lg hide-scrollbar flex flex-col items-center">
          <div className="w-full max-w-4xl space-y-lg">
            {messages.map((msg) =>
              msg.sender === "assistant" ? (
                <div key={msg.id} className="flex gap-md message-fade-in">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl glass-surface flex items-center justify-center p-1">
                    <div className="w-6 h-6">{LOGO_IMG}</div>
                  </div>
                  <div
                    className={`glass-surface p-md rounded-2xl rounded-tl-none max-w-[85%] border ${
                      msg.isError
                        ? "border-red-500/50 bg-red-500/10 text-red-500"
                        : "border-white/50 dark:border-white/10 text-on-surface"
                    }`}
                  >
                    <p className="font-body-md text-body-md whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex gap-md justify-end message-fade-in">
                  <div className="bg-primary-container/40 dark:bg-primary/20 backdrop-blur-xl p-md rounded-2xl rounded-tr-none max-w-[80%] border border-primary/20 text-on-primary-container dark:text-primary-fixed shadow-sm">
                    <p className="font-body-md text-body-md whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </p>
                  </div>
                </div>
              )
            )}

            {isLoading && (
              <div className="flex gap-md message-fade-in">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl glass-surface flex items-center justify-center p-1">
                  <div className="w-6 h-6">{LOGO_IMG}</div>
                </div>
                <div className="glass-surface p-md rounded-2xl rounded-tl-none border border-white/50 dark:border-white/10 flex items-center gap-2">
                  <span className="font-body-md text-body-md text-on-surface-variant italic">
                    MILO is analyzing and responding...
                  </span>
                  <div className="w-2 h-2 rounded-full bg-primary animate-ping"></div>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>
        </section>

        {/* Floating Glass Input Bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-md z-50">
          {/* API Key Credit Exhaustion Banner */}
          {apiKeyError && (
            <div className="mb-2 p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-500 dark:text-red-400 text-xs font-bold backdrop-blur-md flex items-center justify-between shadow-lg message-fade-in">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">warning</span>
                <span>{apiKeyError}</span>
              </div>
              <button
                onClick={() => setApiKeyError("")}
                className="hover:text-red-700 font-bold ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Daily Limit Error Banner */}
          {fileError && (
            <div className="mb-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold backdrop-blur-md flex items-center justify-between message-fade-in">
              <span>{fileError}</span>
              <button
                onClick={() => setFileError("")}
                className="hover:text-red-700 font-bold ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* File Badge Preview */}
          {selectedFile && (
            <div className="mb-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 backdrop-blur-md text-xs font-semibold message-fade-in">
              <span className="material-symbols-outlined text-sm">attach_file</span>
              <span className="truncate max-w-[200px]">{selectedFile.name}</span>
              <span className="text-on-surface-variant/60">({selectedFile.size})</span>
              <button
                onClick={() => setSelectedFile(null)}
                className="ml-1 hover:text-red-500 transition-colors cursor-pointer"
                title="Remove file"
              >
                ✕
              </button>
            </div>
          )}

          <div className="glass-surface rounded-[30px] p-2 flex items-center gap-sm border border-white/60 dark:border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.1)] group transition-all hover:shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
            <button
              onClick={handleAttachClick}
              className={`p-3 transition-colors cursor-pointer ${
                fileUsage.uploads_today >= 2
                  ? "text-red-400 hover:text-red-500"
                  : "text-on-surface-variant hover:text-primary"
              }`}
              title={
                fileUsage.uploads_today >= 2
                  ? "Daily file limit reached (2/2)"
                  : `Attach File (Used ${fileUsage.uploads_today}/2 today)`
              }
            >
              <span className="material-symbols-outlined">attach_file</span>
            </button>
            <input
              className="flex-1 bg-transparent border-none focus:ring-0 font-body-md text-body-md text-on-surface placeholder-on-surface-variant/50 outline-none"
              placeholder={
                selectedFile
                  ? `Ask something about ${selectedFile.name}...`
                  : "Ask anything to MILO or attach a file..."
              }
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <div className="flex items-center gap-xs px-2">
              <button
                className="p-2 text-on-surface-variant hover:bg-white/40 dark:hover:bg-white/10 rounded-full transition-all cursor-pointer"
                title="Voice Input"
              >
                <span className="material-symbols-outlined">mic</span>
              </button>
              <button
                onClick={handleSend}
                disabled={isLoading || (!prompt.trim() && !selectedFile)}
                className={`w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/30 transition-all ${
                  isLoading || (!prompt.trim() && !selectedFile)
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:scale-105 active:scale-95 cursor-pointer"
                }`}
                title="Send Message"
              >
                <span className="material-symbols-outlined">arrow_upward</span>
              </button>
            </div>
          </div>
          <p className="text-center font-label-sm text-label-sm text-on-surface-variant/50 mt-sm">
            Files Today: {fileUsage.uploads_today}/2 used. MILO AI with File Attachments & 2h Session.
          </p>
        </div>
      </main>

      {/* Collapsible Right Info Panel */}
      {showInfoPanel && (
        <aside className="w-[320px] h-screen glass-surface border-l border-white/40 dark:border-white/10 flex flex-col transition-all duration-500 hidden lg:flex flex-shrink-0 z-40">
          <div className="p-md border-b border-white/20 dark:border-white/10 flex justify-between items-center">
            <h3 className="font-label-md text-label-md font-bold uppercase tracking-wider text-on-surface-variant">
              Session Info
            </h3>
            <button
              onClick={() => setShowInfoPanel(false)}
              className="p-1 hover:bg-white/30 dark:hover:bg-white/10 rounded-full transition-all cursor-pointer"
              title="Close Panel"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-md space-y-lg hide-scrollbar">
            {/* Model Card */}
            <div className="space-y-sm">
              <label className="font-label-sm text-label-sm text-on-surface-variant/60">
                Current Model
              </label>
              <div className="flex items-center gap-sm p-sm rounded-xl bg-primary/5 border border-primary/10">
                <span className="material-symbols-outlined text-primary">
                  auto_awesome
                </span>
                <span className="font-label-md text-label-md font-bold">
                  MILO 2.5 Flash
                </span>
              </div>
            </div>

            {/* Daily File Upload Quota Card */}
            <div className="space-y-sm">
              <label className="font-label-sm text-label-sm text-on-surface-variant/60">
                Daily File Quota
              </label>
              <div className="p-sm rounded-xl bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10 text-xs space-y-1">
                <div className="flex justify-between items-center font-bold text-on-surface">
                  <span>File Uploads Today</span>
                  <span className={fileUsage.uploads_today >= 2 ? "text-red-400" : "text-primary"}>
                    {fileUsage.uploads_today}/2
                  </span>
                </div>
                <div className="w-full bg-white/40 dark:bg-white/10 rounded-full h-2 overflow-hidden mt-1">
                  <div
                    className={`h-full transition-all ${
                      fileUsage.uploads_today >= 2 ? "bg-red-500" : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(100, (fileUsage.uploads_today / 2) * 100)}%` }}
                  ></div>
                </div>
                <div className="text-[10px] text-on-surface-variant">
                  {fileUsage.uploads_today >= 2
                    ? "Quota reached for today. Resets tomorrow."
                    : `${fileUsage.remaining} upload(s) remaining for today.`}
                </div>
              </div>
            </div>

            {/* Randomized 100+ Quick Prompts */}
            <div className="space-y-sm">
              <div className="flex justify-between items-center">
                <label className="font-label-sm text-label-sm text-on-surface-variant/60">
                  Random Quick Prompts
                </label>
                <button
                  onClick={() => setQuickPrompts(getRandomPrompts(6))}
                  className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1"
                  title="Shuffle prompts"
                >
                  <span className="material-symbols-outlined text-xs">refresh</span> Shuffle
                </button>
              </div>
              <div className="flex flex-wrap gap-xs">
                {quickPrompts.map((topic, idx) => (
                  <span
                    key={idx}
                    onClick={() => setPrompt(topic)}
                    className="px-3 py-1.5 rounded-xl bg-white/40 dark:bg-white/10 border border-white/60 dark:border-white/15 text-xs font-medium cursor-pointer hover:bg-primary/15 hover:text-primary transition-all text-on-surface"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>


          </div>
        </aside>
      )}
    </div>
  );
}
