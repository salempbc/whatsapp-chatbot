'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { useTheme } from 'next-themes';
import {
  Plus,
  Search,
  ListTodo,
  CheckCircle2,
  Circle,
  LayoutGrid,
  List,
  Sun,
  Moon,
} from 'lucide-react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    fn();
  }, []);

  const setStatus = (status: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('status', status);
    router.push(url.pathname + url.search);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      <Command
        className="w-full max-w-lg rounded-xl border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        shouldFilter
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Command.Input
            autoFocus
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>

          <Command.Group heading="Actions" className="text-xs text-muted-foreground px-2 py-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
            <Command.Item
              onSelect={() => run(() => document.getElementById('add-task-btn')?.click())}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              <Plus className="w-4 h-4" /> Add new task
            </Command.Item>
            <Command.Item
              onSelect={() => run(() => document.getElementById('todo-search')?.focus())}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              <Search className="w-4 h-4" /> Focus search
            </Command.Item>
            <Command.Item
              onSelect={() => run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} Toggle theme
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Filter" className="text-xs text-muted-foreground px-2 py-1.5">
            <Command.Item
              onSelect={() => run(() => setStatus('all'))}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              <ListTodo className="w-4 h-4" /> Show all tasks
            </Command.Item>
            <Command.Item
              onSelect={() => run(() => setStatus('active'))}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              <Circle className="w-4 h-4" /> Show active tasks
            </Command.Item>
            <Command.Item
              onSelect={() => run(() => setStatus('completed'))}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              <CheckCircle2 className="w-4 h-4" /> Show completed tasks
            </Command.Item>
          </Command.Group>

          <Command.Group heading="View" className="text-xs text-muted-foreground px-2 py-1.5">
            <Command.Item
              onSelect={() => run(() => document.getElementById('group-toggle-btn')?.click())}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              <LayoutGrid className="w-4 h-4" /> Toggle grouped view
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
