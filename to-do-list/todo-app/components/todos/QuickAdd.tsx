'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createTodo } from '@/app/actions/todo.actions';
import { parseQuickAdd } from '@/lib/quickAddParser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Plus, CalendarClock, Tag, HelpCircle } from 'lucide-react';

type Priority = 'low' | 'medium' | 'high';

const PRIORITY_CONFIG: { value: Priority; label: string; className: string; activeClassName: string }[] = [
  {
    value: 'low',
    label: 'Low',
    className: 'border-border text-muted-foreground hover:border-emerald-500 hover:text-emerald-500',
    activeClassName: 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    value: 'medium',
    label: 'Medium',
    className: 'border-border text-muted-foreground hover:border-amber-500 hover:text-amber-500',
    activeClassName: 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    value: 'high',
    label: 'High',
    className: 'border-border text-muted-foreground hover:border-rose-500 hover:text-rose-500',
    activeClassName: 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
];

export default function QuickAdd() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');

  const parsed = useMemo(() => (title.trim() ? parseQuickAdd(title) : null), [title]);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error('Please enter a task title.');
      return;
    }

    const result = parseQuickAdd(trimmed);

    startTransition(async () => {
      try {
        await createTodo({
          title: result.title,
          description: result.description || undefined,
          priority,
          dueDate: result.dueDate ? result.dueDate.toISOString() : null,
          tags: result.tags,
          subtasks: [],
          pinned: false,
          recurring: 'none',
        });
        toast.success('Task added!');
        setTitle('');
        router.refresh();
      } catch (err) {
        toast.error('Failed to create task. Please try again.');
        console.error(err);
      }
    });
  }

  const showPreview = parsed && (parsed.dueDate || parsed.tags.length > 0 || parsed.description);

  return (
    <div
      className={cn(
        'w-full rounded-xl border border-border/70',
        'bg-background/60 backdrop-blur-sm',
        'shadow-sm transition-shadow hover:shadow-md',
        'focus-within:border-primary/50 focus-within:shadow-md',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Large text input */}
        <Input
          id="quick-add-input"
          className={cn(
            'flex-1 border-none bg-transparent shadow-none',
            'text-base placeholder:text-muted-foreground/60',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            'h-9 px-0',
          )}
          placeholder="Quick add a task... try “meet John at 12pm today”"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
          disabled={isPending}
          aria-label="Quick add task"
        />

        {/* Smart parsing help */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
              aria-label="How smart quick add works"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="text-sm">
            <p className="font-medium mb-2">Smart quick add</p>
            <p className="text-muted-foreground mb-3">
              Type naturally — dates, times, tags, and even a description are picked out for you automatically.
            </p>
            <ul className="space-y-2 text-xs">
              <li className="rounded-md bg-muted/60 px-2.5 py-1.5">
                <span className="font-mono">meet John at 12pm today</span>
                <span className="block text-muted-foreground mt-0.5">→ title + due today, 12:00 PM</span>
              </li>
              <li className="rounded-md bg-muted/60 px-2.5 py-1.5">
                <span className="font-mono">team sync - discuss roadmap tomorrow 3pm</span>
                <span className="block text-muted-foreground mt-0.5">→ title, description, due tomorrow 3:00 PM</span>
              </li>
              <li className="rounded-md bg-muted/60 px-2.5 py-1.5">
                <span className="font-mono">pay rent next monday #bills</span>
                <span className="block text-muted-foreground mt-0.5">→ due next Monday, tag &ldquo;bills&rdquo;</span>
              </li>
            </ul>
            <p className="text-muted-foreground mt-3 text-xs">
              Also understands: tonight, in 3 days, next week, Aug 25, 8/20, noon, midnight.
            </p>
          </PopoverContent>
        </Popover>

        {/* Priority toggles */}
        <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Priority">
          {PRIORITY_CONFIG.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(p.value)}
              className={cn(
                'h-7 px-2.5 rounded-md text-xs font-medium border transition-all duration-150',
                priority === p.value ? p.activeClassName : p.className,
              )}
              aria-pressed={priority === p.value}
              aria-label={`Priority: ${p.label}`}
              disabled={isPending}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Submit button */}
        <Button
          id="quick-add-submit"
          size="sm"
          className="h-8 w-8 p-0 shrink-0 rounded-lg"
          onClick={handleSubmit}
          disabled={isPending || !title.trim()}
          aria-label="Add task"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {showPreview && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 -mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">&ldquo;{parsed!.title}&rdquo;</span>
          {parsed!.dueDate && (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {parsed!.dueDate.toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
          {parsed!.tags.length > 0 && (
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {parsed!.tags.join(', ')}
            </span>
          )}
          {parsed!.description && <span className="italic">+ description</span>}
        </div>
      )}
    </div>
  );
}
