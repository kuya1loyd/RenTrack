"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, Lock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeParseJson } from "@/lib/data";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: "tenant" }),
      });
      const data = await safeParseJson(response);
      if (!response.ok || !data.success) {
        setError(data.error || "We couldn't create your account. Please try again.");
        return;
      }

      router.push(`/verify-otp?email=${encodeURIComponent(data.email || email)}`);
    } catch {
      setError("Unable to connect right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4 py-10">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/favicon/Landing page and login page.png')" }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-primary-900/85 via-primary-900/70 to-secondary-900/80" />

      <section className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-surface/95 p-6 shadow-xl shadow-black/10 sm:p-8">
        <Link href="/" className="mx-auto mb-6 block w-fit" aria-label="RentTrack home">
          <Image src="/images/landing/logo.png" alt="" width={56} height={56} className="h-14 w-14 rounded-full object-contain" />
        </Link>
        <h1 className="text-center text-2xl font-bold tracking-tight text-text-primary">Create your free account</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-text-secondary">
          Join RentTrack to message Rent Managers and keep track of your inquiries.
        </p>

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <div>
            <label htmlFor="signup-name" className="mb-1 block text-sm font-medium text-text-secondary">Full name</label>
            <div className="relative">
              <UserRound aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                id="signup-name"
                name="name"
                autoComplete="name"
                required
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11 rounded-xl border-border bg-surface-secondary pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="signup-email" className="mb-1 block text-sm font-medium text-text-secondary">Email address</label>
            <div className="relative">
              <Mail aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={200}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 rounded-xl border-border bg-surface-secondary pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="signup-password" className="mb-1 block text-sm font-medium text-text-secondary">Password</label>
            <div className="relative">
              <Lock aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <Input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 rounded-xl border-border bg-surface-secondary pl-10"
              />
            </div>
            <p className="mt-1.5 text-xs text-text-tertiary">
              Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.
            </p>
          </div>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <Button type="submit" variant="gradient" className="h-11 w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create Free Account"}
            {!isSubmitting && <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary-600 underline-offset-4 hover:underline">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
