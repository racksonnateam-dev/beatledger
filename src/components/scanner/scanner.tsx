"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AudioDropzone } from "@/components/audio/dropzone";
import { EmptyState } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { LICENSE_LABELS } from "@/lib/validation";
import { formatDate, formatMoney, formatPercent, formatTimestamp } from "@/lib/format";

interface ScanLicense {
  id: string;
  paymentStatus: string;
  customerName: string | null;
  licenseType: string | null;
  amount: number | null;
  currency: string | null;
}

export interface ScanRecord {
  id: string;
  fileName: string;
  audioUrl: string;
  status: "LICENSED" | "UNVERIFIED_LICENSE" | "NO_MATCH" | "PROCESSING_FAILED";
  statusLabel: string;
  message: string;
  experimental: boolean;
  engine: string;
  confidence: number | null;
  matchTimestamp: number | null;
  createdAt: string;
  beat: { id: string; title: string; producerName: string } | null;
  licenses: ScanLicense[];
  platform: {
    status: "not_configured" | "matched" | "no_match" | "failed";
    message: string;
    matches: { title: string | null; artist: string | null; album: string | null; releaseDate: string | null; timecode: string | null; links: { platform: string; url: string }[] }[];
  };
}

function formatReleaseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function Scanner({ history }: { history: ScanRecord[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ScanRecord | null>(null);

  async function scan() {
    if (!file) {
      toast.error("Choose an audio file to compare.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    setPending(true);
    const response = await fetch("/api/recognitions", { method: "POST", body: form });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      toast.error(body.error || "Recognition failed.");
      return;
    }
    setResult(body.recognition);
    router.refresh();
  }

  const shown = result;
  return (
    <div className="grid gap-6">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Compare an upload</h2>
            <p className="mt-1 text-sm text-zinc-400">Name a known recording, with Spotify and Apple Music links when the identification service returns them, and compare the same file with your catalogue.</p>
          </div>
          <StatusBadge status="PENDING" label="Experimental engine" />
        </div>
        <AudioDropzone file={file} onFile={setFile} disabled={pending} />
        <div className="mt-4">
          <Button type="button" onClick={scan} disabled={pending}>
            {pending ? "Comparing…" : "Run recognition"}
          </Button>
        </div>
        {pending ? <p className="mt-4 text-sm text-zinc-400">Checking the recording database and your private catalogue.</p> : null}
      </Card>

      {shown ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={shown.status} />
            {shown.experimental ? <span className="text-xs text-zinc-500">Experimental · {shown.engine}</span> : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-300">{shown.message}</p>
          <div className="mt-5">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Released recording</div>
            {shown.platform.status === "matched" ? (
              <ul className="mt-2 space-y-3">
                {shown.platform.matches.map((match) => (
                  <li key={`${match.title}-${match.artist}`} className="rounded-lg border border-white/10 px-3 py-3">
                    <div className="font-medium">{match.title ?? "Untitled recording"}</div>
                    <div className="text-sm text-zinc-400">
                      {[match.artist, match.album, match.timecode ? `heard at ${match.timecode} in this file` : null].filter(Boolean).join(" · ")}
                    </div>
                    {match.releaseDate ? <div className="mt-1 text-sm text-zinc-300">Released {formatReleaseDate(match.releaseDate)}</div> : null}
                    {match.links.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        {match.links.map((link) => (
                          <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                            {link.platform}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-500">The service named this recording without a Spotify or Apple Music link.</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm leading-6 text-zinc-400">{shown.platform.message}</p>
            )}
          </div>
          {shown.beat ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Matched beat</div>
                <div className="mt-1 font-medium">{shown.beat.title}</div>
                <div className="text-sm text-zinc-400">{shown.beat.producerName}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Confidence</div>
                <div className="mt-1 font-medium">{formatPercent(shown.confidence)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Match timestamp</div>
                <div className="mt-1 font-medium">{formatTimestamp(shown.matchTimestamp)}</div>
              </div>
            </div>
          ) : null}
          <div className="mt-5">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Related licenses</div>
            {shown.licenses.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-400">No license is recorded for this result.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {shown.licenses.map((license) => (
                  <li key={license.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm">
                    <span>
                      {license.customerName} · {license.licenseType ? LICENSE_LABELS[license.licenseType as keyof typeof LICENSE_LABELS] ?? license.licenseType : "License"}
                      {license.amount != null ? ` · ${formatMoney(license.amount, license.currency ?? "USD")}` : ""}
                    </span>
                    <StatusBadge status={license.paymentStatus} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-3 text-base font-medium">Recent scans</h2>
        {history.length === 0 ? (
          <EmptyState title="No scans yet" body="Upload a file to compare it with beats you have fingerprinted. A miss stays a miss. It is not turned into a claim." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">File</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 font-medium">Released recording</th>
                  <th className="px-4 py-3 font-medium">Beat</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((scan) => (
                  <tr key={scan.id} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3">{scan.fileName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={scan.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {scan.platform.matches.length > 0
                        ? scan.platform.matches
                            .map((match) =>
                              [match.title, match.artist, match.releaseDate ? `released ${formatReleaseDate(match.releaseDate)}` : null]
                                .filter(Boolean)
                                .join(" — "),
                            )
                            .join(", ")
                        : scan.platform.message}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{scan.beat?.title ?? "—"}</td>
                    <td className="px-4 py-3">{formatPercent(scan.confidence)}</td>
                    <td className="px-4 py-3">{formatTimestamp(scan.matchTimestamp)}</td>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(scan.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
