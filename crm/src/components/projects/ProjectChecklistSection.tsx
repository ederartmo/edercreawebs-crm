"use client";

import { useState } from "react";
import type { ProjectTask, TaskStatus } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProjectChecklistSectionProps {
  tasks: ProjectTask[];
  onUpdateTask: (taskId: string, status: TaskStatus) => Promise<void>;
  loading?: boolean;
}

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  done: "Completada",
  blocked: "Bloqueada",
};

const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  blocked: "bg-red-100 text-red-800",
};

export function ProjectChecklistSection({
  tasks,
  onUpdateTask,
  loading,
}: ProjectChecklistSectionProps) {
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleStatusChange(taskId: string, newStatus: string) {
    setUpdating(taskId);
    try {
      await onUpdateTask(taskId, newStatus as TaskStatus);
    } finally {
      setUpdating(null);
    }
  }

  const completedCount = tasks.filter((t) => t.status === "done").length;
  const completionPercent =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Checklist del Proyecto</h3>
        <div className="text-xs text-gray-600">
          {completedCount} de {tasks.length} completadas ({completionPercent}%)
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500">No hay tareas en el checklist.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-gray-600 mt-1">{task.description}</p>
                )}
              </div>

              <Select
                value={task.status}
                onValueChange={(v) => handleStatusChange(task.id, v ?? task.status)}
                disabled={updating === task.id || loading}
              >
                <SelectTrigger className={`h-7 text-xs w-auto gap-1 ${TASK_STATUS_COLORS[task.status]} border-0 shadow-none`}>
                  <SelectValue>{TASK_STATUS_LABELS[task.status]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["pending", "in_progress", "done", "blocked"] as TaskStatus[]).map(
                    (status) => (
                      <SelectItem key={status} value={status}>
                        {TASK_STATUS_LABELS[status]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
