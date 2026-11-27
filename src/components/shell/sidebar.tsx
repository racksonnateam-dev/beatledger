"use client";

import {
  AudioLines,
  CreditCard,
  Disc3,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const items = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/beats", label: "My Beats", icon: Disc3 },
  { href: "/scanner", label: "Recognition Scanner", icon: AudioLines },
  { href: "/licenses", label: "Licenses", icon: ScrollText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((item) => {
        const active = item.href === "/overview" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition duration-150",
              active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className={cn("h-4 w-4", active && "text-accent")} />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar({ email }: { email: string }) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-[#0c0c0f]/95 px-4 py-5 lg:flex">
        <Link href="/overview" className="mb-8 px-2">
          <div className="text-[11px] font-semibold tracking-[0.22em] text-violet-300">BEATLEDGER</div>
          <div className="mt-1 text-sm text-zinc-500">Catalogue, licenses, detections</div>
        </Link>
        <NavLinks />
        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="truncate px-2 text-xs text-zinc-500">{email}</div>
        </div>
      </aside>
      <div className="border-b border-white/10 bg-[#0c0c0f] px-4 py-3 lg:hidden">
        <div className="mb-3 text-[11px] font-semibold tracking-[0.22em] text-violet-300">BEATLEDGER</div>
        <NavLinks />
      </div>
    </>
  );
}
