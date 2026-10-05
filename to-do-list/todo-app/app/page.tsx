import { Suspense } from "react";
import {
  getTodos,
  getStats,
  getAllTags,
  FilterStatus,
  SortField,
  SortOrder,
} from "@/app/actions/todo.actions";
import StatsCards from "@/components/todos/StatsCards";
import ProgressBar from "@/components/todos/ProgressBar";
import { TodoFilters } from "@/components/todos/TodoFilters";
import { TodoList } from "@/components/todos/TodoList";
import { AddTaskButton } from "@/components/todos/AddTaskButton";
import QuickAdd from "@/components/todos/QuickAdd";
import { ExportButton } from "@/components/todos/ExportButton";
import KeyboardShortcuts from "@/components/todos/KeyboardShortcuts";
import { CommandPalette } from "@/components/todos/CommandPalette";
import { NotificationManager } from "@/components/todos/NotificationManager";
import { Skeleton } from "@/components/ui/skeleton";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    tag?: string;
    search?: string;
    sortField?: string;
    sortOrder?: string;
    grouped?: string;
  }>;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-[72px] rounded-xl" />
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-lg" />
      ))}
    </div>
  );
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;

  const status = (params.status || "all") as FilterStatus;
  const priority = params.priority || "all";
  const tag = params.tag || "all";
  const search = params.search || "";
  const sortField = (params.sortField || "createdAt") as SortField;
  const sortOrder = (params.sortOrder || "desc") as SortOrder;
  const grouped = params.grouped === "1";

  const [todosResult, tagsResult, statsResult] = await Promise.all([
    getTodos({ status, priority, tag, search, sortField, sortOrder }),
    getAllTags(),
    getStats(),
  ]);

  const todos = todosResult.data ?? [];
  const tags = tagsResult.data ?? [];
  const stats = statsResult.data ?? {
    total: 0,
    completed: 0,
    active: 0,
    overdue: 0,
    totalEstimatedMins: 0,
    completedEstimatedMins: 0,
  };

  return (
    <>
      <KeyboardShortcuts />
      <CommandPalette />
      <NotificationManager todos={todos} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Stats */}
        <Suspense fallback={<StatsSkeleton />}>
          <StatsCards />
        </Suspense>

        {/* Progress bar */}
        {stats.total > 0 && (
          <ProgressBar
            total={stats.total}
            completed={stats.completed}
            totalEstimatedMins={stats.totalEstimatedMins}
            completedEstimatedMins={stats.completedEstimatedMins}
          />
        )}

        {/* Quick add */}
        <QuickAdd />

        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">My Tasks</h2>
            <p className="text-sm text-muted-foreground">
              {todos.length} task{todos.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <div className="flex items-center gap-2">
            {todos.length > 0 && <ExportButton todos={todos} />}
            <AddTaskButton />
          </div>
        </div>

        {/* Filters */}
        <Suspense fallback={<Skeleton className="h-20 rounded-lg" />}>
          <TodoFilters tags={tags} />
        </Suspense>

        {/* List */}
        <Suspense fallback={<ListSkeleton />}>
          <TodoList todos={todos} grouped={grouped} manualOrder={sortField === "manual"} />
        </Suspense>
      </div>
    </>
  );
}
