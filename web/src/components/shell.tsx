"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Viewer } from "@/lib/auth";
import { LiveProvider, LiveStatus, PendingBadge } from "./live";
import { CommandPalette } from "./palette";
import { ThemePicker } from "./motion";
import { ViewAs } from "./view-as";

type Item = { href: string; label: string; badge?: boolean };

const NAV: Record<Viewer["role"], Item[]> = {
  founder: [
    { href: "/", label: "Overview" },
    { href: "/leads", label: "Enquiries" },
    { href: "/review", label: "Review", badge: true },
    { href: "/designers", label: "Team" },
    { href: "/settings", label: "Settings" },
  ],
  front_desk: [
    { href: "/review", label: "Review", badge: true },
    { href: "/leads", label: "Enquiries" },
    { href: "/", label: "Overview" },
    { href: "/designers", label: "Team" },
  ],
  designer: [{ href: "/me", label: "My consultations" }],
};

export function Shell({ children, me, team }: { children: React.ReactNode; me: Viewer; team: { id: number; name: string }[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const nav = NAV[me.role];

  const link = (n: Item, compact = false) => (
    <Link
      key={n.href}
      href={n.href}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full ${compact ? "px-3" : "px-3.5"} py-1.5 text-[13px] transition-colors ${
        active(n.href) ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
      }`}
    >
      {n.label}
      {n.badge && <PendingBadge />}
    </Link>
  );

  return (
    <LiveProvider>
      <header className="glass sticky top-0 z-40 border-b border-hairline/70">
        <div className="wrap flex h-14 items-center gap-3">
          <Link href={me.role === "designer" ? "/me" : "/"} className="shrink-0 font-serif text-[18px] tracking-[0.22em] text-terracotta">AANGAN</Link>
          <nav className="no-scrollbar -mx-1 hidden flex-1 justify-center gap-1 overflow-x-auto md:flex">{nav.map((n) => link(n))}</nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <div className="hidden xl:block"><LiveStatus /></div>
            {me.role !== "designer" && (
              <button
                onClick={() => window.dispatchEvent(new Event("open-palette"))}
                aria-label="Search"
                className="flex items-center gap-2 rounded-full border border-hairline bg-paper/70 px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:text-ink"
              >
                <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <span className="hidden lg:inline">Search</span>
              </button>
            )}
            <ThemePicker />
            <ViewAs me={me} team={team} />
          </div>
        </div>
        {nav.length > 1 && <nav className="no-scrollbar wrap flex gap-1 overflow-x-auto pb-2 md:hidden">{nav.map((n) => link(n, true))}</nav>}
      </header>
      <main className="min-h-[70vh]">{children}</main>
      <footer className="wrap mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-hairline py-8 text-[12px] text-stone">
        <span className="font-serif tracking-[0.2em] text-terracotta">AANGAN</span>
        <LiveStatus />
        <span>Concierge answers. People decide the price.</span>
      </footer>
      {me.role !== "designer" && <CommandPalette />}
    </LiveProvider>
  );
}
