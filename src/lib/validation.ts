import { z } from "zod";

export const LICENSE_TYPES = ["MP3_LEASE", "WAV_LEASE", "TRACKOUT", "UNLIMITED", "EXCLUSIVE"] as const;
export const PAYMENT_STATUSES = ["PAID", "UNPAID", "PENDING", "REFUNDED"] as const;
export const CURRENCIES = ["USD", "EUR", "GBP"] as const;

export const LICENSE_LABELS: Record<(typeof LICENSE_TYPES)[number], string> = {
  MP3_LEASE: "MP3 lease",
  WAV_LEASE: "WAV lease",
  TRACKOUT: "Trackouts",
  UNLIMITED: "Unlimited",
  EXCLUSIVE: "Exclusive",
};

const emptyToNull = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.string().trim().email("Enter a valid email.").max(160),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72, "Passwords are limited to 72 characters.")
    .regex(/[A-Za-z]/, "Include at least one letter.")
    .regex(/[0-9]/, "Include at least one number."),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password.").max(72),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(72),
  newPassword: registerSchema.shape.password,
});

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
});

export const beatMetaSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(120),
  producerName: z.string().trim().min(1, "Enter a producer name.").max(80),
  bpm: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().int().min(40, "BPM must be at least 40.").max(300, "BPM must be 300 or less.").nullable(),
  ),
  musicalKey: z.preprocess(emptyToNull, z.string().max(16).nullable()),
  genre: z.preprocess(emptyToNull, z.string().max(40).nullable()),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter a customer name.").max(80),
  email: z.string().trim().email("Enter a valid email.").max(160),
});

const money = z.preprocess(
  (value) => (typeof value === "string" ? Number(value) : value),
  z.number().positive("Enter an amount greater than zero.").max(1_000_000, "Amount is too large."),
);

export const licenseSchema = z.object({
  beatId: z.string().min(1, "Choose a beat."),
  customerId: z.string().min(1, "Choose a customer."),
  licenseType: z.enum(LICENSE_TYPES),
  amount: money,
  currency: z.enum(CURRENCIES),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  paymentDate: z.preprocess(emptyToNull, z.string().max(40).nullable().optional()),
  expirationDate: z.preprocess(emptyToNull, z.string().max(40).nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().max(2000).nullable()),
  paymentMethod: z.preprocess(emptyToNull, z.string().max(40).nullable().optional()),
  transactionReference: z.preprocess(emptyToNull, z.string().max(120).nullable().optional()),
});

export const licenseUpdateSchema = licenseSchema.partial().extend({
  beatId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
});

export const paymentSchema = z.object({
  licenseId: z.string().min(1, "Choose a license."),
  amount: money,
  currency: z.enum(CURRENCIES),
  paymentMethod: z.preprocess(emptyToNull, z.string().max(40).nullable().optional()),
  transactionReference: z.preprocess(emptyToNull, z.string().max(120).nullable().optional()),
  status: z.enum(PAYMENT_STATUSES),
});

export const paymentUpdateSchema = paymentSchema.omit({ licenseId: true }).partial();

export function zodMessage(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(" ");
}

export function parseOptionalDate(value: string | null | undefined, label: string) {
  if (!value) return { ok: true as const, date: null };
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return { ok: false as const, error: `${label} is not a valid date.` };
  return { ok: true as const, date };
}
