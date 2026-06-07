"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Trash2, Cloud, CloudOff, Loader } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
const USER_ID_KEY = "wcbiz_user_id";

function getUserId(): string {
  try {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(USER_ID_KEY, id); }
    return id;
  } catch { return "anonymous"; }
}

type SyncState = "idle" | "saving" | "saved" | "error";

interface Props { onClose: () => void; }

const WC_START = new Date("2026-06-11");
const WC_END   = new Date("2026-07-19");

export default function NotesSidebar({ onClose }: Props) {
  const [general, setGeneral]   = useState("");
  const [dated, setDated]       = useState<Record<string, string>>({});
  const [date, setDate]         = useState<Date | undefined>(new Date());
  const [sync, setSync]         = useState<SyncState>("idle");
  const userId                  = useRef<string>("");
  const saveTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    userId.current = getUserId();
    setSync("saving");
    fetch(`${BASE}/api/notes?user_id=${userId.current}`)
      .then(r => r.json())
      .then(d => { setGeneral(d.general ?? ""); setDated(d.dated ?? {}); setSync("saved"); })
      .catch(() => setSync("error"));
  }, []);

  const save = (patch: { general?: string; date?: string; dated_content?: string }) => {
    setSync("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`${BASE}/api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId.current, ...patch }),
      }).then(() => setSync("saved")).catch(() => setSync("error"));
    }, 800);
  };

  const dateKey = date?.toISOString().slice(0, 10) ?? "";
  const datedContent = dated[dateKey] ?? "";

  const updateGeneral = (val: string) => { setGeneral(val); save({ general: val }); };
  const updateDated   = (val: string) => { setDated(p => ({ ...p, [dateKey]: val })); save({ date: dateKey, dated_content: val }); };

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
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="w-full rounded-none bg-transparent border-b border-[#27272a] h-9 px-0 flex-shrink-0">
          <TabsTrigger value="general" className="flex-1 rounded-none text-xs data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-[#3b5bdb] text-zinc-600 h-full">General</TabsTrigger>
          <TabsTrigger value="matchday" className="flex-1 rounded-none text-xs data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-[#3b5bdb] text-zinc-600 h-full">Match Day</TabsTrigger>
        </TabsList>

        {/* General tab */}
        <TabsContent value="general" className="flex flex-col flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
          <div className="flex justify-end px-3 pt-2 flex-shrink-0">
            <button onClick={() => updateGeneral("")} className="text-zinc-700 hover:text-zinc-400 transition-colors flex items-center gap-1 text-[10px]">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
          <textarea
            value={general}
            onChange={e => updateGeneral(e.target.value)}
            placeholder="General notes — strategies, ideas, reminders..."
            className="flex-1 w-full bg-transparent text-zinc-300 text-xs leading-relaxed resize-none outline-none px-4 py-2 placeholder:text-zinc-700"
          />
        </TabsContent>

        {/* Match Day tab */}
        <TabsContent value="matchday" className="flex flex-col flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
          <div className="flex-shrink-0 border-b border-[#27272a]">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={d => d < WC_START || d > WC_END}
              className="w-full p-0 [--cell-size:--spacing(6)] bg-transparent"
            />
          </div>
          <div className="flex justify-between items-center px-3 pt-2 flex-shrink-0">
            <span className="text-[10px] text-zinc-500">{dateKey || "No date selected"}</span>
            <button onClick={() => updateDated("")} className="text-zinc-700 hover:text-zinc-400 transition-colors flex items-center gap-1 text-[10px]">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
          <textarea
            key={dateKey}
            value={datedContent}
            onChange={e => updateDated(e.target.value)}
            placeholder={date ? `Notes for ${dateKey}...` : "Pick a match date above"}
            disabled={!date}
            className="flex-1 w-full bg-transparent text-zinc-300 text-xs leading-relaxed resize-none outline-none px-4 py-2 placeholder:text-zinc-700 disabled:opacity-40"
          />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
