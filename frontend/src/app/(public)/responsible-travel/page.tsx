import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Leaf, Trash2, Users, Wallet } from "lucide-react";

export const metadata: Metadata = {
  title: "Responsible travel",
  description:
    "Carrying-capacity indicators, eco-sensitive flags and leave-no-trace guidance. Sending crowds to fragile places would defeat the point of this product.",
  alternates: { canonical: "/responsible-travel" },
};

const PRINCIPLES = [
  {
    icon: <Trash2 className="size-5" />,
    title: "Carry it back out",
    body: "Most Tier-4 destinations have no bins, no staff and no waste collection. Whatever you take in comes back out with you, including other people's.",
  },
  {
    icon: <Users className="size-5" />,
    title: "Villages are not exhibits",
    body: "Several listings pass through inhabited communities — Patalkot, the Bagh print workshops, the Chanderi weaver quarter. Ask before photographing anyone, follow your guide's lead on where you may go, and accept no as an answer.",
  },
  {
    icon: <Wallet className="size-5" />,
    title: "Spend locally, and directly",
    body: "Hire the village guide. Buy from the weaver co-operative rather than the highway showroom. Eat at the dhaba. Redistributing footfall only matters if the money follows it.",
  },
  {
    icon: <Leaf className="size-5" />,
    title: "Respect eco-sensitive flags",
    body: "Sites marked eco-sensitive sit inside reserves or fragile habitats. Stay on tracks, keep silent near wildlife, no drones, no plastic past the gate. A state admin can suppress promotion of a site under ecological stress, and we will.",
  },
  {
    icon: <AlertTriangle className="size-5" />,
    title: "Read the hazard flags",
    body: "They are on the listing because someone has been hurt. Unfenced ravine edges, monsoon crossings, unlit underground chambers, tiger habitat. Difficulty ratings are honest, not marketing.",
  },
];

export default function ResponsibleTravelPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Responsible travel</h1>
      <p className="prose-trail mt-3 text-lg text-muted-foreground">
        This product exists to move visitors toward places that currently get
        almost none. Done carelessly, that is a way to damage a hundred fragile
        sites instead of overloading twelve robust ones. So the guardrails are
        part of the design, not an afterthought.
      </p>

      <section className="mt-10" aria-labelledby="built-in-heading">
        <h2 id="built-in-heading" className="text-xl font-semibold tracking-tight">
          What we build in
        </h2>
        <ul className="mt-4 space-y-2.5 text-sm">
          {[
            "A carrying-capacity indicator on every listing, and a high-pressure badge on over-visited sites.",
            "Deliberately low points on marquee destinations — we do not want to send you there.",
            "An eco-sensitive flag, with the specific rules for that site surfaced above the fold.",
            "Genuine hazard flags: monsoon crossings, wildlife zones, unprotected drops, sites with no mobile coverage.",
            "A control for state administrators to temporarily suppress promotion of an ecologically stressed destination.",
            "No promotion of restricted or permit-only areas without a link to the official permit.",
          ].map((line) => (
            <li key={line} className="flex gap-2.5 rounded-lg border border-border bg-card p-3.5">
              <span aria-hidden className="text-success">
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="pledge-heading">
        <h2 id="pledge-heading" className="text-xl font-semibold tracking-tight">
          The explorer&apos;s side
        </h2>
        <ul className="mt-4 space-y-3">
          {PRINCIPLES.map((p) => (
            <li key={p.title} className="flex gap-4 rounded-(--radius-card) border border-border bg-card p-5">
              <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-success/12 text-success">
                {p.icon}
              </span>
              <span>
                <span className="block font-semibold">{p.title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 rounded-(--radius-card) border border-border bg-muted p-5 text-sm text-muted-foreground">
        Taking the leave-no-trace pledge and honouring it across ten check-ins
        earns the Responsible Traveller badge. Clean-up drive participation is
        worth 50 points.{" "}
        <Link href="/points" className="font-medium text-primary hover:underline">
          See the full points table
        </Link>
        .
      </p>
    </div>
  );
}
