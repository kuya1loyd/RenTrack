import { getAdminSupabase, initDatabase } from "@/lib/db";

let agentProfileSchemaPromise: Promise<void> | null = null;

export async function ensureAgentProfileTables() {
  if (!agentProfileSchemaPromise) {
    agentProfileSchemaPromise = (async () => {
      await initDatabase();
      const admin = getAdminSupabase();
      const statements = [
        "ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.users(id) ON DELETE SET NULL",
        "CREATE INDEX IF NOT EXISTS chat_messages_agent_tenant_idx ON public.chat_messages(agent_id, tenant_id)",
        `CREATE TABLE IF NOT EXISTS public.agent_certificates (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          issuer TEXT,
          issued_on DATE,
          storage_path TEXT NOT NULL UNIQUE,
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
          size INTEGER NOT NULL CHECK (size > 0),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        "CREATE INDEX IF NOT EXISTS agent_certificates_agent_id_created_at_idx ON public.agent_certificates(agent_id, created_at DESC)",
        `CREATE TABLE IF NOT EXISTS public.agent_badges (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          badge_key TEXT NOT NULL,
          awarded_by TEXT NOT NULL REFERENCES public.users(id),
          awarded_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(agent_id, badge_key)
        )`,
        "CREATE INDEX IF NOT EXISTS agent_badges_agent_id_awarded_at_idx ON public.agent_badges(agent_id, awarded_at DESC)",
        `CREATE TABLE IF NOT EXISTS public.agent_reviews (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          tenant_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          inquiry_id TEXT NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          comment TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(agent_id, tenant_id)
        )`,
        "CREATE INDEX IF NOT EXISTS agent_reviews_agent_id_created_at_idx ON public.agent_reviews(agent_id, created_at DESC)",
      ];

      for (const sql of statements) {
        const { error } = await admin.rpc("exec_sql", { sql });
        if (error) throw new Error(`Could not prepare Rent Manager profile data: ${error.message}`);
      }

      const { error: reloadError } = await admin.rpc("exec_sql", { sql: "NOTIFY pgrst, 'reload schema'" });
      if (reloadError) throw new Error(`Could not refresh Rent Manager profile data: ${reloadError.message}`);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const checks = await Promise.all([
          admin.from("agent_certificates").select("id").limit(0),
          admin.from("agent_reviews").select("id").limit(0),
          admin.from("agent_badges").select("id").limit(0),
          admin.from("chat_messages").select("tenant_id").limit(0),
        ]);
        const failed = checks.find((result) => result.error);
        if (!failed?.error) return;
        if (attempt === 4) {
          throw new Error(`Rent Manager profile data is unavailable: ${failed.error.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })().catch((error) => {
      agentProfileSchemaPromise = null;
      throw error;
    });
  }
  return agentProfileSchemaPromise;
}

export async function getPublicRentManager(id: string) {
  const client = getAdminSupabase();
  const { data: agent, error } = await client
    .from("users")
    .select("id, name, email, role, created_by")
    .eq("id", id)
    .eq("role", "agent")
    .maybeSingle();
  if (error) throw error;
  if (!agent?.created_by) return null;

  const { data: owner, error: ownerError } = await client
    .from("users")
    .select("id")
    .eq("id", agent.created_by)
    .eq("role", "owner")
    .maybeSingle();
  if (ownerError) throw ownerError;
  return owner ? agent : null;
}
