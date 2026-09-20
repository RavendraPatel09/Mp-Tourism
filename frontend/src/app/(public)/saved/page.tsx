import type { Metadata } from "next";
import { serverApi } from "@/lib/api/server";
import { SavedClient } from "@/components/public/saved-client";

export const metadata: Metadata = {
  title: "Saved places",
  description: "Your saved destinations.",
  robots: { index: false },
};

export default async function SavedPage() {
  const all = await serverApi.destinations({ pageSize: 60 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Want to visit</h1>
      <p className="mt-2 text-muted-foreground">
        Saved on this device. Signing in will sync this list once accounts are
        live.
      </p>
      <div className="mt-8">
        <SavedClient all={all.items} />
      </div>
    </div>
  );
}
