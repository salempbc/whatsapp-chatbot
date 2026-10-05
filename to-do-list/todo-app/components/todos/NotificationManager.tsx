'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface NotifiableTodo {
  _id: string;
  title: string;
  completed: boolean;
  dueDate?: Date | string | null;
}

const CHECK_INTERVAL_MS = 60_000;
const REMINDER_WINDOW_MS = 30 * 60_000;

export function NotificationManager({ todos }: { todos: NotifiableTodo[] }) {
  const notifiedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      toast('Enable due-date reminders?', {
        duration: 8000,
        action: {
          label: 'Enable',
          onClick: () => Notification.requestPermission(),
        },
      });
    }

    function checkDueTasks() {
      if (Notification.permission !== 'granted') return;
      const now = Date.now();

      for (const todo of todos) {
        if (todo.completed || !todo.dueDate) continue;
        if (notifiedIds.current.has(todo._id)) continue;

        const due = new Date(todo.dueDate).getTime();
        const diff = due - now;

        if (diff > 0 && diff <= REMINDER_WINDOW_MS) {
          new Notification('Task due soon', {
            body: todo.title,
            tag: todo._id,
          });
          notifiedIds.current.add(todo._id);
        }
      }
    }

    checkDueTasks();
    const interval = setInterval(checkDueTasks, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [todos]);

  return null;
}
