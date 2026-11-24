"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AgentProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/agent#profile");
  }, [router]);

  return null;
}
