'use client';

import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { 
  formatRelativeDue, 
  formatTimeAgo, 
  formatFullDatetime, 
  formatEstimate 
} from '@/lib/dateUtils';
import { 
  Pin, 
  PinOff, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  Tag, 
  Clock, 
  Repeat2, 
  MessageSquare, 
  CheckSquare2, 
  Plus,
  X,
  Loader2,
  GripVertical,
  Paperclip,
  Download,
} from 'lucide-react';
import {
  toggleTodo,
  deleteTodo,
  togglePin,
  toggleSubtask,
  addNote,
  editNote,
  deleteNote,
  addSubtask,
  deleteSubtask,
  addAttachment,
  deleteAttachment,
  getAttachmentData,
} from '@/app/actions/todo.actions';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription 
} from '@/components/ui/dialog';
import TodoForm from './TodoForm';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

interface ITodo {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  subtasks: Array<{ _id: string; text: string; done: boolean; createdAt: Date }>;
  notes: Array<{ _id: string; text: string; createdAt: Date }>;
  attachments: Array<{ _id: string; filename: string; mimeType: string; size: number; data: string; createdAt: Date }>;
  completedAt?: Date | null;
  pinned: boolean;
  recurring: 'none' | 'daily' | 'weekly' | 'monthly';
  estimatedTime?: number | null;
  order: number;
}

interface TodoItemProps {
  todo: ITodo;
  isSelected: boolean;
  onSelectChange: (id: string, checked: boolean) => void;
  draggable?: boolean;
}

export function TodoItem({ todo, isSelected, onSelectChange, draggable = false }: TodoItemProps) {
  const [isPending, startTransition] = useTransition();
  const sortable = useSortable({ id: todo._id, disabled: !draggable });
  const dragStyle = draggable
    ? { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
    : undefined;
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleToggle = () => {
    startTransition(async () => {
      try {
        await toggleTodo(todo._id, !todo.completed);
      } catch (e) {
        toast.error('Failed to toggle todo');
      }
    });
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    let undone = false;
    const timer = setTimeout(() => {
      if (undone) return;
      startTransition(async () => {
        try {
          await deleteTodo(todo._id);
        } catch (e) {
          toast.error('Failed to delete todo');
        }
      });
    }, 5000);

    toast('Task deleted', {
      description: todo.title,
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          clearTimeout(timer);
        },
      },
      duration: 5000,
    });
  };

  const handlePin = () => {
    startTransition(async () => {
      try {
        await togglePin(todo._id);
      } catch (e) {
        toast.error('Failed to pin todo');
      }
    });
  };

  const handleToggleSubtask = (subtaskId: string, done: boolean) => {
    startTransition(async () => {
      try {
        await toggleSubtask(todo._id, subtaskId, done);
      } catch (e) {
        toast.error('Failed to toggle subtask');
      }
    });
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    startTransition(async () => {
      try {
        await deleteSubtask(todo._id, subtaskId);
        toast.success('Subtask deleted');
      } catch (e) {
        toast.error('Failed to delete subtask');
      }
    });
  };

  const handleAddSubtask = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    if (!newSubtaskText.trim()) return;
    
    startTransition(async () => {
      try {
        await addSubtask(todo._id, newSubtaskText);
        setNewSubtaskText('');
        setShowAddSubtask(false);
        toast.success('Subtask added');
      } catch (e) {
        toast.error('Failed to add subtask');
      }
    });
  };

  const handleAddNote = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    if (!newNoteText.trim()) return;
    
    startTransition(async () => {
      try {
        await addNote(todo._id, newNoteText);
        setNewNoteText('');
        toast.success('Note added');
      } catch (e) {
        toast.error('Failed to add note');
      }
    });
  };

  const handleDeleteNote = (noteId: string) => {
    startTransition(async () => {
      try {
        await deleteNote(todo._id, noteId);
        toast.success('Note deleted');
      } catch (e) {
        toast.error('Failed to delete note');
      }
    });
  };

  const startEditNote = (noteId: string, text: string) => {
    setEditingNoteId(noteId);
    setEditingNoteText(text);
  };

  const handleSaveNote = (noteId: string) => {
    if (!editingNoteText.trim()) return;
    startTransition(async () => {
      try {
        await editNote(todo._id, noteId, editingNoteText);
        setEditingNoteId(null);
        toast.success('Note updated');
      } catch (e) {
        toast.error('Failed to update note');
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error('File exceeds 3MB limit');
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1] ?? '';
      startTransition(async () => {
        try {
          const res = await addAttachment(todo._id, {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            data: base64,
          });
          if (res.success) {
            toast.success('File attached');
          } else {
            toast.error(res.error ?? 'Failed to attach file');
          }
        } catch (e) {
          toast.error('Failed to attach file');
        } finally {
          setIsUploading(false);
        }
      });
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast.error('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    startTransition(async () => {
      try {
        await deleteAttachment(todo._id, attachmentId);
        toast.success('Attachment removed');
      } catch (e) {
        toast.error('Failed to remove attachment');
      }
    });
  };

  const handleDownloadAttachment = async (attachmentId: string, filename: string) => {
    const res = await getAttachmentData(todo._id, attachmentId);
    if (!res.success || !res.data) {
      toast.error('Failed to download file');
      return;
    }
    const link = document.createElement('a');
    link.href = `data:${res.data.mimeType};base64,${res.data.data}`;
    link.download = filename;
    link.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const dueInfo = todo.dueDate ? formatRelativeDue(todo.dueDate, todo.completed) : null;
  const isOverdue = dueInfo?.status === 'overdue' && !todo.completed;
  
  const completedSubtasks = todo.subtasks.filter(s => s.done).length;
  const totalSubtasks = todo.subtasks.length;
  const subtasksProgress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  return (
    <motion.div
      ref={draggable ? sortable.setNodeRef : undefined}
      style={dragStyle}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className={`relative p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md ${
        todo.pinned ? 'border-l-4 border-l-amber-400' : ''
      } ${
        isOverdue ? 'border-red-200 bg-red-50/30 dark:border-red-900/40 dark:bg-red-950/10' : ''
      } ${
        todo.completed ? 'opacity-70' : ''
      } ${sortable.isDragging ? 'z-10 shadow-lg' : ''}`}
    >
      {/* Top Row */}
      <div className="flex items-start gap-3">
        {draggable && (
          <button
            type="button"
            className="mt-1.5 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none"
            title="Drag to reorder"
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <Checkbox
          checked={isSelected}
          onCheckedChange={(c) => onSelectChange(todo._id, !!c)}
          className="mt-1"
        />
        <Checkbox
          checked={todo.completed}
          onCheckedChange={handleToggle}
          className="mt-1 rounded-full w-5 h-5"
          disabled={isPending}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
              {todo.title}
            </span>
            <Badge variant={todo.priority === 'high' ? 'destructive' : todo.priority === 'medium' ? 'default' : 'secondary'} className="capitalize text-[10px] h-5 px-1.5">
              {todo.priority}
            </Badge>
          </div>
          {todo.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{todo.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={handlePin} disabled={isPending}>
            {todo.pinned ? <PinOff className="w-4 h-4 text-amber-500" /> : <Pin className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setShowEdit(true)}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive/90" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Meta Row */}
      <div className="flex flex-wrap items-center gap-3 mt-3 pl-8 text-xs text-muted-foreground">
        {dueInfo && (
          <div className={`flex items-center gap-1 ${
            dueInfo.status === 'overdue' ? 'text-red-500 font-medium' :
            dueInfo.status === 'due-today' ? 'text-amber-500 font-medium' : ''
          }`} title={formatFullDatetime(todo.dueDate!)}>
            <Calendar className="w-3.5 h-3.5" />
            <span>{dueInfo.label}</span>
          </div>
        )}
        
        {todo.recurring !== 'none' && (
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 font-normal">
            <Repeat2 className="w-3 h-3" />
            <span className="capitalize">{todo.recurring}</span>
          </Badge>
        )}

        {todo.estimatedTime && (
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatEstimate(todo.estimatedTime)}</span>
          </div>
        )}

        {todo.tags.length > 0 && (
          <div className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            <span>{todo.tags.map(t => `#${t}`).join(' ')}</span>
          </div>
        )}

        {todo.notes.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setNotesExpanded(!notesExpanded)}>
            <MessageSquare className="w-3.5 h-3.5 mr-1" />
            Notes ({todo.notes.length})
          </Button>
        )}
        
        {totalSubtasks > 0 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setSubtasksExpanded(!subtasksExpanded)}>
            <CheckSquare2 className="w-3.5 h-3.5 mr-1" />
            {completedSubtasks}/{totalSubtasks}
          </Button>
        )}

        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}>
          <Paperclip className="w-3.5 h-3.5 mr-1" />
          {todo.attachments.length > 0 ? `Files (${todo.attachments.length})` : 'Attach'}
        </Button>
      </div>

      {/* Subtasks Section */}
      {(totalSubtasks > 0 || subtasksExpanded) && (
        <div className="mt-4 pl-8">
          <div className="flex items-center gap-2 mb-2">
            <Progress value={subtasksProgress} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground">{completedSubtasks}/{totalSubtasks}</span>
          </div>
          <div className="space-y-1.5">
            {todo.subtasks.map(st => (
              <div key={st._id} className="flex items-start gap-2 group/st">
                <Checkbox 
                  checked={st.done} 
                  onCheckedChange={() => handleToggleSubtask(st._id, !st.done)}
                  className="mt-0.5 rounded-sm w-4 h-4"
                  disabled={isPending}
                />
                <span className={`text-sm flex-1 ${st.done ? 'line-through text-muted-foreground' : ''}`}>
                  {st.text}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-5 h-5 opacity-0 group-hover/st:opacity-100 h-auto p-0" 
                  onClick={() => handleDeleteSubtask(st._id)}
                  disabled={isPending}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
            
            {showAddSubtask ? (
              <div className="flex items-center gap-2 mt-2">
                <Input 
                  value={newSubtaskText}
                  onChange={e => setNewSubtaskText(e.target.value)}
                  onKeyDown={handleAddSubtask}
                  placeholder="Subtask text..."
                  className="h-7 text-sm"
                  autoFocus
                  disabled={isPending}
                />
                <Button size="sm" className="h-7 px-2" onClick={handleAddSubtask} disabled={isPending}>Add</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowAddSubtask(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="h-6 px-1 text-xs text-muted-foreground mt-1" onClick={() => setShowAddSubtask(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add subtask
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Notes Section */}
      {notesExpanded && (
        <div className="mt-4 pl-8 space-y-3 border-t pt-3">
          {todo.notes.map(note =>
            editingNoteId === note._id ? (
              <div key={note._id} className="bg-muted/50 p-2.5 rounded-md text-sm space-y-2">
                <Input
                  autoFocus
                  value={editingNoteText}
                  onChange={(e) => setEditingNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNote(note._id);
                    if (e.key === 'Escape') setEditingNoteId(null);
                  }}
                  className="h-8 text-sm"
                  disabled={isPending}
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-7" onClick={() => handleSaveNote(note._id)} disabled={isPending || !editingNoteText.trim()}>
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditingNoteId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div key={note._id} className="group/note bg-muted/50 p-2.5 rounded-md text-sm relative">
                <p className="pr-12">{note.text}</p>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {formatTimeAgo(note.createdAt)}
                </span>
                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover/note:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-5 h-5 h-auto p-0"
                    onClick={() => startEditNote(note._id, note.text)}
                    disabled={isPending}
                    title="Edit note"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-5 h-5 h-auto p-0"
                    onClick={() => handleDeleteNote(note._id)}
                    disabled={isPending}
                    title="Delete note"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            )
          )}
          <div className="flex items-center gap-2">
            <Input 
              value={newNoteText}
              onChange={e => setNewNoteText(e.target.value)}
              onKeyDown={handleAddNote}
              placeholder="Add a note..."
              className="h-8 text-sm"
              disabled={isPending}
            />
            <Button size="sm" className="h-8" onClick={handleAddNote} disabled={isPending || !newNoteText.trim()}>Post</Button>
          </div>
        </div>
      )}

      {/* Attachments Section */}
      {attachmentsExpanded && (
        <div className="mt-4 pl-8 space-y-2 border-t pt-3">
          {todo.attachments.map(att => (
            <div key={att._id} className="group/att flex items-center gap-2 bg-muted/50 p-2 rounded-md text-sm">
              <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{att.filename}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatFileSize(att.size)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6"
                onClick={() => handleDownloadAttachment(att._id, att.filename)}
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 opacity-0 group-hover/att:opacity-100"
                onClick={() => handleDeleteAttachment(att._id)}
                disabled={isPending}
              >
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground w-fit">
            {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {isUploading ? 'Uploading...' : 'Add file'} (max 3MB)
            <input type="file" className="hidden" onChange={handleFileSelect} disabled={isUploading} />
          </label>
        </div>
      )}

      {/* Footer Meta */}
      <div className="mt-3 pl-8 flex flex-col gap-0.5">
        {todo.completed && todo.completedAt && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium">
            Completed {formatFullDatetime(todo.completedAt)}
          </span>
        )}
        {(notesExpanded || subtasksExpanded) && (
          <span className="text-[10px] text-muted-foreground/60">
            Created {formatTimeAgo(todo.createdAt)} · Updated {formatTimeAgo(todo.updatedAt)}
          </span>
        )}
      </div>

      {/* Dialogs */}
      <TodoForm open={showEdit} onOpenChange={setShowEdit} todo={todo} onSuccess={() => setShowEdit(false)} />

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Todo</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{todo.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
}
