import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Compass className="size-6" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-semibold">Nothing mapped here yet</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          This page does not exist. The catalogue covers Madhya Pradesh at MVP —
          the other 27 states and 8 union territories are on the way.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/explore"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Explore destinations
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
