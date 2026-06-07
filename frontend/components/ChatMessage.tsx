"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, ClipboardPlus } from "lucide-react";
import WaveLogo from "./WaveLogo";

interface Props { role: "user" | "agent"; text: string; }

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function formatText(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("* ")) {
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-[#748ffc] mt-1 text-xs leading-none">▸</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    }
    return line === ""
      ? <div key={i} className="h-2" />
      : <p key={i}>{renderInline(line)}</p>;
  });
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

async function addToNotes(text: string) {
  try {
    const userId = localStorage.getItem("wcbiz_user_id") ?? "anonymous";
    const res = await fetch(`${BASE}/api/notes?user_id=${userId}`);
    const { content } = await res.json();
    const separator = content ? "\n\n---\n\n" : "";
    await fetch(`${BASE}/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, content: content + separator + text }),
    });
  } catch {}
}

export default function ChatMessage({ role, text }: Props) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const handleAddToNotes = () => {
    addToNotes(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? "bg-[#27272a] border border-[#3f3f46]" : "bg-[#3b5bdb]"
      }`}>
        {isUser
          ? <User className="w-4 h-4 text-zinc-400" />
          : <WaveLogo size={20} className="text-white" />
        }
      </div>
      <div className="flex-1 group relative">
        <motion.div
          className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-[#27272a] text-zinc-100 rounded-tr-sm border border-zinc-700"
              : "bg-[#18181b] text-zinc-100 rounded-tl-sm border border-zinc-700/60"
          }`}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut", delay: 0.05 }}
        >
          {formatText(text)}
        </motion.div>
        {!isUser && (
          <button
            onClick={handleAddToNotes}
            className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#27272a] border border-[#3f3f46] text-zinc-400 hover:text-white text-[10px] px-2 py-0.5 rounded-full"
          >
            <ClipboardPlus className="w-2.5 h-2.5" />
            {copied ? "Added!" : "Add to notes"}
          </button>
        )}
      </div>
    </motion.div>
  );
}
