"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsSummary } from "@/lib/types";

/**
 * Admin analytics.
 *
 * TEAM_PLAN: "Two charts that a tourism officer actually understands beat
 * twelve they don't." So this is five, each answering one question a board
 * actually asks, and the tier colours match the ones used on pins and badges.
 */

const AXIS = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
};

const GRID = "var(--border)";

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--card-foreground)",
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function FootfallChart({ data }: { data: AnalyticsSummary["footfall"] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="t34" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-tier-4)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="var(--color-tier-4)" stopOpacity={0.08} />
          </linearGradient>
          <linearGradient id="t12" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-tier-1)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--color-tier-1)" stopOpacity={0.06} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} tickLine={false} minTickGap={40} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) => shortDate(String(v))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="tier34"
          name="Tier 3 & 4"
          stackId="1"
          stroke="var(--color-tier-4)"
          fill="url(#t34)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="tier12"
          name="Tier 1 & 2"
          stackId="1"
          stroke="var(--color-tier-1)"
          fill="url(#t12)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ShareTrendChart({ data }: { data: AnalyticsSummary["footfall"] }) {
  const points = data.map((p) => ({
    date: p.date,
    share: +((p.tier34 / p.checkIns) * 100).toFixed(1),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} tickLine={false} minTickGap={40} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} unit="%" domain={[20, 50]} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) => shortDate(String(v))}
          formatter={(v) => [`${v}%`, "Tier 3+4 share"]}
        />
        <Line
          type="monotone"
          dataKey="share"
          stroke="var(--accent)"
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DistrictChart({ data }: { data: AnalyticsSummary["byDistrict"] }) {
  const rows = data.slice(0, 10);
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 32)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" {...AXIS} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="district" width={110} {...AXIS} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="checkIns" name="Check-ins" radius={[0, 4, 4, 0]}>
          {rows.map((r) => (
            <Cell
              key={r.district}
              fill={r.tier34Share >= 0.5 ? "var(--color-tier-4)" : "var(--color-tier-2)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SeasonalityChart({ data }: { data: AnalyticsSummary["seasonality"] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" {...AXIS} tickLine={false} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="checkIns" name="Check-ins" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CampaignLiftChart({ data }: { data: AnalyticsSummary["campaignLift"] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="destination" {...AXIS} tickLine={false} interval={0} angle={-12} textAnchor="end" height={54} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="before" name="Before campaign" fill="var(--color-tier-1)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="after" name="During campaign" fill="var(--accent)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
