"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(body.error || "Could not create the account.");
      return;
    }
    router.push("/overview");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="mb-6 text-xs font-semibold tracking-[0.22em] text-violet-300">BEATLEDGER</div>
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">Create your ledger</h1>
        <p className="mt-2 text-sm text-zinc-400">Use at least 8 characters, with a letter and a number.</p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <Field label="Name">
            <Input name="name" autoComplete="name" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
          {error ? <p className="text-sm text-amber-100">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-zinc-400">
          Already registered?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
