"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Hash, MapPin, Search } from "lucide-react";

import { apiFetch, type SchoolSearchResult } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Input } from "@/components/ui/input";

type Props = {
  id?: string;
  value: SchoolSearchResult | null;
  onChange: (school: SchoolSearchResult | null) => void;
  placeholder?: string;
};

/**
 * School picker backed by `GET /schools/search` and UDISE+ code resolution.
 * Supports searching by School Name or 11-digit national UDISE+ code.
 */
export function SchoolTypeahead({ id, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<SchoolSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounced = useDebouncedValue(query, 300);

  useEffect(() => {
    if (value && query !== value.name) onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to `query` only
  }, [query]);

  const term = debounced.trim();
  const isNumeric = /^\d+$/.test(term);
  const is11DigitUdise = /^\d{11}$/.test(term);
  const eligible = term.length >= 2 && !value;

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    setLoading(true);

    apiFetch(`/schools/search?q=${encodeURIComponent(term)}`)
      .then((r) => (r.ok ? (r.json() as Promise<SchoolSearchResult[]>) : []))
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eligible, term]);

  function select(school: SchoolSearchResult) {
    onChange(school);
    setQuery(school.name);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder ?? "Search by school name or 11-digit UDISE code"}
          className="h-11 pl-9 pr-24 text-base"
          autoComplete="off"
        />
        {is11DigitUdise && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-mono font-medium text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
            UDISE 11-digit
          </span>
        )}
      </div>

      {value && value.udise_code && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5 text-emerald-600" />
          <span>Verified Government School · UDISE: <strong className="font-mono">{value.udise_code}</strong></span>
        </div>
      )}

      {open && eligible && (
        <div className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {loading && results.length === 0 && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Searching schools...
            </div>
          )}

          {results.length > 0 &&
            results.map((school) => (
              <button
                key={school.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(school)}
                className="flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left transition-colors hover:bg-accent focus:bg-accent"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium leading-snug">{school.name}</span>
                  {school.udise_code && (
                    <span className="shrink-0 inline-flex items-center gap-0.5 rounded border border-emerald-500/20 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-mono font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <Hash className="size-3" />
                      {school.udise_code}
                    </span>
                  )}
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  {school.district_name}
                  {school.block_name ? ` · ${school.block_name}` : ""}
                </span>
              </button>
            ))}

          {!loading && results.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">
              {isNumeric && term.length < 11 ? (
                <p>
                  Keep typing... UDISE codes are <strong>11 digits</strong> (e.g. 10280100101).
                </p>
              ) : (
                <p>No schools found. Check spelling or try your 11-digit UDISE code.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
