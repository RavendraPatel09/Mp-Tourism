import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import type { VerificationSignal } from "@/lib/types";

const ICON = {
  pass: <CheckCircle2 className="size-4 text-success" aria-hidden />,
  fail: <XCircle className="size-4 text-danger" aria-hidden />,
  warn: <AlertTriangle className="size-4 text-warning" aria-hidden />,
  skipped: <MinusCircle className="size-4 text-muted-foreground" aria-hidden />,
} as const;

const LABEL = {
  pass: "Pass",
  fail: "Fail",
  warn: "Review",
  skipped: "Not run",
} as const;

/**
 * Every automated signal from PRD F18, laid out as pass/fail rows.
 *
 * The console shows the inputs, not a verdict — a moderator deciding on 150
 * points needs to see why the pipeline flagged something, and the honest
 * "not run" state for Phase-2 checks matters as much as the passes.
 */
export function VerificationSignals({ signals }: { signals: VerificationSignal[] }) {
  return (
    <ul className="divide-y divide-border">
      {signals.map((s) => (
        <li key={s.key} className="flex gap-3 py-2.5">
          <span className="mt-0.5 shrink-0">{ICON[s.status]}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{s.label}</span>
              <span
                className={`shrink-0 text-[11px] font-semibold tracking-wide uppercase ${
                  s.status === "fail"
                    ? "text-danger"
                    : s.status === "warn"
                      ? "text-warning"
                      : s.status === "pass"
                        ? "text-success"
                        : "text-muted-foreground"
                }`}
              >
                {LABEL[s.status]}
              </span>
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              {s.detail}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
