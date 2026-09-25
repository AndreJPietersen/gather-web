import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatZAR } from "@gather/shared/utils";
import { isInstallmentOverdue } from "@/lib/upcoming";
import { getVendorAccess } from "../../access";

interface BookingWithPlanRow {
  id: string;
  events: { name: string } | null;
  payment_plans: {
    id: string;
    total_amount: string;
    payment_installments: { amount: string; status: string; due_date: string }[];
  }[];
}

// New surface — nothing on the vendor side showed payment status at all
// before this (only the amount on a submitted quote). Read-only: a vendor
// can see what's owed and what's been paid across their own bookings, the
// same planner-entered numbers events/[id]/payments already manages, but
// has no write access here — payment_plans/payment_installments stay
// planner-only, same posture budget_items' own comment documents.
export default async function VendorPaymentsPage({ params }: PageProps<"/vendor/[vendorId]/dashboard/payments">) {
  const { vendorId } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase.from("vendors").select("id, name").eq("id", vendorId).maybeSingle<{ id: string; name: string }>();
  if (!vendor) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getVendorAccess(vendorId, user?.id ?? null);
  if (!access.isTeamMember) {
    notFound();
  }
  // Payment amounts are Owner/Manager only (the database hides them from
  // Staff too — payment_plans/installments select policies).
  if (access.role === "staff") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-6 py-10">
        <PageHeader title="Payments" />
        <Card>
          <p className="text-sm font-semibold text-text-muted">
            Payment details are only visible to this business&apos;s Owner and Managers.
          </p>
        </Card>
      </main>
    );
  }

  const { data: bookings } = await supabase
    .from("event_vendors")
    .select("id, events(name), payment_plans(id, total_amount, payment_installments(amount, status, due_date))")
    .eq("vendor_id", vendorId)
    .returns<BookingWithPlanRow[]>();

  const withPlans = (bookings ?? []).filter((b) => b.payment_plans.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Payments">
        <p className="text-sm font-semibold text-text-muted">{vendor.name}</p>
      </PageHeader>

      <StaggerList className="flex flex-col gap-2.5">
        {withPlans.length > 0 ? (
          withPlans.map((booking) => {
            const plan = booking.payment_plans[0];
            const planTotal = Number(plan.total_amount);
            const paid = plan.payment_installments.filter((i) => i.status === "paid").reduce((sum, i) => sum + Number(i.amount), 0);
            const overdue = plan.payment_installments.some((i) => isInstallmentOverdue(i.status, i.due_date));

            return (
              <StaggerItem key={booking.id}>
                <Card className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-extrabold text-text">{booking.events?.name ?? "Event"}</p>
                    {overdue && (
                      <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-text-muted">Total</p>
                    <p className="text-sm font-extrabold text-text">{formatZAR(planTotal)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-text-muted">Paid</p>
                    <p className="text-sm font-extrabold text-success">{formatZAR(paid)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-text-muted">Outstanding</p>
                    <p className="text-sm font-extrabold text-primary">{formatZAR(planTotal - paid)}</p>
                  </div>
                  <Link href={`/vendor/${vendorId}/bookings/${booking.id}/chat`} className="mt-1 text-xs font-extrabold text-primary">
                    Chat about this booking
                  </Link>
                </Card>
              </StaggerItem>
            );
          })
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No payment plans yet.</p>
          </Card>
        )}
      </StaggerList>
    </main>
  );
}
