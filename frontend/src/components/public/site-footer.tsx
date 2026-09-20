import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { USING_MOCK_API } from "@/lib/api/config";

const COLUMNS = [
  {
    heading: "Explore",
    links: [
      { href: "/explore", label: "All destinations" },
      { href: "/explore?tier=4", label: "Tier 4 — the long tail" },
      { href: "/states/MP", label: "Places to visit in Madhya Pradesh" },
      { href: "/circuits", label: "Curated circuits" },
      { href: "/search", label: "Search" },
    ],
  },
  {
    heading: "Explorers",
    links: [
      { href: "/leaderboards", label: "Leaderboards" },
      { href: "/challenges", label: "Challenges" },
      { href: "/points", label: "How points work" },
      { href: "/saved", label: "Saved places" },
    ],
  },
  {
    heading: "About",
    links: [
      { href: "/responsible-travel", label: "Responsible travel" },
      { href: "/states", label: "States & union territories" },
      { href: "/admin", label: "Admin & government dashboard" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div>
          <Link href="/" aria-label="YatraGo — home">
            <Logo />
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Discover what to explore anywhere in India — and get rewarded most for
            going where almost nobody does.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <h2 className="text-xs font-semibold tracking-wider uppercase">
              {col.heading}
            </h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <p>
            © {new Date().getFullYear()} YatraGo · Destination photography from
            Wikimedia Commons under the licence credited on each image.
          </p>
          {USING_MOCK_API ? (
            <p className="sm:ml-auto">
              Running on the built-in mock API. Set{" "}
              <code className="rounded bg-muted px-1 py-0.5">NEXT_PUBLIC_API_BASE_URL</code>{" "}
              to point at the live service.
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
