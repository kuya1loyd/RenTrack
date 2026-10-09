"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { safeParseJson } from "@/lib/data";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${token}`)
      .then((res) => safeParseJson(res))
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setMessage("Your email has been verified successfully!");
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("An error occurred during verification.");
      });
  }, [token]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-surface px-4">
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/favicon/Landing page and login page.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary-900/85 via-primary-900/70 to-secondary-900/80" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/20 bg-white/95 p-8 text-center shadow-2xl"
      >
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Verifying your email...</h2>
            <p className="text-sm text-gray-500">Please wait while we verify your email address.</p>
          </>
        )}

        {status === "success" && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            </motion.div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
            <p className="text-sm text-gray-500 mb-6">{message}</p>
            <Link href="/login?mode=signin">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Continue to Login
              </Button>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            </motion.div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
            <p className="text-sm text-gray-500 mb-6">{message}</p>
            <div className="space-y-3">
              <Link href="/login?mode=signin">
                <Button variant="outline" className="w-full">
                  Back to Login
                </Button>
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <Loader2 className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
