"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shell/page-header";
import { PAYMENT_METHODS } from "@/lib/constants";
import { CURRENCIES, PAYMENT_STATUSES } from "@/lib/validation";
import { formatDate, formatMoney } from "@/lib/format";

export interface PaymentRecord {
  id: string;
  licenseId: string;
  beatTitle: string;
  customerName: string;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  transactionReference: string | null;
  status: "PAID" | "UNPAID" | "PENDING" | "REFUNDED";
  createdAt: string;
}

export function PaymentManager({
  payments,
  licenses,
  revenue,
  outstanding,
}: {
  payments: PaymentRecord[];
  licenses: { id: string; label: string }[];
  revenue: string;
  outstanding: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PaymentRecord | null>(null);
  const [pending, setPending] = useState(false);
  const visible = useMemo(
    () =>
      payments.filter((payment) => {
        const haystack = `${payment.beatTitle} ${payment.customerName} ${payment.transactionReference ?? ""}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase()) && (status === "ALL" || payment.status === status);
      }),
    [payments, query, status],
  );

  async function createPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseId: form.get("licenseId"),
        amount: form.get("amount"),
        currency: form.get("currency"),
        paymentMethod: form.get("paymentMethod"),
        transactionReference: form.get("transactionReference"),
        status: form.get("status"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      toast.error(body.error || "Could not record the payment.");
      return;
    }
    toast.success("Payment recorded.");
    setCreating(false);
    router.refresh();
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    const response = await fetch(`/api/payments/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: form.get("amount"),
        currency: form.get("currency"),
        paymentMethod: form.get("paymentMethod"),
        transactionReference: form.get("transactionReference"),
        status: form.get("status"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      toast.error(body.error || "Could not update the payment.");
      return;
    }
    toast.success("Payment updated. The license status follows the latest payment.");
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-card p-4">
          <div className="text-sm text-zinc-400">Recorded revenue</div>
          <div className="mt-2 text-2xl font-semibold">{revenue}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-4">
          <div className="text-sm text-zinc-400">Outstanding</div>
          <div className="mt-2 text-2xl font-semibold">{outstanding}</div>
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search beat, customer, or reference" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="lg:w-48">
          <option value="ALL">All statuses</option>
          {PAYMENT_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item[0] + item.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
        <Button type="button" onClick={() => setCreating(true)}>
          Record payment
        </Button>
      </div>
      <p className="text-sm text-zinc-500">Payments are entered manually. BeatLedger does not charge cards or mark a detection as infringement.</p>
      {visible.length === 0 ? (
        <EmptyState title="No payments" body="Registering a license creates the first payment record. You can edit the amount, method, reference, and status." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Beat</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((payment) => (
                <tr key={payment.id} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3">{payment.beatTitle}</td>
                  <td className="px-4 py-3">{payment.customerName}</td>
                  <td className="px-4 py-3">{formatMoney(payment.amount, payment.currency)}</td>
                  <td className="px-4 py-3 text-zinc-300">{payment.paymentMethod ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{payment.transactionReference ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={payment.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{formatDate(payment.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(payment)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={creating} title="Record a payment" onClose={() => setCreating(false)}>
        <form onSubmit={createPayment} className="grid gap-4">
          <Field label="License">
            <Select name="licenseId" required defaultValue="">
              <option value="" disabled>
                Choose a license
              </option>
              {licenses.map((license) => (
                <option key={license.id} value={license.id}>
                  {license.label}
                </option>
              ))}
            </Select>
          </Field>
          <PaymentFields />
          <Button type="submit" disabled={pending || licenses.length === 0}>
            {pending ? "Saving…" : "Save payment"}
          </Button>
        </form>
      </Modal>
      <Modal open={Boolean(editing)} title="Edit payment" onClose={() => setEditing(null)}>
        {editing ? (
          <form onSubmit={saveEdit} className="grid gap-4">
            <PaymentFields payment={editing} />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

function PaymentFields({ payment }: { payment?: PaymentRecord }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Amount">
        <Input name="amount" type="number" min="0.01" step="0.01" required defaultValue={payment?.amount} />
      </Field>
      <Field label="Currency">
        <Select name="currency" defaultValue={payment?.currency ?? "USD"}>
          {CURRENCIES.map((currency) => (
            <option key={currency}>{currency}</option>
          ))}
        </Select>
      </Field>
      <Field label="Status">
        <Select name="status" defaultValue={payment?.status ?? "PAID"}>
          {PAYMENT_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item[0] + item.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Method">
        <Select name="paymentMethod" defaultValue={payment?.paymentMethod ?? ""}>
          <option value="">Optional</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method}>{method}</option>
          ))}
        </Select>
      </Field>
      <Field label="Reference">
        <Input name="transactionReference" defaultValue={payment?.transactionReference ?? ""} />
      </Field>
    </div>
  );
}
