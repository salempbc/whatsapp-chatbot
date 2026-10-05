'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function KeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // N key: open new task (not in editable fields)
      if ((e.key === 'n' || e.key === 'N') && !isEditable) {
        e.preventDefault();
        document.getElementById('add-task-btn')?.click();
        return;
      }

      // / key: focus search (not in input/textarea)
      if (e.key === '/' && !isEditable) {
        e.preventDefault();
        document.getElementById('todo-search')?.focus();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 z-50',
        'hidden sm:flex items-center gap-3',
        'px-3 py-1.5 rounded-lg',
        'bg-background/80 backdrop-blur-sm',
        'border border-border/60',
        'shadow-sm',
        'text-xs text-muted-foreground select-none',
      )}
      aria-hidden="true"
    >
      <ShortcutItem kbd="N" label="New" />
      <Divider />
      <ShortcutItem kbd="/" label="Search" />
      <Divider />
      <ShortcutItem kbd="Esc" label="Close" />
    </div>
  );
}

function ShortcutItem({ kbd, label }: { kbd: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
        {kbd}
      </kbd>
      <span>{label}</span>
    </span>
  );
}

function Divider() {
  return <span className="text-border">|</span>;
}
