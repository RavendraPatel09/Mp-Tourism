"use client";

import * as React from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
}

/**
 * Sortable, filterable table for the admin lists.
 *
 * Deliberately small — the admin has four list screens and none of them needs
 * virtualisation, column pinning or a table library at MVP volume.
 */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  searchKeys,
  searchPlaceholder = "Search…",
  initialSort,
  toolbar,
  emptyTitle = "Nothing here",
  emptyDescription,
}: {
  rows: T[];
  columns: Column<T>[];
  searchKeys?: (row: T) => string;
  searchPlaceholder?: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState(initialSort);

  const filtered = React.useMemo(() => {
    let out = rows;
    if (query && searchKeys) {
      const needle = query.toLowerCase();
      out = out.filter((r) => searchKeys(r).toLowerCase().includes(needle));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          const cmp = typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, query, sort, columns, searchKeys]);

  function toggleSort(key: string) {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  return (
    <div className="rounded-(--radius-card) border border-border bg-card">
      {(searchKeys || toolbar) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          {searchKeys ? (
            <div className="relative min-w-56 flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-9 w-full rounded-lg border border-border bg-input pr-3 pl-9 text-sm"
              />
            </div>
          ) : null}
          {toolbar}
          <p className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            {filtered.length} of {rows.length}
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          className="m-4 border-0"
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              {columns.map((c) => (
                <Th
                  key={c.key}
                  className={c.className}
                  aria-sort={
                    c.sortValue && sort?.key === c.key
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : c.sortValue
                        ? "none"
                        : undefined
                  }
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        sort?.key === c.key && "text-foreground",
                      )}
                    >
                      {c.header}
                      <ArrowUpDown className="size-3" aria-hidden />
                    </button>
                  ) : (
                    c.header
                  )}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <Tr key={row.id}>
                {columns.map((c) => (
                  <Td key={c.key} className={c.className}>
                    {c.render(row)}
                  </Td>
                ))}
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
