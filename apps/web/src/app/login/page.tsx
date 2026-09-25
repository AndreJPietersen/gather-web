import Link from "next/link";
import { LegalLinks } from "@/components/legal/legal-page";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { link } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Log in</h1>
      </div>
      {link === "invalid" && (
        <p className="text-sm font-semibold text-primary">
          That email link has expired or was already used. Log in, or request a new one.
        </p>
      )}
      <LoginForm />
      <p className="text-center text-sm font-semibold text-text-muted">
        <Link href="/forgot-password" className="font-extrabold text-primary">
          Forgot your password?
        </Link>
      </p>
      <p className="text-center text-sm font-semibold text-text-muted">
        New to Gather?{" "}
        <Link href="/register" className="font-extrabold text-primary">
          Create an account
        </Link>
      </p>
      <LegalLinks />
    </main>
  );
}
