"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Database, Zap, BarChart3, BookMarked, ChevronRight } from "lucide-react";
import WaveLogo from "./WaveLogo";
import { BusinessProfile } from "@/lib/api";

interface Props {
  onDone: (business: BusinessProfile) => void;
}

const FEATURES = [
  { icon: BarChart3,  label: "Crowd Intelligence",  desc: "Live match schedules + fan forecasts from MongoDB Atlas" },
  { icon: Zap,        label: "Campaign Generation",  desc: "Targeted social, email & SMS campaigns in seconds" },
  { icon: BookMarked, label: "Ops Planning",         desc: "Staffing levels & inventory boosts per match day" },
  { icon: Database,   label: "Persistent Memory",    desc: "Everything saved to your MongoDB Atlas database" },
];

const BIZ_TYPES = ["Restaurant", "Bar", "Retail", "Hotel", "Food Truck", "Other"];

const HOST_CITIES = [
  "East Rutherford, NJ", "Los Angeles, CA", "Dallas, TX",
  "San Francisco, CA", "Miami, FL", "Atlanta, GA",
  "Seattle, WA", "Houston, TX", "Philadelphia, PA",
  "Kansas City, MO", "Boston, MA",
  "Vancouver, BC", "Toronto, ON",
  "Mexico City, MX", "Guadalajara, MX", "Monterrey, MX",
];

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 40 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -40 }),
};

export default function IntroModal({ onDone }: Props) {
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState<BusinessProfile>({ name: "", type: "", city: "", capacity: "" });

  const goNext = () => { setDir(1); setStep(2); };
  const goBack = () => { setDir(-1); setStep(1); };

  const set = (k: keyof BusinessProfile, v: string) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.name.trim() && form.type && form.city;

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
        <div className="bg-[#3b5bdb] px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <WaveLogo size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-black text-base leading-tight">World Cup Biz AI</h2>
            <p className="text-blue-200 text-[11px]">Google Cloud Rapid Agent Hackathon · MongoDB</p>
          </div>
          {/* Step dots */}
          <div className="flex gap-1.5 items-center mr-2">
            {[1, 2].map(s => (
              <div key={s} className={`rounded-full transition-all ${s === step ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30"}`} />
            ))}
          </div>
          {step === 1 && (
            <button onClick={() => onDone({ name: "Guest", type: "Other", city: HOST_CITIES[0], capacity: "" })}
              className="text-white/40 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Animated step body */}
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>
            {step === 1 ? (
              <motion.div
                key="step1"
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="px-6 py-5"
              >
                <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                  An AI agent that helps local businesses near{" "}
                  <span className="text-white font-semibold">FIFA World Cup 2026</span> venues
                  maximize revenue on match days — powered by{" "}
                  <span className="text-[#748ffc] font-semibold">Gemini 2.5</span> and{" "}
                  <span className="text-green-400 font-semibold">MongoDB Atlas</span>.
                </p>
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {FEATURES.map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="bg-[#18181b] border border-[#3f3f46] rounded-xl p-3">
                      <div className="w-6 h-6 rounded-lg bg-[#3b5bdb]/20 flex items-center justify-center mb-1.5">
                        <Icon className="w-3 h-3 text-[#748ffc]" />
                      </div>
                      <p className="text-white text-xs font-semibold mb-0.5">{label}</p>
                      <p className="text-zinc-500 text-[10px] leading-snug">{desc}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-white mb-5">
                  <span>🇺🇸 USA</span><span className="text-zinc-600">·</span>
                  <span>🇨🇦 Canada</span><span className="text-zinc-600">·</span>
                  <span>🇲🇽 Mexico</span><span className="text-zinc-600">·</span>
                  <span>11 June – 19 July 2026</span>
                </div>
                <button onClick={goNext}
                  className="w-full bg-[#3b5bdb] hover:bg-[#4c6ef5] text-white font-bold text-sm rounded-xl py-3 transition-colors flex items-center justify-center gap-2">
                  Set up your business <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="px-6 py-5"
              >
                <p className="text-zinc-400 text-xs mb-4">Tell us about your business and we'll tailor everything to you.</p>

                {/* Business name */}
                <div className="mb-4">
                  <label className="text-zinc-400 text-xs font-semibold mb-1.5 block">Business name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                    placeholder="e.g. Touchdown Tacos"
                    className="w-full bg-[#18181b] border border-[#3f3f46] focus:border-[#3b5bdb] focus:ring-1 focus:ring-[#3b5bdb] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                  />
                </div>

                {/* Business type */}
                <div className="mb-4">
                  <label className="text-zinc-400 text-xs font-semibold mb-1.5 block">Type *</label>
                  <div className="flex flex-wrap gap-2">
                    {BIZ_TYPES.map(t => (
                      <button key={t} onClick={() => set("type", t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          form.type === t
                            ? "bg-[#3b5bdb] border-[#3b5bdb] text-white"
                            : "bg-[#18181b] border-[#3f3f46] text-zinc-400 hover:border-zinc-500"
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Venue city */}
                <div className="mb-4">
                  <label className="text-zinc-400 text-xs font-semibold mb-1.5 block">Nearest World Cup venue *</label>
                  <select
                    value={form.city}
                    onChange={e => set("city", e.target.value)}
                    className="w-full bg-[#18181b] border border-[#3f3f46] focus:border-[#3b5bdb] rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-all appearance-none"
                  >
                    <option value="" disabled>Select a host city...</option>
                    {HOST_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Capacity (optional) */}
                <div className="mb-5">
                  <label className="text-zinc-400 text-xs font-semibold mb-1.5 block">Seating capacity <span className="text-zinc-600 font-normal">(optional)</span></label>
                  <input
                    type="number"
                    value={form.capacity}
                    onChange={e => set("capacity", e.target.value)}
                    placeholder="e.g. 80"
                    className="w-full bg-[#18181b] border border-[#3f3f46] focus:border-[#3b5bdb] focus:ring-1 focus:ring-[#3b5bdb] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={goBack}
                    className="px-4 py-3 rounded-xl border border-[#3f3f46] text-zinc-400 hover:text-white text-sm transition-colors">
                    Back
                  </button>
                  <button
                    onClick={() => valid && onDone(form)}
                    disabled={!valid}
                    className="flex-1 bg-[#3b5bdb] hover:bg-[#4c6ef5] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl py-3 transition-colors">
                    Start →
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
