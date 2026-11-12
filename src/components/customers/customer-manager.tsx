"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/shell/page-header";
import { formatDate } from "@/lib/format";

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export function CustomerManager({ customers }: { customers: CustomerRecord[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
  const [pending, setPending] = useState(false);
  const visible = customers.filter((customer) => `${customer.name} ${customer.email}`.toLowerCase().includes(query.trim().toLowerCase()));

  async function save(event: React.FormEvent<HTMLFormElement>, customer?: CustomerRecord) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { name: form.get("name"), email: form.get("email") };
    setPending(true);
    const response = await fetch(customer ? `/api/customers/${customer.id}` : "/api/customers", {
      method: customer ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      toast.error(body.error || "Could not save the customer.");
      return;
    }
    toast.success(customer ? "Customer updated." : "Customer added.");
    setOpen(false);
    setEditing(null);
    router.refresh();
  }

  async function remove(customer: CustomerRecord) {
    if (!window.confirm(`Delete ${customer.name}?`)) return;
    const response = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error || "Could not delete the customer.");
      return;
    }
    toast.success("Customer deleted.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers" />
        <Button type="button" onClick={() => setOpen(true)}>
          Add customer
        </Button>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No customers" body="Add the people who license your beats. Search matches name or email." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((customer) => (
                <tr key={customer.id} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3">{customer.name}</td>
                  <td className="px-4 py-3 text-zinc-300">{customer.email}</td>
                  <td className="px-4 py-3 text-zinc-400">{formatDate(customer.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(customer)}>
                      Edit
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(customer)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={open} title="Add customer" onClose={() => setOpen(false)}>
        <form onSubmit={(event) => save(event)} className="grid gap-4">
          <Field label="Name">
            <Input name="name" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save customer"}
          </Button>
        </form>
      </Modal>
      <Modal open={Boolean(editing)} title="Edit customer" onClose={() => setEditing(null)}>
        {editing ? (
          <form onSubmit={(event) => save(event, editing)} className="grid gap-4">
            <Field label="Name">
              <Input name="name" defaultValue={editing.name} required />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={editing.email} required />
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
