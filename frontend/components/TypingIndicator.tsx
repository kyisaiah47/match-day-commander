import WaveLogo from "./WaveLogo";

const TOOL_LABELS: Record<string, { label: string; save: boolean }> = {
  get_matches_at_venue:       { label: "Querying MongoDB — match schedule",      save: false },
  get_crowd_forecast:         { label: "Querying MongoDB — crowd forecast",       save: false },
  get_business_profile:       { label: "Querying MongoDB — business profile",     save: false },
  list_businesses_near_venue: { label: "Querying MongoDB — nearby businesses",    save: false },
  list_campaigns:             { label: "Querying MongoDB — saved campaigns",       save: false },
  get_recommendations:        { label: "Querying MongoDB — recommendations",       save: false },
  save_campaign:              { label: "Saving campaign to Atlas",                 save: true  },
  save_recommendation:        { label: "Saving recommendation to Atlas",           save: true  },
};

interface Props { steps?: string[]; }

export default function TypingIndicator({ steps = [] }: Props) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-[#3b5bdb] flex items-center justify-center flex-shrink-0 mt-0.5">
        <WaveLogo size={20} className="text-white" />
      </div>
      <div className="bg-[#18181b] border border-zinc-700/60 rounded-xl rounded-tl-sm px-4 py-3 flex flex-col gap-2 min-w-[220px]">
        {steps.map((step, i) => {
          const meta = TOOL_LABELS[step];
          const label = meta?.label ?? step;
          const isSave = meta?.save ?? false;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={isSave ? "text-green-400" : "text-[#748ffc]"}>
                {isSave ? "✓" : "⚙"}
              </span>
              <span className={isSave ? "text-green-300" : "text-zinc-400"}>{label}</span>
            </div>
          );
        })}
        <div className="flex gap-1.5 items-center h-4 mt-0.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#748ffc] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
