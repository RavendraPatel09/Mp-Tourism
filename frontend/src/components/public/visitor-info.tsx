"use client";

import {
  AlertTriangle,
  Banknote,
  Camera,
  Car,
  Clock3,
  Droplet,
  ExternalLink,
  Phone,
  Shirt,
  Signal,
  Stethoscope,
  Toilet,
  UserCheck,
  UtensilsCrossed,
} from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { formatInr } from "@/lib/format";
import type { DestinationInfo } from "@/lib/types";

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="block text-sm text-foreground">{value}</span>
      </span>
    </div>
  );
}

function Yes({ value }: { value: boolean }) {
  return (
    <span className={value ? "text-success" : "text-muted-foreground"}>
      {value ? "Available" : "Not available"}
    </span>
  );
}

const COVERAGE_LABEL = {
  none: "No mobile coverage",
  patchy: "Patchy mobile coverage",
  good: "Good mobile coverage",
} as const;

/** PRD F3 visitor info, in full. Hazards are pulled out above the accordion. */
export function VisitorInfoAccordion({ info }: { info: DestinationInfo }) {
  return (
    <section aria-labelledby="visitor-info-heading">
      <h2 id="visitor-info-heading" className="text-xl font-semibold tracking-tight">
        Visitor information
      </h2>

      {info.hazards.length > 0 ? (
        <div className="mt-4 rounded-xl border border-danger/30 bg-danger/8 p-4">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-danger">
            <AlertTriangle className="size-4" aria-hidden />
            Before you go
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground">
            {info.hazards.map((h) => (
              <li key={h} className="flex gap-2">
                <span aria-hidden className="text-danger">
                  •
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Accordion
        className="mt-4 rounded-(--radius-card) border border-border px-5"
        defaultOpen={["timings", "reaching"]}
        items={[
          {
            id: "timings",
            title: (
              <span className="inline-flex items-center gap-2">
                <Clock3 className="size-4 text-muted-foreground" aria-hidden />
                Timings &amp; best time to visit
              </span>
            ),
            content: (
              <div className="divide-y divide-border">
                {info.timings.map((t) => (
                  <Row key={t.label} icon={<Clock3 className="size-4" />} label={t.label} value={t.value} />
                ))}
                {info.bestTimeOfDay ? (
                  <Row
                    icon={<Clock3 className="size-4" />}
                    label="Best time of day"
                    value={info.bestTimeOfDay}
                  />
                ) : null}
              </div>
            ),
          },
          {
            id: "fees",
            title: (
              <span className="inline-flex items-center gap-2">
                <Banknote className="size-4 text-muted-foreground" aria-hidden />
                Entry fees
              </span>
            ),
            content: (
              <ul className="divide-y divide-border">
                {info.entryFees.map((f) => (
                  <li key={f.label} className="flex items-baseline justify-between gap-4 py-2">
                    <span className="text-sm text-foreground">
                      {f.label}
                      {f.note ? (
                        <span className="block text-xs text-muted-foreground">{f.note}</span>
                      ) : null}
                    </span>
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {formatInr(f.amountInr)}
                    </span>
                  </li>
                ))}
              </ul>
            ),
          },
          {
            id: "reaching",
            title: (
              <span className="inline-flex items-center gap-2">
                <Car className="size-4 text-muted-foreground" aria-hidden />
                How to reach &amp; last mile
              </span>
            ),
            content: (
              <div className="space-y-3">
                <p className="text-sm text-foreground">{info.howToReach}</p>
                {info.lastMileNotes ? (
                  <p className="rounded-lg bg-muted p-3 text-sm">
                    <span className="font-medium">Last mile: </span>
                    {info.lastMileNotes}
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            id: "facilities",
            title: (
              <span className="inline-flex items-center gap-2">
                <Toilet className="size-4 text-muted-foreground" aria-hidden />
                Facilities on site
              </span>
            ),
            content: (
              <div className="grid gap-x-8 sm:grid-cols-2">
                <Row icon={<Car className="size-4" />} label="Parking" value={<Yes value={info.facilities.parking} />} />
                <Row icon={<Toilet className="size-4" />} label="Washrooms" value={<Yes value={info.facilities.washrooms} />} />
                <Row icon={<UtensilsCrossed className="size-4" />} label="Food" value={<Yes value={info.facilities.food} />} />
                <Row icon={<Droplet className="size-4" />} label="Drinking water" value={<Yes value={info.facilities.drinkingWater} />} />
                <Row
                  icon={<Signal className="size-4" />}
                  label="Network"
                  value={COVERAGE_LABEL[info.facilities.networkCoverage]}
                />
                {info.facilities.nearestAtmKm !== undefined ? (
                  <Row icon={<Banknote className="size-4" />} label="Nearest ATM" value={`${info.facilities.nearestAtmKm} km`} />
                ) : null}
                {info.facilities.nearestHospitalKm !== undefined ? (
                  <Row
                    icon={<Stethoscope className="size-4" />}
                    label="Nearest hospital"
                    value={`${info.facilities.nearestHospitalKm} km`}
                  />
                ) : null}
              </div>
            ),
          },
          {
            id: "rules",
            title: (
              <span className="inline-flex items-center gap-2">
                <Camera className="size-4 text-muted-foreground" aria-hidden />
                Photography, dress code &amp; guides
              </span>
            ),
            content: (
              <div className="divide-y divide-border">
                {info.photographyRules ? (
                  <Row icon={<Camera className="size-4" />} label="Photography" value={info.photographyRules} />
                ) : null}
                {info.dressCode ? (
                  <Row icon={<Shirt className="size-4" />} label="Dress code" value={info.dressCode} />
                ) : null}
                {info.guideAvailability ? (
                  <Row icon={<UserCheck className="size-4" />} label="Guides" value={info.guideAvailability} />
                ) : null}
                {!info.photographyRules && !info.dressCode && !info.guideAvailability ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    No restrictions recorded. Use your judgement — several of
                    these sites have no staff at all.
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            id: "emergency",
            title: (
              <span className="inline-flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" aria-hidden />
                Emergency contacts
              </span>
            ),
            content: (
              <ul className="divide-y divide-border">
                {info.emergencyContacts.map((c) => (
                  <li key={c.label} className="flex items-center justify-between gap-4 py-2">
                    <span className="text-sm">{c.label}</span>
                    <a
                      href={`tel:${c.number.replace(/[^0-9+]/g, "")}`}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      {c.number}
                    </a>
                  </li>
                ))}
                {info.officialUrl ? (
                  <li className="py-2">
                    <a
                      href={info.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      Official site
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  </li>
                ) : null}
              </ul>
            ),
          },
        ]}
      />
    </section>
  );
}
