import WaveLogo from "./WaveLogo";

export default function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-[#3b5bdb] flex items-center justify-center flex-shrink-0 mt-0.5">
        <WaveLogo size={20} className="text-white" />
      </div>
      <div className="bg-[#18181b] border border-zinc-700/60 rounded-xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-5">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2 h-2 rounded-full bg-[#748ffc] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
