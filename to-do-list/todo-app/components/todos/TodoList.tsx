'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { getTodoGroup, GROUP_META, TodoGroup } from '@/lib/dateUtils';
import { TodoItem } from './TodoItem';
import { BulkActions } from './BulkActions';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import { ITodo } from '@/models/Todo';
import { reorderTodos } from '@/app/actions/todo.actions';

interface TodoListProps {
  todos: ITodo[];
  grouped?: boolean;
  manualOrder?: boolean;
}

export function TodoList({ todos, grouped = false, manualOrder = false }: TodoListProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [orderedTodos, setOrderedTodos] = useState(todos);
  useEffect(() => setOrderedTodos(todos), [todos]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedTodos.findIndex((t) => t._id === active.id);
    const newIndex = orderedTodos.findIndex((t) => t._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(orderedTodos, oldIndex, newIndex);
    setOrderedTodos(next);
    reorderTodos(next.map((t) => t._id));
  }

  // Initialize all groups as expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<TodoGroup>>(new Set([
    'pinned', 'overdue', 'today', 'tomorrow', 'this-week', 'later', 'no-date', 'completed'
  ]));

  const handleSelectChange = (id: string, checked: boolean) => {
    setSelectedIds(prev => 
      checked ? [...prev, id] : prev.filter(selectedId => selectedId !== id)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(orderedTodos.map(t => t._id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleGroup = (group: TodoGroup) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  if (orderedTodos.length === 0) {
    return (
      <div className="py-12 text-center border rounded-xl bg-card/50 border-dashed">
        <p className="text-muted-foreground">No tasks found. Create one to get started!</p>
      </div>
    );
  }

  const allSelected = orderedTodos.length > 0 && selectedIds.length === orderedTodos.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < orderedTodos.length;

  const renderFlatList = () => {
    const items = orderedTodos.map(todo => (
      <TodoItem
        key={todo._id}
        todo={todo}
        isSelected={selectedIds.includes(todo._id)}
        onSelectChange={handleSelectChange}
        draggable={manualOrder}
      />
    ));

    if (!manualOrder) {
      return (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">{items}</AnimatePresence>
        </div>
      );
    }

    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedTodos.map(t => t._id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">{items}</div>
        </SortableContext>
      </DndContext>
    );
  };

  const renderGroupedList = () => {
    const groupedTodos: Record<TodoGroup, ITodo[]> = {
      'pinned': [],
      'overdue': [],
      'today': [],
      'tomorrow': [],
      'this-week': [],
      'later': [],
      'no-date': [],
      'completed': []
    };

    orderedTodos.forEach(todo => {
      const group = getTodoGroup(todo);
      groupedTodos[group].push(todo);
    });

    const groupOrder: TodoGroup[] = [
      'pinned', 'overdue', 'today', 'tomorrow', 'this-week', 'later', 'no-date', 'completed'
    ];

    return (
      <div className="space-y-6">
        {groupOrder.map(group => {
          const groupTodos = groupedTodos[group];
          if (groupTodos.length === 0) return null;

          const isExpanded = expandedGroups.has(group);
          const meta = GROUP_META[group];

          return (
            <div key={group} className="space-y-2">
              <motion.div 
                className="flex items-center gap-2 py-2 px-1 cursor-pointer select-none group/header"
                onClick={() => toggleGroup(group)}
                layout
              >
                <div className={`flex items-center gap-2 flex-1 font-medium text-sm ${meta.className}`}>
                  <span className="text-base">{meta.icon}</span>
                  <span>{meta.label}</span>
                  <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                    {groupTodos.length}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </motion.div>
              
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-3"
                  >
                    {groupTodos.map(todo => (
                      <TodoItem 
                        key={todo._id} 
                        todo={todo} 
                        isSelected={selectedIds.includes(todo._id)}
                        onSelectChange={handleSelectChange}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <BulkActions 
          selectedIds={selectedIds} 
          onClear={() => setSelectedIds([])} 
        />
      )}
      
      <div className="flex items-center px-4 py-2 bg-muted/30 rounded-lg border">
        <Checkbox 
          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
          onCheckedChange={handleSelectAll}
          className="mr-3"
        />
        <span className="text-sm text-muted-foreground">
          {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select all'}
        </span>
      </div>

      {grouped ? renderGroupedList() : renderFlatList()}
    </div>
  );
}
