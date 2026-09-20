import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { completeness, getDestination, listAllDestinations } from "@/mocks/db";
import {
  AdminPageHeader,
  RequireCapability,
} from "@/components/admin/admin-shell";
import { DestinationEditorClient } from "@/components/admin/destination-editor-client";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = getDestination(slug);
  return { title: d ? `Edit ${d.name}` : "Destination not found" };
}

export default async function AdminDestinationEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const destination = getDestination(slug);
  if (!destination) notFound();

  const all = listAllDestinations();
  const index = all.findIndex((d) => d.slug === slug);
  const prev = all[index - 1];
  const next = all[index + 1];

  return (
    <RequireCapability capability="destinations.write">
      <AdminPageHeader
        title={destination.name}
        description={`${destination.district}, ${destination.stateName} · Tier ${destination.tier} · ${destination.basePoints} points per check-in`}
        actions={
          <>
            <Badge
              variant={destination.status === "published" ? "success" : "warning"}
            >
              {destination.status.replace("_", " ")}
            </Badge>
            <Link
              href={`/destinations/${destination.slug}`}
              target="_blank"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              View live
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          </>
        }
      />

      <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-2 text-xs">
        <Link
          href="/admin/destinations"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          All destinations
        </Link>
        <span className="ml-auto flex items-center gap-3">
          {prev ? (
            <Link
              href={`/admin/destinations/${prev.slug}`}
              className="text-muted-foreground hover:text-foreground"
            >
              ← {prev.name}
            </Link>
          ) : null}
          {next ? (
            <Link
              href={`/admin/destinations/${next.slug}`}
              className="text-muted-foreground hover:text-foreground"
            >
              {next.name} →
            </Link>
          ) : null}
        </span>
      </div>

      <DestinationEditorClient
        destination={destination}
        completenessScore={completeness(destination)}
      />
    </RequireCapability>
  );
}
