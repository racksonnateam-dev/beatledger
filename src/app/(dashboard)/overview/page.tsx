import { Card } from "@/components/ui/card";
import { DetectionChart, RevenueChart } from "@/components/overview/charts";
import { StatCard } from "@/components/overview/stat-card";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { redirect } from "next/navigation";
import { statusForRecognition } from "@/lib/serializers";

export const dynamic = "force-dynamic";

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
}

export default async function OverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCMonth(since.getUTCMonth() - 5);
  since.setUTCHours(0, 0, 0, 0);

  const [beatCount, licensesSold, paid, outstanding, recentScans, recentPayments, detections] = await Promise.all([
    prisma.beat.count({ where: { ownerId: user.id } }),
    prisma.license.count({ where: { ownerId: user.id, paymentStatus: "PAID" } }),
    prisma.payment.aggregate({ where: { ownerId: user.id, status: "PAID" }, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { ownerId: user.id, status: { in: ["UNPAID", "PENDING"] } },
      _sum: { amount: true },
    }),
    prisma.recognition.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { matchedBeat: { select: { id: true, title: true, producerName: true } } },
    }),
    prisma.payment.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { license: { include: { beat: { select: { title: true } }, customer: { select: { name: true } } } } },
    }),
    prisma.recognition.findMany({
      where: { ownerId: user.id, matchedBeatId: { not: null } },
      select: { matchedBeatId: true, matchedBeat: { select: { title: true } } },
    }),
  ]);

  const beatIds = recentScans.flatMap((scan) => (scan.matchedBeatId ? [scan.matchedBeatId] : []));
  const licenses = beatIds.length
    ? await prisma.license.findMany({
        where: { ownerId: user.id, beatId: { in: beatIds } },
        select: { beatId: true, paymentStatus: true, expirationDate: true },
      })
    : [];

  const chartMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + index, 1));
    return { key: `${date.getUTCFullYear()}-${date.getUTCMonth()}`, month: monthLabel(date), revenue: 0 };
  });
  const paidRows = await prisma.payment.findMany({
    where: { ownerId: user.id, status: "PAID", createdAt: { gte: since } },
    select: { amount: true, createdAt: true, currency: true },
  });
  for (const payment of paidRows) {
    if (payment.currency !== "USD") continue;
    const key = `${payment.createdAt.getUTCFullYear()}-${payment.createdAt.getUTCMonth()}`;
    const bucket = chartMonths.find((item) => item.key === key);
    if (bucket) bucket.revenue = Math.round((bucket.revenue + Number(payment.amount)) * 100) / 100;
  }

  const detectionMap = new Map<string, { title: string; detections: number }>();
  for (const row of detections) {
    if (!row.matchedBeatId || !row.matchedBeat) continue;
    const current = detectionMap.get(row.matchedBeatId) ?? { title: row.matchedBeat.title, detections: 0 };
    detectionMap.set(row.matchedBeatId, { ...current, detections: current.detections + 1 });
  }
  const detectionData = [...detectionMap.values()].sort((a, b) => b.detections - a.detections).slice(0, 5);

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back${user.name ? `, ${user.name}` : ""}`}
        description="Registered beats, paid licenses, and scans of files you uploaded. Detections without a paid license stay unverified."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered beats" value={String(beatCount)} detail="Private catalogue" />
        <StatCard label="Licenses sold" value={String(licensesSold)} detail="Payment status is paid" />
        <StatCard label="Total revenue" value={formatMoney(Number(paid._sum.amount ?? 0))} detail="Sum of paid records" />
        <StatCard label="Outstanding" value={formatMoney(Number(outstanding._sum.amount ?? 0))} detail="Unpaid and pending" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <h2 className="mb-4 text-sm font-medium text-zinc-300">Revenue</h2>
          <RevenueChart data={chartMonths.map(({ month, revenue }) => ({ month, revenue }))} />
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-medium text-zinc-300">Most detected beats</h2>
          <DetectionChart data={detectionData} />
        </Card>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-300">Recent recognition</h2>
          {recentScans.length === 0 ? (
            <p className="text-sm text-zinc-500">No scans yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentScans.map((scan) => {
                const live = statusForRecognition(
                  scan,
                  licenses.filter((license) => license.beatId === scan.matchedBeatId),
                );
                return (
                  <li key={scan.id} className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-0">
                    <div>
                      <div className="text-sm">{scan.matchedBeat?.title ?? scan.uploadedFileName}</div>
                      <div className="text-xs text-zinc-500">
                        {formatDate(scan.createdAt)}
                        {scan.confidenceScore != null ? ` · ${formatPercent(scan.confidenceScore)}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={live.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-300">Recent transactions</h2>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-zinc-500">No payments recorded.</p>
          ) : (
            <ul className="space-y-3">
              {recentPayments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-0">
                  <div>
                    <div className="text-sm">{payment.license.beat.title}</div>
                    <div className="text-xs text-zinc-500">
                      {payment.license.customer.name} · {formatDate(payment.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">{formatMoney(Number(payment.amount), payment.currency)}</div>
                    <StatusBadge status={payment.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
