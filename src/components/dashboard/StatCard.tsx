import { LucideIcon } from "lucide-react";

export default function StatCard({
  label,
  value,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className="card flex items-center justify-between p-4">
      <div>
        <p className="label-text">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${accent ? "text-neon" : "text-white"}`}>
          {value}
        </p>
      </div>
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
          accent ? "bg-neon/10 text-neon" : "bg-surface-200 text-zinc-400"
        }`}
      >
        <Icon size={20} />
      </div>
    </div>
  );
}
