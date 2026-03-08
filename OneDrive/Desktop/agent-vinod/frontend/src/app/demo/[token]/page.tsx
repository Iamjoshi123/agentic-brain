"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { AgentStatus } from "@/types/api";

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "Ready",
  thinking: "Thinking...",
  checking_docs: "Checking documentation...",
  navigating: "Navigating...",
  showing_feature: "Showing feature...",
  escalated: "Connecting to sales team...",
  error: "Something went wrong",
};

export default function DemoPage() {
  const params = useParams();
  const token = params.token as string;

  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [browserActive, setBrowserActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startSession() {
    try {
      const s = await api.createSession({
        public_token: token,
        buyer_name: buyerName || undefined,
        buyer_email: buyerEmail || undefined,
        mode: "text",
      });
      setSession(s);
      setShowIntro(false);

      // Load welcome message
      const msgs = await api.getMessages(s.id);
      setMessages(msgs);
    } catch (e: any) {
      setError(e.message || "Failed to start session. Check that the demo link is valid.");
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !session || status !== "idle") return;

    const userMsg = input.trim();
    setInput("");

    // Optimistic update
    setMessages((prev) => [
      ...prev,
      { id: "temp-" + Date.now(), role: "user", content: userMsg, message_type: "text", created_at: new Date().toISOString() },
    ]);

    setStatus("thinking");

    try {
      const agentMsg = await api.sendMessage(session.id, userMsg);

      // Replace optimistic and add agent reply
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.id.startsWith("temp-"));
        return [...filtered, { id: "user-" + Date.now(), role: "user", content: userMsg, message_type: "text", created_at: new Date().toISOString() }, agentMsg];
      });

      // Check if there's a demo action
      if (agentMsg.planner_decision === "answer_and_demo" && browserActive) {
        setStatus("showing_feature");
        // Poll for new screenshot
        try {
          const ss = await api.getScreenshot(session.id);
          setScreenshot(ss.screenshot);
        } catch {
          // No screenshot available
        }
      } else if (agentMsg.planner_decision === "escalate") {
        setStatus("escalated");
        setTimeout(() => setStatus("idle"), 3000);
        return;
      }

      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setMessages((prev) => [
        ...prev,
        { id: "error-" + Date.now(), role: "system", content: "Failed to get response. Please try again.", message_type: "text", created_at: new Date().toISOString() },
      ]);
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  async function handleStartBrowser() {
    if (!session) return;
    setStatus("navigating");
    try {
      await api.startBrowser(session.id);
      setBrowserActive(true);
      // Get initial screenshot
      try {
        const ss = await api.getScreenshot(session.id);
        setScreenshot(ss.screenshot);
      } catch {
        // Browser started but no screenshot yet
      }
      setStatus("idle");
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { id: "sys-" + Date.now(), role: "system", content: `Browser: ${e.message || "Could not start browser session."}`, message_type: "text", created_at: new Date().toISOString() },
      ]);
      setStatus("idle");
    }
  }

  async function handleEndSession() {
    if (!session) return;
    try {
      const result = await api.endSession(session.id);
      setMessages((prev) => [
        ...prev,
        { id: "end", role: "system", content: `Session ended. Lead intent score: ${result.summary?.lead_intent_score || "N/A"}`, message_type: "text", created_at: new Date().toISOString() },
      ]);
      setSession({ ...session, status: "ended" });
      setBrowserActive(false);
    } catch (e) {
      console.error("Failed to end session:", e);
    }
  }

  // Intro screen
  if (showIntro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center">
        <div className="card max-w-md w-full mx-4">
          <h1 className="text-2xl font-bold text-center mb-2">Product Demo</h1>
          <p className="text-gray-500 text-center mb-6 text-sm">
            Chat with our AI assistant to explore the product. You can ask questions and watch live walkthroughs.
          </p>
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
          )}
          <div className="space-y-3">
            <input
              className="input"
              placeholder="Your name (optional)"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Your email (optional)"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
            />
            <button onClick={startSession} className="btn-primary w-full py-3 text-lg">
              Start Demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isEnded = session?.status === "ended";

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900">Live Demo</h1>
          <p className="text-xs text-gray-400">
            {status !== "idle" && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {STATUS_LABELS[status]}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {!browserActive && !isEnded && (
            <button onClick={handleStartBrowser} className="btn-secondary text-sm">
              Start Live Demo
            </button>
          )}
          {!isEnded && (
            <button onClick={handleEndSession} className="btn-secondary text-sm text-red-600 border-red-200">
              End Session
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className={`flex flex-col ${browserActive ? "w-1/2" : "w-full max-w-3xl mx-auto"}`}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary-600 text-white rounded-br-md"
                    : msg.role === "system"
                    ? "bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-bl-md"
                    : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md"
                }`}>
                  {msg.role === "agent" && msg.planner_decision && (
                    <span className="text-xs text-gray-400 block mb-1">
                      {msg.planner_decision === "answer_and_demo" && "Answering + showing demo"}
                      {msg.planner_decision === "answer_only" && "From documentation"}
                      {msg.planner_decision === "escalate" && "Escalated to sales team"}
                      {msg.planner_decision === "refuse" && "Not available in demo"}
                      {msg.planner_decision === "clarify" && "Needs clarification"}
                    </span>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {!isEnded && (
            <form onSubmit={sendMessage} className="border-t border-gray-200 bg-white p-4">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder={status === "idle" ? "Ask about the product..." : STATUS_LABELS[status]}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={status !== "idle"}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!input.trim() || status !== "idle"}
                  className="btn-primary"
                >
                  Send
                </button>
              </div>
              <div className="flex gap-3 mt-2">
                {["Show me the dashboard", "How do I create a contact?", "What reports are available?"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => { setInput(q); }}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </form>
          )}
        </div>

        {/* Browser Viewport */}
        {browserActive && (
          <div className="w-1/2 border-l border-gray-200 bg-gray-900 flex flex-col">
            <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-gray-400 ml-2">Live Browser View</span>
              <button
                onClick={async () => {
                  try {
                    const ss = await api.getScreenshot(session.id);
                    setScreenshot(ss.screenshot);
                  } catch {}
                }}
                className="ml-auto text-xs text-gray-400 hover:text-white"
              >
                Refresh
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
              {screenshot ? (
                <img
                  src={`data:image/jpeg;base64,${screenshot}`}
                  alt="Browser view"
                  className="max-w-full max-h-full object-contain rounded"
                />
              ) : (
                <div className="text-gray-500 text-center">
                  <p className="text-lg mb-2">Browser view</p>
                  <p className="text-sm">Ask a question to see a live walkthrough</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
