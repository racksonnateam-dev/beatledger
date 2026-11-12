"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name") }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      toast.error(body.error || "Could not update your name.");
      return;
    }
    toast.success("Profile updated.");
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Display name">
        <Input name="name" defaultValue={name} required maxLength={80} />
      </Field>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [pending, setPending] = useState(false);
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.get("currentPassword"),
        newPassword: form.get("newPassword"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      toast.error(body.error || "Could not change the password.");
      return;
    }
    toast.success("Password updated.");
    event.currentTarget.reset();
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Current password">
        <Input name="currentPassword" type="password" required autoComplete="current-password" />
      </Field>
      <Field label="New password">
        <Input name="newPassword" type="password" required autoComplete="new-password" minLength={8} />
      </Field>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
