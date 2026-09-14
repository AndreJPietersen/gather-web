import { toggleTaskCompleted } from "./actions";

// No "use client" needed — a plain <form> submitting a Server Action works
// fine as a Server Component, since the interactivity is a native browser
// form submission, not client-side React state.

export function TaskToggle({
  taskId,
  eventId,
  completed,
}: {
  taskId: string;
  eventId: string;
  completed: boolean;
}) {
  return (
    <form action={toggleTaskCompleted}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="completed" value={String(!completed)} />
      <button
        type="submit"
        aria-label={completed ? "Mark incomplete" : "Mark complete"}
        className={`h-5 w-5 rounded-full border-2 ${completed ? "border-success bg-success" : "border-border bg-surface"}`}
      />
    </form>
  );
}
