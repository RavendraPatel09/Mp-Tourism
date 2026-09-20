"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Menu, Search, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useSaved } from "@/store/saved";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/states", label: "States" },
  { href: "/circuits", label: "Circuits" },
  { href: "/challenges", label: "Challenges" },
  { href: "/leaderboards", label: "Leaderboards" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const savedCount = useSaved((s) => s.slugs.length);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="YatraGo — home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/search"
            aria-label="Search destinations"
            className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Search className="size-4.5" aria-hidden />
          </Link>
          <Link
            href="/saved"
            aria-label={`Saved places${mounted && savedCount ? `, ${savedCount} saved` : ""}`}
            className="relative grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Bookmark className="size-4.5" aria-hidden />
            {mounted && savedCount > 0 ? (
              <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                {savedCount > 9 ? "9+" : savedCount}
              </span>
            ) : null}
          </Link>
          <Link
            href="/u/aarav_rides"
            className="ml-1 hidden rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted sm:block"
          >
            My profile
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav aria-label="Mobile" className="border-t border-border px-4 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/u/aarav_rides"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
          >
            My profile
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
