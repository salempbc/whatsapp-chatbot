'use client';

import { useRef, useState, useEffect } from 'react';
import { Download, ChevronDown, FileJson, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ITodo } from '@/models/Todo';

interface ExportButtonProps {
  todos: ITodo[];
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAsJSON(todos: ITodo[]) {
  const blob = new Blob([JSON.stringify(todos, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `taskflow-export-${getDateStr()}.json`);
}

function exportAsCSV(todos: ITodo[]) {
  const headers = [
    'Title',
    'Description',
    'Priority',
    'Status',
    'DueDate',
    'Tags',
    'Subtasks',
    'EstimatedTime(min)',
    'CreatedAt',
    'CompletedAt',
  ];

  const escape = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const rows = todos.map((todo) => {
    const subtasks = Array.isArray(todo.subtasks)
      ? todo.subtasks.map((s) => s.text).join('|')
      : '';
    const tags = Array.isArray(todo.tags) ? `"${todo.tags.join(',')}"` : '""';

    return [
      escape(todo.title ?? ''),
      escape(todo.description ?? ''),
      escape(todo.priority ?? ''),
      escape(todo.completed ? 'completed' : 'active'),
      escape(todo.dueDate ? new Date(todo.dueDate).toISOString() : ''),
      tags,
      escape(subtasks),
      String(todo.estimatedTime ?? ''),
      escape(todo.createdAt ? new Date(todo.createdAt).toISOString() : ''),
      escape(todo.completedAt ? new Date(todo.completedAt).toISOString() : ''),
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, `taskflow-export-${getDateStr()}.csv`);
}

export function ExportButton({ todos }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleExport(type: 'json' | 'csv') {
    setOpen(false);
    if (type === 'json') exportAsJSON(todos);
    else exportAsCSV(todos);
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-44 rounded-md border border-border bg-popover shadow-lg">
          <button
            onClick={() => handleExport('json')}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors rounded-t-md"
          >
            <FileJson className="h-4 w-4 text-blue-500" />
            Export JSON
          </button>
          <div className="border-t border-border" />
          <button
            onClick={() => handleExport('csv')}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors rounded-b-md"
          >
            <FileText className="h-4 w-4 text-emerald-500" />
            Export CSV
          </button>
        </div>
      )}
    </div>
  );
}
