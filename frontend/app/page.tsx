"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator";
import { sendMessage, resetSession } from "@/lib/api";
import { Send, RotateCcw, CalendarDays, Megaphone, Users, Zap } from "lucide-react";
import WaveLogo from "@/components/WaveLogo";

const SESSION_ID = `session_${Math.random().toString(36).slice(2)}`;

const SUGGESTIONS = [
  { icon: CalendarDays, label: "Match schedule", prompt: "What matches are coming to East Rutherford, NJ?" },
  { icon: Megaphone,    label: "Run a campaign",  prompt: "Create a social media campaign for Touchdown Tacos on June 14th" },
  { icon: Users,        label: "Staffing plan",   prompt: "How should The Pitch Bar staff up for the Germany vs Spain match?" },
  { icon: Zap,          label: "Crowd forecast",  prompt: "What's the crowd forecast for Inglewood on June 20th?" },
];

const WELCOME = "Welcome to **Match Day Commander**\n\nI help local businesses near FIFA World Cup 2026 venues maximize revenue on match days. I can:\n\n* Look up match schedules and crowd forecasts\n* Generate targeted marketing campaigns\n* Recommend staffing levels and inventory boosts\n* Save everything to your MongoDB Atlas database\n\nTry a suggestion below or describe your business and city.";

interface Message { id: string; role: "user" | "agent"; text: string; }

export default function Home() {
  const [messages, setMessages]         = useState<Message[]>([{ id: "w", role: "agent", text: WELCOME }]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [showSuggestions, setShowSugg]  = useState(true);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const submit = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setShowSugg(false);
    setInput("");
    setMessages(p => [...p, { id: Date.now().toString(), role: "user", text: text.trim() }]);
    setLoading(true);
    try {
      const reply = await sendMessage(text.trim(), SESSION_ID);
      setMessages(p => [...p, { id: Date.now() + "r", role: "agent", text: reply }]);
    } catch {
      setMessages(p => [...p, { id: Date.now() + "e", role: "agent", text: "Something went wrong — please try again." }]);
    } finally {
      setLoading(false);
      textRef.current?.focus();
    }
  }, [loading]);

  const handleReset = async () => {
    await resetSession(SESSION_ID);
    setMessages([{ id: "w", role: "agent", text: WELCOME }]);
    setShowSugg(true);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#09090b]">

      {/* ── Top bar (FIFA-style dark navy) ─────────────────── */}
      <div className="flex-shrink-0 bg-[#0f1923] border-b border-white/10 px-5 py-2 flex items-center gap-3">
        <WaveLogo size={22} className="text-white/70" />
        <span className="text-white font-black text-lg tracking-tight">FIFA WORLD CUP 2026™</span>
        <span className="ml-auto text-xs text-white/40">11 June – 19 July 2026 · USA · Canada · Mexico</span>
      </div>

      {/* ── Blue header band (FIFA-style) ──────────────────── */}
      <div className="flex-shrink-0 bg-[#3b5bdb] px-5 py-3 flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <WaveLogo size={26} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-black text-xl tracking-tight leading-none">Match Day Commander</h1>
            <p className="text-blue-200 text-xs mt-0.5">AI agent for local businesses near World Cup venues · Gemini 2.5 + MongoDB Atlas</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm text-white">
          {[["16", "Host Cities"], ["104", "Matches"], ["5M+", "Expected Fans"], ["$1B", "Prize Fund"]].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="font-black text-lg leading-none">{v}</div>
              <div className="text-blue-200 text-[10px] uppercase tracking-wide">{l}</div>
            </div>
          ))}
        </div>
        <button onClick={handleReset} className="text-white/60 hover:text-white transition-colors ml-2" title="New chat">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Messages ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto chat-scroll px-6 py-6">
        <div className="flex flex-col gap-4">
          {messages.map(m => <ChatMessage key={m.id} role={m.role} text={m.text} />)}
          {loading && <TypingIndicator />}

          {showSuggestions && !loading && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => submit(prompt)}
                  className="group text-left rounded-lg border border-[#3f3f46] bg-[#18181b] hover:border-[#3b5bdb] hover:bg-[#1e2040] transition-all p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-md bg-[#3b5bdb]/20 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-[#748ffc]" />
                    </div>
                    <span className="text-xs font-semibold text-white">{label}</span>
                  </div>
                  <p className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors leading-relaxed">{prompt}</p>
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-[#27272a] bg-[#09090b] px-6 py-4">
        <div className="flex gap-3 items-end">
          <textarea
            ref={textRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); } }}
            onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }}
            placeholder="Ask about matches, campaigns, staffing..."
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-lg border border-[#3f3f46] bg-[#18181b] text-white placeholder:text-zinc-500 text-sm px-4 py-3 focus:outline-none focus:border-[#3b5bdb] focus:ring-1 focus:ring-[#3b5bdb] transition-all disabled:opacity-50 max-h-[120px] leading-relaxed"
          />
          <button
            onClick={() => submit(input)}
            disabled={loading || !input.trim()}
            className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#3b5bdb] hover:bg-[#4c6ef5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-center text-[10px] text-zinc-600 mt-2">Google Cloud Rapid Agent Hackathon 2026 · MongoDB Partner Track</p>
      </div>
    </div>
  );
}
