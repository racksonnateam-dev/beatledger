import { cn } from "@/lib/cn";

const tones: Record<string, string> = {
  LICENSED: "bg-cyan-400/10 text-cyan-200",
  PAID: "bg-cyan-400/10 text-cyan-200",
  READY: "bg-cyan-400/10 text-cyan-200",
  UNVERIFIED_LICENSE: "bg-amber-400/10 text-amber-100",
  UNPAID: "bg-amber-400/10 text-amber-100",
  PENDING: "bg-violet-400/10 text-violet-100",
  REFUNDED: "bg-white/5 text-zinc-300",
  NO_MATCH: "bg-white/5 text-zinc-300",
  FAILED: "bg-red-500/10 text-red-200",
  PROCESSING_FAILED: "bg-red-500/10 text-red-200",
};

const labels: Record<string, string> = {
  LICENSED: "Licensed",
  UNVERIFIED_LICENSE: "Unverified license",
  NO_MATCH: "No match found",
  PROCESSING_FAILED: "Processing failed",
  PAID: "Paid",
  UNPAID: "Unpaid",
  PENDING: "Pending",
  REFUNDED: "Refunded",
  READY: "Fingerprinted",
  FAILED: "Fingerprint failed",
};

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tones[status] ?? "bg-white/5 text-zinc-300", className)}>
      {label ?? labels[status] ?? status}
    </span>
  );
}
