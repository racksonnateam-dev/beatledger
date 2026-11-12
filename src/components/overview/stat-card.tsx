import { Card } from "@/components/ui/card";

export function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/0 via-primary to-accent/0" />
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-xs text-zinc-500">{detail}</div>
    </Card>
  );
}
