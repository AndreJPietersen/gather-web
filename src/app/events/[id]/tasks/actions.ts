"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const addSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().trim().min(2, "Title is too short").max(150),
  dueDate: z.string().optional().or(z.literal("")),
});

export interface TaskFormState {
  error?: string;
}

export async function addTask(_prevState: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const parsed = addSchema.safeParse({
    eventId: formData.get("eventId"),
    title: formData.get("title"),
    dueDate: formData.get("dueDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { eventId, title, dueDate } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("event_tasks").insert({
    event_id: eventId,
    title,
    due_date: dueDate || null,
  });

  if (error) {
    return { error: "Something went wrong adding that task. Please try again." };
  }

  revalidatePath(`/events/${eventId}/tasks`);
  return {};
}

const toggleSchema = z.object({
  taskId: z.string().uuid(),
  eventId: z.string().uuid(),
  completed: z.enum(["true", "false"]),
});

export async function toggleTaskCompleted(formData: FormData): Promise<void> {
  const parsed = toggleSchema.safeParse({
    taskId: formData.get("taskId"),
    eventId: formData.get("eventId"),
    completed: formData.get("completed"),
  });

  if (!parsed.success) {
    return;
  }

  const { taskId, eventId, completed } = parsed.data;

  const supabase = await createClient();
  await supabase
    .from("event_tasks")
    .update({ completed: completed === "true" })
    .eq("id", taskId);

  revalidatePath(`/events/${eventId}/tasks`);
}
