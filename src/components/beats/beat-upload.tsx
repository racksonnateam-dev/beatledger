"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AudioDropzone } from "@/components/audio/dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { MUSICAL_KEYS } from "@/lib/constants";

export function BeatUpload({ producerName }: { producerName: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!file) {
      toast.error("Choose an audio file.");
      return;
    }
    form.set("file", file);
    setPending(true);
    const response = await fetch("/api/beats", { method: "POST", body: form });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      toast.error(body.error || "Could not register the beat.");
      return;
    }
    toast.success(body.beat.fingerprintStatus === "READY" ? "Beat registered and fingerprinted." : "Beat saved. Fingerprint needs another try.");
    setFile(null);
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="text-base font-medium">Register a beat</h2>
      <p className="mt-1 text-sm text-zinc-400">The file stays private to your account. Fingerprinting runs on the local audio service.</p>
      <form onSubmit={onSubmit} className="mt-5 grid gap-4">
        <AudioDropzone file={file} onFile={setFile} disabled={pending} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <Input name="title" required maxLength={120} placeholder="Midnight Lease" />
          </Field>
          <Field label="Producer">
            <Input name="producerName" required maxLength={80} defaultValue={producerName} />
          </Field>
          <Field label="BPM">
            <Input name="bpm" type="number" min={40} max={300} placeholder="140" />
          </Field>
          <Field label="Key">
            <Select name="musicalKey" defaultValue="">
              <option value="">Optional</option>
              {MUSICAL_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Genre">
            <Input name="genre" maxLength={40} placeholder="Trap" />
          </Field>
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Registering…" : "Register beat"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
