import Link from "next/link";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { persona: personaParam } = await searchParams;
  const persona = personaParam === "vendor" ? "vendor" : "planner";

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
      <RegisterForm persona={persona} />
      <p className="text-center text-sm font-semibold text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-extrabold text-primary">
          Log in
        </Link>
      </p>
    </main>
  );
}
