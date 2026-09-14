"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient, findUserByEmail } from "@/lib/supabase/service";

const schema = z.object({
  subject: z.string().trim().min(3, "Subject is too short").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  requesterEmail: z.string().trim().email("That doesn't look like a valid email").max(200).optional().or(z.literal("")),
});

export interface NewCaseState {
  error?: string;
}

// Admin-logged only, per docs/gather_web_admin_architecture.md's Open
// Questions — there's no self-service "submit a support request" surface
// yet, so this is how every case starts (a phone call, an email, logged by
// hand). requesterEmail is optional and resolved via the same admin-API
// email lookup already used for event-collaborator invites — a case can
// exist with no known requester (e.g. a general platform issue).
export async function createCase(_prevState: NewCaseState, formData: FormData): Promise<NewCaseState> {
  const { userId } = await requireAdmin();

  const parsed = schema.safeParse({
    subject: formData.get("subject"),
    description: formData.get("description"),
    priority: formData.get("priority"),
    requesterEmail: formData.get("requesterEmail"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the details." };
  }

  const { subject, description, priority, requesterEmail } = parsed.data;

  let requesterId: string | null = null;
  if (requesterEmail) {
    const requester = await findUserByEmail(requesterEmail);
    if (!requester) {
      return { error: "No Gather account found for that email." };
    }
    requesterId = requester.id;
  }

  const service = createServiceClient();
  const { data: created, error } = await service
    .from("support_cases")
    .insert({
      subject,
      description: description || null,
      priority,
      requester_id: requesterId,
      created_by: userId,
      assigned_admin_id: userId,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: "Something went wrong creating that case." };
  }

  await logAdminAction({
    adminId: userId,
    action: "case.created",
    targetTable: "support_cases",
    targetId: created.id,
  });

  redirect(`/admin/cases/${created.id}`);
}
