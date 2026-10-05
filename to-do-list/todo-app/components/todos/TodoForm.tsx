'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createTodo, updateTodo } from '@/app/actions/todo.actions';
import { ITodo } from '@/models/Todo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Clock } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDatetimeLocal(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubtaskDraft {
  id: string;
  text: string;
  done: boolean;
}

interface TodoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an existing todo to edit; omit for create mode. */
  todo?: ITodo;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TodoForm({ open, onOpenChange, todo, onSuccess }: TodoFormProps) {
  const isEdit = Boolean(todo);
  const [isPending, startTransition] = useTransition();

  // Core fields
  const [title, setTitle] = useState(todo?.title ?? '');
  const [description, setDescription] = useState(todo?.description ?? '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(todo?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState<string>(toDatetimeLocal(todo?.dueDate));
  const [pinned, setPinned] = useState<boolean>(todo?.pinned ?? false);
  const [recurring, setRecurring] = useState<'none' | 'daily' | 'weekly' | 'monthly'>(
    todo?.recurring ?? 'none',
  );
  const [estimatedTime, setEstimatedTime] = useState<string>(
    todo?.estimatedTime != null ? String(todo.estimatedTime) : '',
  );

  // Tags
  const [tags, setTags] = useState<string[]>(todo?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [editingTagValue, setEditingTagValue] = useState('');

  // Subtasks
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>(
    todo?.subtasks?.map((s) => ({ id: s._id ?? crypto.randomUUID(), text: s.text, done: s.done })) ?? [],
  );

  function addTag() {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function startEditTag(index: number) {
    setEditingTagIndex(index);
    setEditingTagValue(tags[index]);
  }

  function commitEditTag() {
    if (editingTagIndex === null) return;
    const trimmed = editingTagValue.trim().toLowerCase();
    setTags((prev) => {
      const next = [...prev];
      if (!trimmed) {
        next.splice(editingTagIndex, 1);
      } else if (next.includes(trimmed) && next[editingTagIndex] !== trimmed) {
        next.splice(editingTagIndex, 1);
      } else {
        next[editingTagIndex] = trimmed;
      }
      return next;
    });
    setEditingTagIndex(null);
    setEditingTagValue('');
  }

  function addSubtask() {
    if (subtasks.length >= 10) {
      toast.error('Maximum 10 subtasks allowed.');
      return;
    }
    setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), text: '', done: false }]);
  }

  function updateSubtask(id: string, text: string) {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  }

  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  function handleSubmit() {
    if (!title.trim()) {
      toast.error('Title is required.');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      tags,
      pinned,
      recurring,
      estimatedTime: estimatedTime !== '' ? Number(estimatedTime) : null,
      subtasks: subtasks
        .filter((s) => s.text.trim())
        .map((s) => ({ text: s.text.trim(), done: s.done })),
    };

    startTransition(async () => {
      try {
        if (isEdit && todo) {
          await updateTodo(String(todo._id), payload);
          toast.success('Task updated!');
        } else {
          await createTodo(payload);
          toast.success('Task created!');
        }
        onSuccess?.();
        onOpenChange(false);
      } catch (err) {
        toast.error('Something went wrong. Please try again.');
        console.error(err);
      }
    });
  }

  const estimatedMinutes = estimatedTime !== '' ? Number(estimatedTime) : 0;
  const timePreview = formatMinutes(estimatedMinutes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Title */}
          <div className="grid gap-1.5">
            <Label htmlFor="todo-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="todo-title"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="todo-description">Description</Label>
            <Textarea
              id="todo-description"
              placeholder="Add more details..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Priority & Recurring */}
          <div className="flex gap-4 flex-wrap">
            <div className="grid gap-1.5 flex-1 min-w-[140px]">
              <Label htmlFor="todo-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as 'low' | 'medium' | 'high')}
              >
                <SelectTrigger id="todo-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5 flex-1 min-w-[140px]">
              <Label htmlFor="todo-recurring">Recurring</Label>
              <Select
                value={recurring}
                onValueChange={(v) =>
                  setRecurring(v as 'none' | 'daily' | 'weekly' | 'monthly')
                }
              >
                <SelectTrigger id="todo-recurring">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div className="grid gap-1.5">
            <Label htmlFor="todo-due">Due Date and Time</Label>
            <Input
              id="todo-due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Time Estimate */}
          <div className="grid gap-1.5">
            <Label htmlFor="todo-estimate">
              Time Estimate (minutes)
              {timePreview && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Clock className="h-3 w-3" />
                  {timePreview}
                </span>
              )}
            </Label>
            <Input
              id="todo-estimate"
              type="number"
              min={1}
              placeholder="e.g. 90"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="grid gap-1.5">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <>
              <p className="text-xs text-muted-foreground -mb-0.5">Click a tag to rename it.</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tags.map((tag, index) =>
                  editingTagIndex === index ? (
                    <Input
                      key={`${tag}-${index}`}
                      autoFocus
                      value={editingTagValue}
                      onChange={(e) => setEditingTagValue(e.target.value)}
                      onBlur={commitEditTag}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitEditTag();
                        }
                        if (e.key === 'Escape') {
                          setEditingTagIndex(null);
                          setEditingTagValue('');
                        }
                      }}
                      className="h-6 w-24 px-2 text-xs"
                    />
                  ) : (
                    <Badge
                      key={`${tag}-${index}`}
                      variant="secondary"
                      className="gap-1 pr-1 cursor-pointer"
                      onClick={() => startEditTag(index)}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTag(tag);
                        }}
                        className="hover:text-destructive transition-colors"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )
                )}
              </div>
              </>
            )}
          </div>

          {/* Subtasks */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Subtasks ({subtasks.length}/10)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSubtask}
                disabled={subtasks.length >= 10}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>

            {subtasks.length === 0 && (
              <p className="text-sm text-muted-foreground">No subtasks yet.</p>
            )}

            <div className="grid gap-2">
              {subtasks.map((subtask, index) => (
                <div key={subtask.id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                    {index + 1}.
                  </span>
                  <Input
                    placeholder={`Subtask ${index + 1}`}
                    value={subtask.text}
                    onChange={(e) => updateSubtask(subtask.id, e.target.value)}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeSubtask(subtask.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    aria-label="Remove subtask"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pinned */}
          <div className="flex items-center gap-2">
            <input
              id="todo-pinned"
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
            <Label htmlFor="todo-pinned" className="cursor-pointer">
              Pin this task
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
