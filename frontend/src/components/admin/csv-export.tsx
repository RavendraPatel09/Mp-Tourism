"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * CSV export (PRD F25). Departments run on spreadsheets — an analytics screen
 * a tourism officer cannot get into Excel is an analytics screen they will not
 * use.
 */
export function CsvExport<T extends object>({
  rows,
  filename,
  label = "Export CSV",
}: {
  rows: T[];
  filename: string;
  label?: string;
}) {
  function download() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]) as (keyof T)[];
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.map((h) => String(h)).join(","),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
    ].join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={download} className="gap-1.5">
      <Download className="size-3.5" aria-hidden />
      {label}
    </Button>
  );
}
