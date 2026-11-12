"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tooltipStyle = {
  background: "#141418",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  color: "#fafafa",
};

export function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  if (data.every((item) => item.revenue === 0)) {
    return <p className="py-16 text-center text-sm text-zinc-500">Paid payments will show up here.</p>;
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="month" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} width={48} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="revenue" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.22} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DetectionChart({ data }: { data: { title: string; detections: number }[] }) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-zinc-500">Detections from the scanner will rank here.</p>;
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="title" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} width={32} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="detections" fill="#22D3EE" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
