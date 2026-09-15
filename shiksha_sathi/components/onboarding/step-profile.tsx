"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Hash, Loader2, MapPin, Search } from "lucide-react";

import { apiFetch, type SchoolSearchResult } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StepProfileProps = {
  fullName: string;
  onFullNameChange: (value: string) => void;
  selectedSchool: SchoolSearchResult | null;
  onSelectSchool: (school: SchoolSearchResult | null) => void;
  onNext: () => void;
};

export function StepProfile({
  fullName,
  onFullNameChange,
  selectedSchool,
  onSelectSchool,
  onNext,
}: StepProfileProps) {
  const [query, setQuery] = useState(selectedSchool?.name ?? "");
  const [results, setResults] = useState<SchoolSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    // Editing the text after a selection was made invalidates that selection
    // -- the school_id we'd submit no longer matches what's on screen.
    if (selectedSchool && query !== selectedSchool.name) {
      onSelectSchool(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to `query` only
  }, [query]);

  const trimmedQuery = debouncedQuery.trim();
  const isNumeric = /^\d+$/.test(trimmedQuery);
  const is11DigitUdise = /^\d{11}$/.test(trimmedQuery);
  const searchEligible = trimmedQuery.length >= 2 && !selectedSchool;

  useEffect(() => {
    if (!searchEligible) return;
    let cancelled = false;

    const run = async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`/schools/search?q=${encodeURIComponent(trimmedQuery)}`);
        const data = res.ok ? ((await res.json()) as SchoolSearchResult[]) : [];
        if (!cancelled) setResults(data);
      } finally {
        if (!cancelled) setSearching(false);
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [searchEligible, trimmedQuery]);

  function handleSelect(school: SchoolSearchResult) {
    onSelectSchool(school);
    setQuery(school.name);
    setShowResults(false);
  }

  const canContinue = fullName.trim().length > 0 && selectedSchool !== null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="full-name">Your full name</Label>
        <Input
          id="full-name"
          value={fullName}
          onChange={(e) => onFullNameChange(e.target.value)}
          placeholder="e.g. Anita Kumari"
          className="h-12 text-base"
          autoFocus
        />
      </div>

      <div className="relative flex flex-col gap-2">
        <Label htmlFor="school-search">Your school</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="school-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder="Search by school name or 11-digit UDISE code"
            className="h-12 pl-9 pr-24 text-base"
            autoComplete="off"
          />
          {searching ? (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : is11DigitUdise ? (
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-mono font-medium text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
              UDISE 11-digit
            </span>
          ) : null}
        </div>

        {selectedSchool && selectedSchool.udise_code && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            <span>Verified Government School · UDISE: <strong className="font-mono">{selectedSchool.udise_code}</strong></span>
          </div>
        )}

        {showResults && searchEligible && results.length > 0 && (
          <div className="absolute top-full z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-md">
            {results.map((school) => (
              <button
                key={school.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(school)}
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
          </div>
        )}

        {showResults && searchEligible && !searching && results.length === 0 && (
          <div className="absolute top-full z-10 mt-1 w-full rounded-lg border border-border bg-popover px-3 py-2.5 text-sm text-muted-foreground shadow-md">
            {isNumeric && trimmedQuery.length < 11 ? (
              <p>Keep typing... UDISE codes are <strong>11 digits</strong> (e.g. 10280100101).</p>
            ) : (
              <p>No schools found. Check spelling or try your 11-digit UDISE code.</p>
            )}
          </div>
        )}
      </div>

      <Button
        type="button"
        size="lg"
        disabled={!canContinue}
        onClick={onNext}
        className="h-12 w-full text-base"
      >
        Continue
      </Button>
    </div>
  );
}
