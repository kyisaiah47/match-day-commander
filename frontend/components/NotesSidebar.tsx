"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Trash2, Cloud, CloudOff, Loader } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
const USER_ID_KEY = "wcbiz_user_id";

function getUserId(): string {
  try {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

type SyncState = "idle" | "saving" | "saved" | "error";

interface Props { onClose: () => void; }

export default function NotesSidebar({ onClose }: Props) {
  const [notes, setNotes]       = useState("");
  const [sync, setSync]         = useState<SyncState>("idle");
  const userId                  = useRef<string>("");
  const saveTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from DB on mount
  useEffect(() => {
    userId.current = getUserId();
    setSync("saving");
    fetch(`${BASE}/api/notes?user_id=${userId.current}`)
      .then(r => r.json())
      .then(d => { setNotes(d.content ?? ""); setSync("saved"); })
      .catch(() => setSync("error"));
  }, []);

  const update = (val: string) => {
    setNotes(val);
    setSync("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`${BASE}/api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId.current, content: val }),
      })
        .then(() => setSync("saved"))
        .catch(() => setSync("error"));
    }, 800);
  };

  const clear = () => update("");

  return (
    <motion.div
      className="flex-shrink-0 flex flex-col w-72 border-l border-[#27272a] bg-[#0f0f11]"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 288, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold">Notes</span>
          {sync === "saving" && <Loader className="w-3 h-3 text-zinc-500 animate-spin" />}
          {sync === "saved"  && <Cloud className="w-3 h-3 text-green-500" />}
          {sync === "error"  && <CloudOff className="w-3 h-3 text-red-400" />}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clear} className="text-zinc-600 hover:text-zinc-400 transition-colors" title="Clear notes">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={notes}
        onChange={e => update(e.target.value)}
        placeholder="Paste campaigns, staffing plans, crowd forecasts... anything worth keeping."
        className="flex-1 w-full bg-transparent text-zinc-300 text-xs leading-relaxed resize-none outline-none px-4 py-3 placeholder:text-zinc-700"
      />
    </motion.div>
  );
}
