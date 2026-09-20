import { AlertTriangle, Upload } from "lucide-react";
import { listAllDestinations } from "@/mocks/db";
import {
  AdminPageHeader,
  RequireCapability,
} from "@/components/admin/admin-shell";
import { StatTile } from "@/components/admin/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Photo } from "@/components/public/photo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Media library" };

export default function AdminMediaPage() {
  const destinations = listAllDestinations();
  const media = destinations.flatMap((d) =>
    d.gallery.map((m, i) => ({
      ...m,
      destinationName: d.name,
      destinationSlug: d.slug,
      tier: d.tier,
      isHero: i === 0,
    })),
  );

  const unlicensed = media.filter((m) => m.licence === "TBD").length;
  const official = media.filter((m) => m.source === "official").length;

  return (
    <RequireCapability capability="media.manage">
      <AdminPageHeader
        title="Media library"
        description="Every image needs a cleared licence and an attribution before its destination can be published. Seed records ship with these blank rather than fabricated."
        actions={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground"
          >
            <Upload className="size-4" aria-hidden />
            Upload
          </button>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Images" value={media.length} />
          <StatTile label="Official source" value={official} />
          <StatTile
            label="Community contributed"
            value={media.length - official}
          />
          <StatTile
            label="Licence not cleared"
            value={unlicensed}
            sub="Blocks publication"
            tone={unlicensed > 0 ? "danger" : "success"}
          />
        </div>

        {unlicensed > 0 ? (
          <p className="inline-flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/8 px-4 py-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {unlicensed} images have no cleared licence. Sources to use: state
            tourism board imagery where the licence permits it, Wikimedia
            Commons with attribution, or photography we own. Log the source for
            every image.
          </p>
        ) : null}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {media.map((m) => (
            <li
              key={m.id}
              className="overflow-hidden rounded-(--radius-card) border border-border bg-card"
            >
              <div className="relative aspect-[4/3] bg-muted">
                <Photo media={m} tier={m.tier} alt={m.caption ?? ""} sizes="25vw" />
                {m.isHero ? (
                  <Badge variant="default" className="absolute top-2 left-2">
                    Hero
                  </Badge>
                ) : null}
                <Badge
                  variant={m.source === "official" ? "primary" : "muted"}
                  className="absolute top-2 right-2 capitalize"
                >
                  {m.source}
                </Badge>
              </div>
              <div className="p-3.5">
                <p className="truncate text-xs font-medium">{m.destinationName}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {m.caption}
                </p>
                <dl className="mt-2.5 space-y-1 border-t border-border pt-2.5 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Attribution</dt>
                    <dd className="truncate">{m.attribution}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Licence</dt>
                    <dd
                      className={
                        m.licence === "TBD" ? "font-semibold text-danger" : ""
                      }
                    >
                      {m.licence}
                    </dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </RequireCapability>
  );
}
