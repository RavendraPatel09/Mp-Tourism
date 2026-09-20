import type { Metadata } from "next";
import { SearchClient } from "@/components/public/search-client";

export const metadata: Metadata = {
  title: "Search destinations",
  description:
    "Search India's destinations by name, district, category or interest. Typo tolerant — regional spelling variants resolve to the right place.",
  alternates: { canonical: "/search" },
};

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
      <p className="mt-2 text-muted-foreground">
        By name, district, category or just a word you remember.
      </p>
      <div className="mt-8">
        <SearchClient />
      </div>
    </div>
  );
}
