import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Reset your password</h1>
        <p className="mt-1 text-sm font-semibold text-text-muted">Enter your email and we&apos;ll send you a link.</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm font-semibold text-text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
