"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function AudioDropzone({
  file,
  onFile,
  disabled,
}: {
  file: File | null;
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const next = event.dataTransfer.files?.[0];
        if (next) onFile(next);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition duration-150",
        dragOver ? "border-accent bg-accent/10" : "border-white/15 bg-white/[0.02] hover:border-primary/70",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input
        type="file"
        accept=".wav,.mp3,.flac,.ogg,.aiff,.aif,.m4a,.aac,audio/*"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) onFile(next);
        }}
      />
      <Upload className="mb-3 h-5 w-5 text-accent" />
      <div className="text-sm font-medium">{file ? file.name : "Drop audio here or browse"}</div>
      <div className="mt-1 text-xs text-zinc-500">WAV, MP3, FLAC, OGG, AIFF, M4A, or AAC. 40 MB maximum.</div>
    </label>
  );
}
