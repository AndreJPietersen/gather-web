"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";

const commentSchema = z.object({
  caseId: z.string().uuid(),
  body: z.string().trim().min(1, "Comment can't be empty").max(2000),
});

export interface CommentState {
  error?: string;
}

export async function addCaseComment(_prevState: CommentState, formData: FormData): Promise<CommentState> {
  const { userId } = await requireAdmin();
  const parsed = commentSchema.safeParse({
    caseId: formData.get("caseId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please enter a comment." };
  }

  const service = createServiceClient();
  const { error } = await service.from("support_case_comments").insert({
    case_id: parsed.data.caseId,
    author_id: userId,
    body: parsed.data.body,
  });

  if (error) {
    return { error: "Something went wrong posting that comment." };
  }

  // Deliberately not calling logAdminAction here — a comment is the normal
  // working content of a case, not a mutation to the case record itself
  // (status/assignment/resolution), which is what the audit log is for.
  revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  return {};
}

const statusSchema = z.object({
  caseId: z.string().uuid(),
  status: z.enum(["open", "pending", "resolved", "closed"]),
});

export async function updateCaseStatus(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = statusSchema.safeParse({
    caseId: formData.get("caseId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const service = createServiceClient();
  const isResolving = parsed.data.status === "resolved" || parsed.data.status === "closed";
  const { error } = await service
    .from("support_cases")
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
      resolved_at: isResolving ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.caseId);

  if (!error) {
    await logAdminAction({
      adminId: userId,
      action: "case.status_changed",
      targetTable: "support_cases",
      targetId: parsed.data.caseId,
      detail: { status: parsed.data.status },
    });
    revalidatePath(`/admin/cases/${parsed.data.caseId}`);
  }
}
