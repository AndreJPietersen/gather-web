import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getEventAccess } from "../access";
import { AddTaskForm } from "./add-task-form";
import { TaskToggle } from "./task-toggle";

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
}

export default async function EventTasksPage({ params }: PageProps<"/events/[id]/tasks">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, owner_id, name").eq("id", id).maybeSingle();
  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getEventAccess(event.id, event.owner_id, user?.id ?? null);
  if (!access.isOwner && !access.isCollaborator) {
    notFound();
  }

  const { data: tasks } = await supabase
    .from("event_tasks")
    .select("id, title, due_date, completed")
    .eq("event_id", event.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .returns<TaskRow[]>();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Tasks</h1>
        <p className="mt-1 text-sm font-semibold text-text-muted">{event.name}</p>
      </div>

      {access.isEditor && <AddTaskForm eventId={event.id} />}

      <div className="flex flex-col gap-2">
        {tasks && tasks.length > 0 ? (
          tasks.map((task) => (
            <Card key={task.id} className="flex items-center gap-3">
              {access.isEditor ? (
                <TaskToggle taskId={task.id} eventId={event.id} completed={task.completed} />
              ) : (
                <span
                  className={`h-5 w-5 rounded-full border-2 ${task.completed ? "border-success bg-success" : "border-border bg-surface"}`}
                />
              )}
              <div className="flex-1">
                <p className={`text-sm font-bold ${task.completed ? "text-text-muted line-through" : "text-text"}`}>
                  {task.title}
                </p>
                {task.due_date && <p className="text-xs font-semibold text-text-muted">Due {task.due_date}</p>}
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No tasks yet.</p>
          </Card>
        )}
      </div>
    </main>
  );
}
