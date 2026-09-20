"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  FileClock,
  Flag,
  Images,
  LayoutDashboard,
  MapPinned,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { ADMIN_ROLES, ROLE_LABEL, can, type Capability } from "@/lib/rbac";
import type { Role } from "@/lib/types";
import { useSession } from "@/store/session";
import { cn } from "@/lib/utils";

const NAV: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  capability: Capability;
}[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, capability: "destinations.read" },
  { href: "/admin/moderation", label: "Moderation", icon: ShieldCheck, capability: "moderation.review" },
  { href: "/admin/reports", label: "Reports", icon: Flag, capability: "reports.review" },
  { href: "/admin/destinations", label: "Destinations", icon: MapPinned, capability: "destinations.read" },
  { href: "/admin/media", label: "Media library", icon: Images, capability: "media.manage" },
  { href: "/admin/challenges", label: "Challenges", icon: Trophy, capability: "challenges.manage" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, capability: "analytics.state" },
  { href: "/admin/users", label: "Users", icon: Users, capability: "users.manage" },
  { href: "/admin/audit-logs", label: "Audit log", icon: FileClock, capability: "audit.read" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const role = useSession((s) => s.role);
  const setRole = useSession((s) => s.setRole);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const effectiveRole: Role = mounted ? role : "super_admin";
  const visible = NAV.filter((item) => can(effectiveRole, item.capability));

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <LogoMark className="size-6 text-primary" title="YatraGo" />
          <span className="text-sm font-semibold">
            Yatra<span className="text-accent">Go</span>
          </span>
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
            Admin
          </span>
        </div>

        <nav aria-label="Admin" className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {visible.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <label
            htmlFor="role-switcher"
            className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
          >
            <Activity className="size-3" aria-hidden />
            View as
          </label>
          <select
            id="role-switcher"
            value={effectiveRole}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1.5 h-9 w-full rounded-lg border border-border bg-input px-2 text-sm"
          >
            {ADMIN_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Presentation only. Real enforcement is server-side on every endpoint.
          </p>
          <Link
            href="/"
            className="mt-3 block text-xs font-medium text-primary hover:underline"
          >
            ← Back to the public site
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur sm:px-6 lg:hidden">
          <LogoMark className="size-6 text-primary" title="YatraGo" />
          <span className="text-sm font-semibold">Admin</span>
          <select
            aria-label="Go to section"
            value={pathname}
            onChange={(e) => {
              window.location.href = e.target.value;
            }}
            className="ml-auto h-9 rounded-lg border border-border bg-input px-2 text-sm"
          >
            {visible.map((item) => (
              <option key={item.href} value={item.href}>
                {item.label}
              </option>
            ))}
          </select>
        </header>

        {children}
      </div>
    </div>
  );
}

/** Wraps a page body so it cannot render for a role that lacks the capability. */
export function RequireCapability({
  capability,
  children,
}: {
  capability: Capability;
  children: React.ReactNode;
}) {
  const role = useSession((s) => s.role);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  if (can(role, capability)) return <>{children}</>;

  return (
    <div className="p-10">
      <div className="mx-auto max-w-md rounded-(--radius-card) border border-border bg-card p-8 text-center">
        <ShieldCheck className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold">Not available for this role</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {ROLE_LABEL[role]} does not have the{" "}
          <code className="rounded bg-muted px-1">{capability}</code> capability.
          Switch role in the sidebar to see this section.
        </p>
      </div>
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-card px-6 py-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
