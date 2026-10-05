"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bulkDeleteTodos, bulkCompleteTodos } from "@/app/actions/todo.actions";

interface BulkActionsProps {
  selectedIds: string[];
  onClear: () => void;
}

export function BulkActions({ selectedIds, onClear }: BulkActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const count = selectedIds.length;

  const handleBulkComplete = () => {
    startTransition(async () => {
      await bulkCompleteTodos(selectedIds);
      onClear();
      router.refresh();
    });
  };

  const handleBulkDelete = () => {
    startTransition(async () => {
      await bulkDeleteTodos(selectedIds);
      onClear();
      router.refresh();
    });
  };

  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg">
      <span className="text-sm font-medium text-primary flex-1">
        {count} task{count !== 1 ? "s" : ""} selected
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={handleBulkComplete}
        disabled={isPending}
        id="bulk-complete-btn"
        className="h-7 text-xs gap-1.5"
      >
        <CheckCheck className="h-3.5 w-3.5" />
        Mark Done
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleBulkDelete}
        disabled={isPending}
        id="bulk-delete-btn"
        className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        disabled={isPending}
        className="h-7 w-7"
        aria-label="Clear selection"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
