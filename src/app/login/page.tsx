import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Log in</h1>
      </div>
      <LoginForm />
      <p className="text-center text-sm font-semibold text-text-muted">
        New to Gather?{" "}
        <Link href="/register" className="font-extrabold text-primary">
          Create an account
        </Link>
      </p>
    </main>
  );
}
