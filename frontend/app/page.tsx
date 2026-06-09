"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChatMessage from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator";
import IntroModal from "@/components/IntroModal";
import NotesSidebar from "@/components/NotesSidebar";
import { sendMessageStream, resetSession, setupBusiness, BusinessProfile } from "@/lib/api";
import { Send, CalendarDays, Megaphone, Users, Zap, Pencil, NotebookPen, BookMarked } from "lucide-react";
import WaveLogo from "@/components/WaveLogo";

const SESSION_ID = `session_${Math.random().toString(36).slice(2)}`;

const buildSuggestions = (biz?: BusinessProfile) => [
  { icon: CalendarDays, label: "Match schedule",  prompt: `Which World Cup matches are coming to ${biz?.city ?? "East Rutherford, NJ"} and how big are the crowds expected to be?` },
  { icon: Megaphone,    label: "Run a campaign",   prompt: `Brazil vs England is coming to ${biz?.city ?? "East Rutherford, NJ"} on June 14th. Create and save a social media campaign for ${biz?.name ?? "my business"}.` },
  { icon: Users,        label: "Staffing plan",    prompt: `There's a match at ${biz?.city ?? "East Rutherford, NJ"} this weekend with 80,000 fans. Create and save a full staffing plan for ${biz?.name ?? "my business"}.` },
  { icon: Zap,          label: "Crowd forecast",   prompt: `What's the fan breakdown for the next match in ${biz?.city ?? "East Rutherford, NJ"}? Which nationalities, peak hours, and what should ${biz?.name ?? "my business"} prepare for?` },
  { icon: BookMarked,   label: "Saved items",      prompt: `Show me everything saved for ${biz?.name ?? "my business"} — campaigns, staffing plans, and recommendations.` },
];

const buildWelcome = (biz?: BusinessProfile) =>
  biz
    ? `Welcome, **${biz.name}**!\n\nYou're all set. I know you run a **${biz.type}** near **${biz.city}**${biz.capacity ? ` with ${biz.capacity} seats` : ""}. I'll tailor everything to you.\n\n* Check upcoming matches and crowd forecasts for ${biz.city}\n* Generate and **save** campaigns and staffing plans to your account\n* Ask me to **show your saved items** anytime to retrieve them\n\nWhat do you want to prepare for first?`
    : `Welcome to **World Cup Biz AI**\n\nI help local businesses near FIFA World Cup 2026 venues maximize revenue on match days.\n\n* Look up match schedules and crowd forecasts\n* Generate and **save** marketing campaigns and staffing plans\n* Ask me to **show your saved items** anytime to retrieve them\n\nClick the input below and pick a suggestion, or describe your business and city.`;

interface Message { id: string; role: "user" | "agent"; text: string; }

export default function Home() {
  const [business, setBusiness]         = useState<BusinessProfile | undefined>();
  const [setupPending, setSetupPending] = useState(false);
  const [setupDone, setSetupDone]       = useState(false);
  const [connected, setConnected]       = useState(false);

  const runSetup = (biz: BusinessProfile) => {
    setSetupPending(true);
    const timeout = new Promise(res => setTimeout(res, 5000));
    Promise.race([setupBusiness(SESSION_ID, biz), timeout])
      .catch(() => {})
      .finally(() => {
        setSetupPending(false);
        setSetupDone(true);
        setConnected(true);
        setTimeout(() => setSetupDone(false), 4000);
      });
  };
  const [setupMsgIdx, setSetupMsgIdx]   = useState(0);

  const SETUP_MSGS = useMemo(() => [
    "Saving your business profile...",
    "Connecting to MongoDB Atlas...",
    "Loading World Cup match data...",
    "Personalizing your experience...",
  ], []);

  useEffect(() => {
    if (!setupPending) return;
    const t = setInterval(() => setSetupMsgIdx(i => (i + 1) % SETUP_MSGS.length), 1800);
    return () => clearInterval(t);
  }, [setupPending, SETUP_MSGS.length]);
  const [messages, setMessages]         = useState<Message[]>([{ id: "w", role: "agent", text: buildWelcome() }]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [toolSteps, setToolSteps]       = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotes, setShowNotes]       = useState(false);
  const [showIntro, setShowIntro]       = useState(false);
  const [hydrated, setHydrated]         = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textRef     = useRef<HTMLTextAreaElement>(null);
  const inputWrap   = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  // Read localStorage after mount to avoid SSR/client mismatch
  useEffect(() => {
    try {
      const s = localStorage.getItem("wcbiz_profile");
      const saved = s ? JSON.parse(s) as BusinessProfile : undefined;
      if (saved) {
        setBusiness(saved);
        setMessages([{ id: "w", role: "agent", text: buildWelcome(saved) }]);
        runSetup(saved);
      } else {
        setShowIntro(true);
      }
    } catch {
      setShowIntro(true);
    }
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputWrap.current && !inputWrap.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const submit = useCallback((text: string) => {
    if (!text.trim() || loading) return;
    setShowDropdown(false);
    setInput("");
    setMessages(p => [...p, { id: Date.now().toString(), role: "user", text: text.trim() }]);
    setLoading(true);
    setToolSteps([]);

    sendMessageStream(
      text.trim(),
      SESSION_ID,
      (name) => setToolSteps(p => [...p, name]),
      (reply) => {
        setMessages(p => [...p, { id: Date.now() + "r", role: "agent", text: reply }]);
        setLoading(false);
        setToolSteps([]);
        textRef.current?.focus();
      },
      () => {
        setMessages(p => [...p, { id: Date.now() + "e", role: "agent", text: "Something went wrong — please try again." }]);
        setLoading(false);
        setToolSteps([]);
      },
    );
  }, [loading]);

  const handleReset = async () => {
    await resetSession(SESSION_ID);
    setMessages([{ id: "w", role: "agent", text: buildWelcome(business) }]);
    setShowDropdown(false);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#09090b]">
      <AnimatePresence>
        {hydrated && showIntro && (
          <IntroModal initial={business} onClose={() => setShowIntro(false)} onDone={(biz) => {
            setShowIntro(false);
            setBusiness(biz);
            try { localStorage.setItem("wcbiz_profile", JSON.stringify(biz)); } catch {}
            setMessages([{ id: "w", role: "agent", text: buildWelcome(biz) }]);
            runSetup(biz);
          }} />
        )}
      </AnimatePresence>

      {/* ── Top bar ────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-[#0f1923] border-b border-white/10 px-5 py-2 flex items-center gap-3">
        <WaveLogo size={22} className="text-white/70" />
        <span className="text-white font-black text-lg tracking-tight">FIFA WORLD CUP 2026™</span>
        <span className="ml-auto text-xs text-white">11 June – 19 July 2026 · 🇺🇸 USA · 🇨🇦 Canada · 🇲🇽 Mexico</span>
      </div>

      {/* ── Blue header band ───────────────────────────────── */}
      <div className="flex-shrink-0 bg-[#3b5bdb] px-5 py-3 flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <WaveLogo size={26} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-black text-xl tracking-tight leading-none">
                {business ? business.name : "World Cup Biz AI"}
              </h1>
              {connected && !setupPending && (
                <span className="flex items-center gap-1 bg-green-500/20 border border-green-500/30 text-green-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Connected
                </span>
              )}
              {business && (
                <button onClick={() => setShowIntro(true)} className="text-white/40 hover:text-white transition-colors" title="Edit business details">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-blue-200 text-xs mt-0.5">
              {business
                ? `${business.type} · ${business.city} · Gemini 2.5 + MongoDB Atlas`
                : "AI agent for local businesses near World Cup venues · Gemini 2.5 + MongoDB Atlas"}
            </p>
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

        <button
          onClick={() => setShowNotes(n => !n)}
          className={`transition-colors ml-4 ${showNotes ? "text-white" : "text-white/60 hover:text-white"}`}
          title="Notes"
        >
          <NotebookPen className="w-4 h-4" />
        </button>
      </div>

      {/* ── Setup banner ───────────────────────────────────── */}
      <AnimatePresence>
        {(setupPending || setupDone) && (
          <motion.div
            className={`flex-shrink-0 flex items-center gap-2 px-5 py-2 border-b ${
              setupDone
                ? "bg-green-950/40 border-green-500/20"
                : "bg-[#1a2540] border-[#3b5bdb]/30"
            }`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {setupDone ? (
              <><span className="text-green-400 text-sm">✓</span>
              <span className="text-xs text-green-300 font-medium">Business profile saved to MongoDB Atlas — responses are now tailored to you.</span></>
            ) : (
              <><span className="w-3 h-3 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
              <AnimatePresence mode="wait">
                <motion.span
                  key={setupMsgIdx}
                  className="text-xs text-blue-300"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                >
                  {SETUP_MSGS[setupMsgIdx]}
                </motion.span>
              </AnimatePresence></>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chat + Notes ───────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
      {/* ── Messages ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto chat-scroll px-6 py-6">
        <div className="flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {messages.map(m => <ChatMessage key={m.id} role={m.role} text={m.text} />)}
            {loading && <TypingIndicator key="typing" steps={toolSteps} />}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-[#27272a] bg-[#09090b] px-6 py-4">
        <div className="relative flex gap-3 items-end" ref={inputWrap}>

          {/* Suggestions dropdown */}
          <AnimatePresence>
            {showDropdown && !loading && (
              <motion.div
                className="absolute bottom-full left-0 right-12 mb-2 bg-[#18181b] border border-[#3f3f46] rounded-xl overflow-hidden shadow-xl z-10"
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                {buildSuggestions(business).map(({ icon: Icon, label, prompt }) => (
                  <button
                    key={label}
                    onMouseDown={(e) => { e.preventDefault(); setInput(prompt); setShowDropdown(false); textRef.current?.focus(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#27272a] transition-colors text-left border-b border-[#3f3f46] last:border-0"
                  >
                    <div className="w-7 h-7 rounded-md bg-[#3b5bdb]/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3.5 h-3.5 text-[#748ffc]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white">{label}</p>
                      <p className="text-xs text-zinc-500 truncate">{prompt}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            ref={textRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={e => {
              if (e.key === "Escape") { setShowDropdown(false); return; }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); }
            }}
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
      </div>{/* end messages col */}

      {/* ── Notes sidebar ──────────────────────────────────── */}
      <AnimatePresence>
        {showNotes && <NotesSidebar onClose={() => setShowNotes(false)} />}
      </AnimatePresence>

      </div>{/* end chat + notes row */}
    </div>
  );
}
