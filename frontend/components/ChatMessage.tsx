"use client";
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

export default function ChatMessage({ role, text }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? "bg-zinc-700 text-zinc-300 text-xs font-bold" : "bg-[#3b5bdb] text-white"
      }`}>
        {isUser ? "U" : <WaveLogo size={20} className="text-white" />}
      </div>
      <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed flex-1 ${
        isUser
          ? "bg-[#27272a] text-zinc-100 rounded-tr-sm border border-zinc-700"
          : "bg-[#18181b] text-zinc-100 rounded-tl-sm border border-zinc-700/60"
      }`}>
        {formatText(text)}
      </div>
    </div>
  );
}
