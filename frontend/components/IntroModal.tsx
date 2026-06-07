"use client";

import { motion } from "framer-motion";
import { X, Database, Zap, BarChart3, BookMarked } from "lucide-react";
import WaveLogo from "./WaveLogo";

interface Props { onClose: () => void; }

const FEATURES = [
  { icon: BarChart3,  label: "Crowd Intelligence",    desc: "Live match schedules + fan forecasts from MongoDB Atlas" },
  { icon: Zap,        label: "Campaign Generation",    desc: "Targeted social, email & SMS campaigns in seconds" },
  { icon: BookMarked, label: "Operations Planning",    desc: "Staffing levels & inventory boosts per match day" },
  { icon: Database,   label: "Persistent Memory",      desc: "Everything saved to your MongoDB Atlas database" },
];

export default function IntroModal({ onClose }: Props) {
  return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onClose}
        />

        {/* Card */}
        <motion.div
          className="relative z-10 w-full max-w-md bg-[#0f1923] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          {/* Header stripe */}
          <div className="bg-[#3b5bdb] px-6 py-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <WaveLogo size={26} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg leading-tight">Match Day Commander</h2>
              <p className="text-blue-200 text-xs mt-0.5">Google Cloud Rapid Agent Hackathon · MongoDB Partner Track</p>
            </div>
            <button onClick={onClose} className="ml-auto text-white/50 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <p className="text-zinc-300 text-sm leading-relaxed mb-5">
              An AI agent that helps local businesses near{" "}
              <span className="text-white font-semibold">FIFA World Cup 2026</span> venues
              maximize revenue on match days — powered by{" "}
              <span className="text-[#748ffc] font-semibold">Gemini 2.5</span> and{" "}
              <span className="text-green-400 font-semibold">MongoDB Atlas</span>.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="bg-[#18181b] border border-[#3f3f46] rounded-xl p-3">
                  <div className="w-7 h-7 rounded-lg bg-[#3b5bdb]/20 flex items-center justify-center mb-2">
                    <Icon className="w-3.5 h-3.5 text-[#748ffc]" />
                  </div>
                  <p className="text-white text-xs font-semibold mb-0.5">{label}</p>
                  <p className="text-zinc-500 text-[11px] leading-snug">{desc}</p>
                </div>
              ))}
            </div>

            {/* Flags row */}
            <div className="flex items-center justify-center gap-2 text-xs text-white mb-5">
              <span>🇺🇸 USA</span>
              <span className="text-zinc-600">·</span>
              <span>🇨🇦 Canada</span>
              <span className="text-zinc-600">·</span>
              <span>🇲🇽 Mexico</span>
              <span className="text-zinc-600">·</span>
              <span>11 June – 19 July 2026</span>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-[#3b5bdb] hover:bg-[#4c6ef5] text-white font-bold text-sm rounded-xl py-3 transition-colors"
            >
              Start Commanding →
            </button>
          </div>
        </motion.div>
      </motion.div>
  );
}
