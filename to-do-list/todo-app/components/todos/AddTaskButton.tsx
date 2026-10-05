"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import TodoForm from "@/components/todos/TodoForm";

export function AddTaskButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} id="add-task-btn" className="gap-2">
        <Plus className="h-4 w-4" />
        Add Task
      </Button>
      <TodoForm open={open} onOpenChange={setOpen} />
    </>
  );
}
