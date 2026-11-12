"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shell/page-header";
import { MUSICAL_KEYS } from "@/lib/constants";
import { formatDate, formatDuration } from "@/lib/format";

export interface BeatRecord {
  id: string;
  title: string;
  producerName: string;
  bpm: number | null;
  musicalKey: string | null;
  genre: string | null;
  originalFileName: string;
  fingerprintStatus: "PENDING" | "READY" | "FAILED";
  fingerprintError: string | null;
  hashCount: number | null;
  duration: number | null;
  createdAt: string;
  audioUrl: string;
}

export function BeatBrowser({ beats }: { beats: BeatRecord[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("ALL");
  const [editing, setEditing] = useState<BeatRecord | null>(null);
  const [pending, setPending] = useState(false);
  const genres = useMemo(() => ["ALL", ...new Set(beats.map((beat) => beat.genre).filter((value): value is string => Boolean(value)))], [beats]);
  const visible = beats.filter((beat) => {
    const haystack = `${beat.title} ${beat.producerName} ${beat.musicalKey ?? ""}`.toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    const matchesGenre = genre === "ALL" || beat.genre === genre;
    return matchesQuery && matchesGenre;
  });

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    const response = await fetch(`/api/beats/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        producerName: form.get("producerName"),
        bpm: form.get("bpm"),
        musicalKey: form.get("musicalKey"),
        genre: form.get("genre"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      toast.error(body.error || "Could not update the beat.");
      return;
    }
    toast.success("Beat updated.");
    setEditing(null);
    router.refresh();
  }

  async function remove(beat: BeatRecord) {
    if (!window.confirm(`Delete ${beat.title}? This removes the private audio file.`)) return;
    const response = await fetch(`/api/beats/${beat.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error || "Could not delete the beat.");
      return;
    }
    toast.success("Beat deleted.");
    router.refresh();
  }

  async function retry(beat: BeatRecord) {
    const response = await fetch(`/api/beats/${beat.id}/fingerprint`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error || "Fingerprint failed.");
      return;
    }
    toast.success(body.beat.fingerprintStatus === "READY" ? "Fingerprint ready." : body.beat.fingerprintError || "Fingerprint did not complete.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, producer, or key" />
        <Select value={genre} onChange={(event) => setGenre(event.target.value)}>
          {genres.map((item) => (
            <option key={item} value={item}>
              {item === "ALL" ? "All genres" : item}
            </option>
          ))}
        </Select>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No beats in this view" body="Register a beat above, or clear the search. Files are stored privately and are not publicly linked." />
      ) : (
        <div className="grid gap-4">
          {visible.map((beat) => (
            <Card key={beat.id} className="p-5 transition duration-150 hover:border-white/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-medium">{beat.title}</h2>
                    <StatusBadge status={beat.fingerprintStatus} label={beat.fingerprintStatus === "PENDING" ? "Processing" : undefined} />
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    {beat.producerName}
                    {beat.bpm ? ` · ${beat.bpm} BPM` : ""}
                    {beat.musicalKey ? ` · ${beat.musicalKey}` : ""}
                    {beat.genre ? ` · ${beat.genre}` : ""}
                    {` · ${formatDuration(beat.duration)}`}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {beat.originalFileName} · {formatDate(beat.createdAt)}
                    {beat.hashCount != null ? ` · ${beat.hashCount} landmark hashes` : ""}
                  </p>
                  {beat.fingerprintError ? <p className="mt-2 text-sm text-amber-100/90">{beat.fingerprintError}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(beat)}>
                    Edit
                  </Button>
                  {beat.fingerprintStatus !== "READY" ? (
                    <Button type="button" variant="secondary" size="sm" onClick={() => retry(beat)}>
                      Retry fingerprint
                    </Button>
                  ) : null}
                  <Button type="button" variant="danger" size="sm" onClick={() => remove(beat)}>
                    Delete
                  </Button>
                </div>
              </div>
              <audio className="mt-4 w-full" controls preload="none" src={beat.audioUrl} />
            </Card>
          ))}
        </div>
      )}
      <Modal open={Boolean(editing)} title="Edit beat" onClose={() => setEditing(null)}>
        {editing ? (
          <form onSubmit={saveEdit} className="grid gap-4">
            <Field label="Title">
              <Input name="title" defaultValue={editing.title} required />
            </Field>
            <Field label="Producer">
              <Input name="producerName" defaultValue={editing.producerName} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="BPM">
                <Input name="bpm" type="number" min={40} max={300} defaultValue={editing.bpm ?? ""} />
              </Field>
              <Field label="Key">
                <Select name="musicalKey" defaultValue={editing.musicalKey ?? ""}>
                  <option value="">Optional</option>
                  {MUSICAL_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Genre">
              <Input name="genre" defaultValue={editing.genre ?? ""} />
            </Field>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
