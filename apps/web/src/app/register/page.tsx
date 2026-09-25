import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getRegistrationEnabled } from "@/lib/app-settings";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { persona: personaParam } = await searchParams;
  const persona = personaParam === "vendor" ? "vendor" : "planner";
  const registrationEnabled = await getRegistrationEnabled();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          {persona === "vendor" ? "List your business" : "Plan an event"}
        </h1>
        <p className="mt-1 text-sm font-semibold text-text-muted">
          Create an account to get started.
          {persona === "vendor" ? " You'll set up your business next." : ""}
        </p>
      </div>
      {registrationEnabled ? (
        <RegisterForm persona={persona} />
      ) : (
        <Card>
          <p className="text-sm font-extrabold text-ink">Sign-ups are paused</p>
          <p className="mt-1 text-xs font-semibold text-text-muted">
            We&apos;re not taking new accounts right now. Please check back soon — if you already have an account, you can
            still log in.
          </p>
        </Card>
      )}
      <p className="text-center text-sm font-semibold text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-extrabold text-primary">
          Log in
        </Link>
      </p>
    </main>
  );
}
