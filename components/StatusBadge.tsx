import { statusColors } from "@/lib/status";

export function StatusBadge({ name, color }: { name: string; color: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[color] ?? statusColors.gray}`}>{name}</span>;
}
