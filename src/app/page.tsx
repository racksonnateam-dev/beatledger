import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <div className="text-xs font-semibold tracking-[0.22em] text-violet-300">BEATLEDGER</div>
      <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Know where a beat showed up, who licensed it, and whether that license is paid.
      </h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400">
        Register a private catalogue, compare uploaded audio with an experimental fingerprint, and keep licenses and payments in one ledger. A missing payment is an unverified license, not an infringement finding.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/scanner" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500">
          Open the scanner
        </Link>
      </div>
    </main>
  );
}
