"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, TextArea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shell/page-header";
import { PAYMENT_METHODS } from "@/lib/constants";
import { CURRENCIES, LICENSE_LABELS, LICENSE_TYPES, PAYMENT_STATUSES } from "@/lib/validation";
import { formatDate, formatMoney } from "@/lib/format";

interface Option {
  id: string;
  label: string;
}

export interface LicenseRecord {
  id: string;
  beatId: string;
  beatTitle: string;
  customerId: string;
  customerName: string;
  licenseType: keyof typeof LICENSE_LABELS;
  amount: number;
  currency: string;
  paymentStatus: "PAID" | "UNPAID" | "PENDING" | "REFUNDED";
  paymentDate: string | null;
  expirationDate: string | null;
  notes: string | null;
  createdAt: string;
}

export function LicenseManager({
  licenses,
  beats,
  customers,
}: {
  licenses: LicenseRecord[];
  beats: Option[];
  customers: Option[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const visible = useMemo(
    () =>
      licenses.filter((license) => {
        const haystack = `${license.beatTitle} ${license.customerName}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase()) && (status === "ALL" || license.paymentStatus === status);
      }),
    [licenses, query, status],
  );

  async function createLicense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const response = await fetch("/api/licenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beatId: form.get("beatId"),
        customerId: form.get("customerId"),
        licenseType: form.get("licenseType"),
        amount: form.get("amount"),
        currency: form.get("currency"),
        paymentStatus: form.get("paymentStatus"),
        paymentDate: form.get("paymentDate"),
        expirationDate: form.get("expirationDate"),
        notes: form.get("notes"),
        paymentMethod: form.get("paymentMethod"),
        transactionReference: form.get("transactionReference"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      toast.error(body.error || "Could not register the license.");
      return;
    }
    toast.success("License recorded. This does not charge a card.");
    setOpen(false);
    router.refresh();
  }

  async function remove(license: LicenseRecord) {
    if (!window.confirm(`Delete the license for ${license.beatTitle}?`)) return;
    const response = await fetch(`/api/licenses/${license.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error || "Could not delete the license.");
      return;
    }
    toast.success("License deleted.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_180px]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search beat or customer" />
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">All statuses</option>
            {PAYMENT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item[0] + item.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          Register license
        </Button>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No licenses" body="Record a license when someone buys a beat. Payment status is entered by you. BeatLedger does not process the charge." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Beat title</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">License type</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Payment status</th>
                <th className="px-4 py-3 font-medium">Purchase date</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((license) => (
                <tr key={license.id} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3">{license.beatTitle}</td>
                  <td className="px-4 py-3">{license.customerName}</td>
                  <td className="px-4 py-3 text-zinc-300">{LICENSE_LABELS[license.licenseType]}</td>
                  <td className="px-4 py-3">{formatMoney(license.amount, license.currency)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={license.paymentStatus} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{formatDate(license.paymentDate ?? license.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(license)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={open} title="Register a license" onClose={() => setOpen(false)}>
        <form onSubmit={createLicense} className="grid gap-4">
          <Field label="Beat">
            <Select name="beatId" required defaultValue="">
              <option value="" disabled>
                Choose a beat
              </option>
              {beats.map((beat) => (
                <option key={beat.id} value={beat.id}>
                  {beat.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Customer">
            <Select name="customerId" required defaultValue="">
              <option value="" disabled>
                Choose a customer
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="License type">
              <Select name="licenseType" defaultValue="MP3_LEASE">
                {LICENSE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {LICENSE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select name="paymentStatus" defaultValue="UNPAID">
                {PAYMENT_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item[0] + item.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount">
              <Input name="amount" type="number" min="0.01" step="0.01" required />
            </Field>
            <Field label="Currency">
              <Select name="currency" defaultValue="USD">
                {CURRENCIES.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </Select>
            </Field>
            <Field label="Payment date">
              <Input name="paymentDate" type="date" />
            </Field>
            <Field label="Expiration">
              <Input name="expirationDate" type="date" />
            </Field>
            <Field label="Method">
              <Select name="paymentMethod" defaultValue="">
                <option value="">Optional</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </Select>
            </Field>
            <Field label="Reference">
              <Input name="transactionReference" maxLength={120} placeholder="Invoice or transfer id" />
            </Field>
          </div>
          <Field label="Notes">
            <TextArea name="notes" maxLength={2000} />
          </Field>
          <Button type="submit" disabled={pending || beats.length === 0 || customers.length === 0}>
            {pending ? "Saving…" : "Save license"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
