"use client";

import { motion } from "framer-motion";
import { User } from "lucide-react";
import WaveLogo from "./WaveLogo";
import ReactMarkdown from "react-markdown";

interface Props { role: "user" | "agent"; text: string; }

export default function ChatMessage({ role, text }: Props) {
  const isUser = role === "user";
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
      <motion.div
        className={`rounded-xl px-4 py-3 text-sm leading-relaxed flex-1 prose prose-invert prose-sm max-w-none
          prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-white
          prose-headings:text-white prose-headings:font-semibold
          ${isUser
            ? "bg-[#27272a] text-zinc-100 rounded-tr-sm border border-zinc-700"
            : "bg-[#18181b] text-zinc-100 rounded-tl-sm border border-zinc-700/60"
          }`}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut", delay: 0.05 }}
      >
        <ReactMarkdown>{text}</ReactMarkdown>
      </motion.div>
    </motion.div>
  );
}
