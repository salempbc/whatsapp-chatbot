import {
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
  isPast,
  isThisWeek,
  addDays,
  addWeeks,
  addMonths,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  startOfDay,
  endOfWeek,
  isAfter,
  isBefore,
} from "date-fns";

// ─── Input Formatting ──────────────────────────────────────────────────────

/** Convert a Date to `datetime-local` input value "YYYY-MM-DDTHH:mm" */
export function toDatetimeLocal(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Due Date Display ──────────────────────────────────────────────────────

/** "Aug 19", "Today", "Tomorrow" */
export function formatDueDate(date: Date): string {
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "MMM d");
}

/** "3:30 PM" */
export function formatTime(date: Date): string {
  return format(new Date(date), "h:mm a");
}

/** "Today at 3:30 PM" / "Aug 19 at 3:30 PM" */
export function formatDueDatetime(date: Date): string {
  const d = new Date(date);
  const datePart = formatDueDate(d);
  const timePart = formatTime(d);
  return `${datePart} at ${timePart}`;
}

/** Human-readable relative string for due status */
export function formatRelativeDue(
  date: Date,
  completed: boolean
): { label: string; status: "overdue" | "due-today" | "upcoming" | "done" } {
  const d = new Date(date);
  const now = new Date();

  if (completed) {
    return { label: formatDueDatetime(d), status: "done" };
  }

  if (isPast(d) && !isToday(d)) {
    const days = differenceInDays(now, d);
    const hours = differenceInHours(now, d);
    if (hours < 24) return { label: `Overdue by ${hours}h`, status: "overdue" };
    return {
      label: `Overdue by ${days} day${days !== 1 ? "s" : ""}`,
      status: "overdue",
    };
  }

  if (isToday(d)) {
    const mins = differenceInMinutes(d, now);
    if (mins < 0) return { label: `Overdue by ${Math.abs(mins)}m`, status: "overdue" };
    if (mins < 60) return { label: `Due in ${mins}m`, status: "due-today" };
    const hrs = Math.round(mins / 60);
    return { label: `Due in ${hrs}h`, status: "due-today" };
  }

  if (isTomorrow(d)) return { label: "Due tomorrow", status: "upcoming" };

  const days = differenceInDays(d, now);
  if (days < 7) return { label: `Due in ${days} days`, status: "upcoming" };
  return { label: `Due ${format(d, "MMM d")}`, status: "upcoming" };
}

// ─── Time Ago ──────────────────────────────────────────────────────────────

/** "3 hours ago" / "just now" */
export function formatTimeAgo(date: Date): string {
  const d = new Date(date);
  const mins = differenceInMinutes(new Date(), d);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = differenceInHours(new Date(), d);
  if (hours < 24) return `${hours}h ago`;
  const days = differenceInDays(new Date(), d);
  if (days < 7) return `${days}d ago`;
  return format(d, "MMM d, yyyy");
}

/** "Aug 18, 2026 at 3:30 PM" */
export function formatFullDatetime(date: Date): string {
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
}

// ─── Grouping Helpers ─────────────────────────────────────────────────────

export type TodoGroup =
  | "pinned"
  | "overdue"
  | "today"
  | "tomorrow"
  | "this-week"
  | "later"
  | "no-date"
  | "completed";

export function getTodoGroup(todo: {
  completed: boolean;
  pinned: boolean;
  dueDate?: Date | null;
}): TodoGroup {
  if (todo.completed) return "completed";
  if (todo.pinned) return "pinned";

  if (!todo.dueDate) return "no-date";

  const d = new Date(todo.dueDate);
  const now = new Date();

  if (isPast(d) && !isToday(d)) return "overdue";
  if (isToday(d)) return "today";
  if (isTomorrow(d)) return "tomorrow";
  if (isThisWeek(d, { weekStartsOn: 1 })) return "this-week";
  if (isAfter(d, endOfWeek(now, { weekStartsOn: 1 }))) return "later";

  return "no-date";
}

export const GROUP_META: Record<
  TodoGroup,
  { label: string; icon: string; className: string }
> = {
  pinned: {
    label: "Pinned",
    icon: "📌",
    className: "text-amber-600 dark:text-amber-400",
  },
  overdue: {
    label: "Overdue",
    icon: "🔴",
    className: "text-red-600 dark:text-red-400",
  },
  today: {
    label: "Today",
    icon: "📅",
    className: "text-blue-600 dark:text-blue-400",
  },
  tomorrow: {
    label: "Tomorrow",
    icon: "📆",
    className: "text-purple-600 dark:text-purple-400",
  },
  "this-week": {
    label: "This Week",
    icon: "🗓",
    className: "text-indigo-600 dark:text-indigo-400",
  },
  later: {
    label: "Later",
    icon: "🌐",
    className: "text-slate-600 dark:text-slate-400",
  },
  "no-date": {
    label: "No Date",
    icon: "📭",
    className: "text-slate-500 dark:text-slate-500",
  },
  completed: {
    label: "Completed",
    icon: "✅",
    className: "text-emerald-600 dark:text-emerald-400",
  },
};

// ─── Recurring ────────────────────────────────────────────────────────────

export type RecurringType = "none" | "daily" | "weekly" | "monthly";

export function getNextOccurrence(
  date: Date,
  recurring: RecurringType
): Date | null {
  if (recurring === "none") return null;
  const d = new Date(date);
  if (recurring === "daily") return addDays(d, 1);
  if (recurring === "weekly") return addWeeks(d, 1);
  if (recurring === "monthly") return addMonths(d, 1);
  return null;
}

// ─── Time Estimate ────────────────────────────────────────────────────────

/** Format minutes into readable string: 90 → "1h 30m", 30 → "30m" */
export function formatEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
