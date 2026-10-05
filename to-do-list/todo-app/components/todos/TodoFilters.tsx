"use client";

import { useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal, List, LayoutList } from "lucide-react";
import { useDebounce } from "use-debounce";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TodoFiltersProps {
  tags: string[];
}

const statusOptions = [
  { value: "all", label: "All Tasks" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

const priorityOptions = [
  { value: "all", label: "All Priorities" },
  { value: "high", label: "🔴 High" },
  { value: "medium", label: "🟡 Medium" },
  { value: "low", label: "🟢 Low" },
];

const sortOptions = [
  { value: "manual:asc", label: "Manual Order" },
  { value: "createdAt:desc", label: "Newest First" },
  { value: "createdAt:asc", label: "Oldest First" },
  { value: "dueDate:asc", label: "Due Date ↑" },
  { value: "dueDate:desc", label: "Due Date ↓" },
  { value: "priority:asc", label: "Priority ↑" },
  { value: "priority:desc", label: "Priority ↓" },
  { value: "title:asc", label: "Title A–Z" },
  { value: "title:desc", label: "Title Z–A" },
];

export function TodoFilters({ tags }: TodoFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Local search state — debounced push to URL
  const [localSearch, setLocalSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch] = useDebounce(localSearch, 300);

  const createQueryString = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      return params.toString();
    },
    [searchParams]
  );

  // Sync debounced search to URL
  useEffect(() => {
    startTransition(() => {
      router.push(
        `${pathname}?${createQueryString({ search: debouncedSearch || null })}`,
        { scroll: false }
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const updateFilter = (key: string, value: string | null) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString({ [key]: value })}`, {
        scroll: false,
      });
    });
  };

  const currentStatus = searchParams.get("status") || "all";
  const currentPriority = searchParams.get("priority") || "all";
  const currentTag = searchParams.get("tag") || "all";
  const currentSort = `${searchParams.get("sortField") || "createdAt"}:${searchParams.get("sortOrder") || "desc"}`;
  const isGrouped = searchParams.get("grouped") === "1";

  const hasFilters =
    currentStatus !== "all" ||
    currentPriority !== "all" ||
    currentTag !== "all" ||
    localSearch !== "" ||
    currentSort !== "createdAt:desc";

  const clearFilters = () => {
    setLocalSearch("");
    startTransition(() => {
      const params = new URLSearchParams();
      if (isGrouped) params.set("grouped", "1");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="space-y-3">
      {/* Status tabs + group toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateFilter("status", opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                currentStatus === opt.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Group toggle */}
        <Button
          variant={isGrouped ? "default" : "outline"}
          size="sm"
          onClick={() =>
            updateFilter("grouped", isGrouped ? null : "1")
          }
          className="h-8 gap-1.5 text-xs"
          id="group-toggle-btn"
        >
          {isGrouped ? <List className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
          {isGrouped ? "Flat" : "Grouped"}
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="todo-search"
            placeholder="Search tasks..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select value={currentPriority} onValueChange={(v) => updateFilter("priority", v)}>
          <SelectTrigger className="w-full sm:w-[150px]" id="priority-filter">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tags.length > 0 && (
          <Select value={currentTag} onValueChange={(v) => updateFilter("tag", v)}>
            <SelectTrigger className="w-full sm:w-[140px]" id="tag-filter">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  #{tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={currentSort}
          onValueChange={(v) => {
            const [field, order] = v.split(":");
            startTransition(() => {
              router.push(
                `${pathname}?${createQueryString({ sortField: field, sortOrder: order })}`,
                { scroll: false }
              );
            });
          }}
        >
          <SelectTrigger className="w-full sm:w-[160px]" id="sort-filter">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-3">
            <X className="h-3.5 w-3.5 mr-1.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
