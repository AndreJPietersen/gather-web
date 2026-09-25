import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-ink">Choose a new password</h1>
      {data.user ? (
        <ResetPasswordForm />
      ) : (
        <p className="text-sm font-semibold text-text-muted">
          This link has expired or was already used.{" "}
          <Link href="/forgot-password" className="font-extrabold text-primary">
            Request a new one
          </Link>
        </p>
      )}
    </main>
  );
}
