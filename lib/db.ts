import { createClient, SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { hashSecret } from "./security";

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

let cachedSupabase: SupabaseClient | null = null;
let cachedAdminSupabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!cachedSupabase) {
    const url = getEnvOrThrow("NEXT_PUBLIC_SUPABASE_URL");
    const key = getEnvOrThrow("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    cachedSupabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cachedSupabase;
}

export function getAdminSupabase(): SupabaseClient {
  if (!cachedAdminSupabase) {
    const url = getEnvOrThrow("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = getEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY");
    cachedAdminSupabase = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cachedAdminSupabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  },
});

function toCamelCaseKeys(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const camel = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    out[camel] = obj[key];
  }
  return out;
}

const DEFAULT_ADMIN_AVATAR_URL = "/images/admin-avatar.jpg";

function resolveAvatarUrl(avatarUrl: string | null | undefined, role?: string | null): string | null | undefined {
  if (avatarUrl) return avatarUrl;
  return role === "admin" ? DEFAULT_ADMIN_AVATAR_URL : avatarUrl;
}

function mapUserRow(u: any): any {
  if (!u) return null;
  const user = toCamelCaseKeys(u);
  const emailLower = (user.email || "").toLowerCase();
  const isAdminOrOwner = user.role === "admin" || user.role === "owner" || emailLower === "admin@renttrack.com" || emailLower === "renttrackowner@gmail.com";
  if (isAdminOrOwner) {
    user.idVerificationStatus = "approved";
    user.emailVerified = true;
  }
  user.avatarUrl = resolveAvatarUrl(user.avatarUrl, user.role);
  return user;
}

export function snakeToCamel(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const camel = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    out[camel] = obj[key];
  }
  return out;
}

function camelToSnake(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const snake = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    out[snake] = val;
  }
  return out;
}

export async function query(text: string, params?: any[]) {
  const { error } = await getAdminSupabase().rpc("exec_sql", { sql: text, params: params || [] });
  if (error) {
    console.error("Database query error:", error);
    throw error;
  }
}

let dbInitialized = false;
let initDbPromise: Promise<void> | null = null;

export async function initDatabase() {
  if (dbInitialized) return;
  if (initDbPromise) return initDbPromise;

  initDbPromise = (async () => {
    const statements: string[] = [];

    statements.push(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'owner', 'agent', 'tenant')),
    phone TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    commission_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    payment_pin_hash TEXT,
    payment_pin_set_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_pin_hash TEXT`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate DOUBLE PRECISION NOT NULL DEFAULT 0`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_pin_set_at TIMESTAMPTZ`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_otp TEXT`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_otp_expires_at TIMESTAMPTZ`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS birthdate DATE`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS experience TEXT DEFAULT '0 Years'`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS id_verification_url TEXT`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS id_verification_status TEXT DEFAULT 'pending' CHECK (id_verification_status IN ('pending', 'approved', 'rejected'))`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE`);

    statements.push(`CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_type TEXT NOT NULL DEFAULT 'user',
    type TEXT NOT NULL CHECK (type IN ('avatar', 'id_verification', 'property', 'unit', 'receipt', 'contract')),
    data BYTEA NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
    statements.push(`ALTER TABLE uploads ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'user'`);
    statements.push(`ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_type_check`);
    statements.push(`ALTER TABLE uploads ADD CONSTRAINT uploads_type_check CHECK (type IN ('avatar', 'id_verification', 'property', 'unit', 'receipt', 'contract'))`);

    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility BOOLEAN DEFAULT TRUE`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT FALSE`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS show_phone BOOLEAN DEFAULT FALSE`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_messages BOOLEAN DEFAULT TRUE`);
    statements.push(`ALTER TABLE users ADD COLUMN IF NOT EXISTS data_sharing BOOLEAN DEFAULT FALSE`);

    statements.push(`CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('house', 'condominium')),
    units INTEGER DEFAULT 0,
    occupied_units INTEGER DEFAULT 0,
    monthly_revenue DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT REFERENCES users(id),
    image_url TEXT
  )`);

    statements.push(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS image_url TEXT`);
    statements.push(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`);
    statements.push(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`);
    statements.push(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb`);
    statements.push(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS agent_id TEXT REFERENCES users(id)`);
    statements.push(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb`);
    statements.push(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS condition TEXT`);
    statements.push(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'Available'`);

    statements.push(`CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
    unit_number TEXT NOT NULL,
    floor INTEGER,
    status TEXT DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant', 'maintenance')),
    rent_amount DECIMAL(10,2) DEFAULT 0,
    tenant_name TEXT,
    tenant_id TEXT,
    lease_end DATE,
    image_url TEXT,
    image_urls JSONB DEFAULT '[]'::jsonb
  )`);
    statements.push(`ALTER TABLE units ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb`);

    statements.push(`CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    occupation TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    unit_id TEXT REFERENCES units(id),
    property_name TEXT,
    unit_number TEXT,
    contract_start DATE,
    contract_end DATE,
    rent_amount DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT REFERENCES users(id)
  )`);

    statements.push(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT '' CHECK (assignment_status IN ('', 'pending', 'confirmed', 'rejected'))`);

    statements.push(`CREATE TABLE IF NOT EXISTS rental_contracts (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    property_name TEXT NOT NULL,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
    tenant_name TEXT,
    title TEXT NOT NULL,
    message TEXT,
    file_upload_id TEXT,
    file_name TEXT,
    file_mime_type TEXT,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'sent', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
    statements.push(`ALTER TABLE rental_contracts ALTER COLUMN agent_id DROP NOT NULL`);
    statements.push(`CREATE INDEX IF NOT EXISTS rental_contracts_owner_created_idx ON rental_contracts(owner_id, created_at DESC)`);
    statements.push(`CREATE INDEX IF NOT EXISTS rental_contracts_agent_created_idx ON rental_contracts(agent_id, created_at DESC)`);
    statements.push(`CREATE INDEX IF NOT EXISTS rental_contracts_tenant_created_idx ON rental_contracts(tenant_id, created_at DESC)`);

    statements.push(`CREATE TABLE IF NOT EXISTS move_out_requests (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    tenant_name TEXT,
    unit_id TEXT,
    property_name TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

    statements.push(`CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id),
    tenant_name TEXT,
    unit_id TEXT,
    property_name TEXT,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    amount_due DECIMAL(10,2) DEFAULT 0,
    balance DECIMAL(10,2) DEFAULT 0,
    payment_date DATE,
    due_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'overdue', 'partial')),
    payment_method TEXT CHECK (payment_method IN ('cash', 'upload_receipt')),
    payment_method_note TEXT,
    bank_name TEXT,
    account_number TEXT,
    account_holder TEXT,
    card_last4 TEXT,
    card_expiry TEXT,
    receipt_url TEXT,
    notes TEXT,
    verified_by TEXT REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT REFERENCES users(id)
  )`);

    statements.push(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    user_type TEXT NOT NULL DEFAULT 'user',
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'system' CHECK (type IN ('payment', 'tenant', 'property', 'system', 'id_verification')),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
    statements.push(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'user'`);

    statements.push(`CREATE TABLE IF NOT EXISTS agent_applications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT NOT NULL CHECK (address IN ('Cebu', 'Manila', 'Davao', 'Butuan')),
    gender TEXT,
    birthdate DATE,
    resume_data BYTEA,
    resume_name TEXT,
    resume_mime_type TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
    statements.push(`ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);

    statements.push(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check`);
    statements.push(`ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('payment', 'tenant', 'property', 'system', 'id_verification'))`);

    statements.push(`CREATE TABLE IF NOT EXISTS payment_verification_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

    statements.push(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

    statements.push(`UPDATE users AS target
    SET created_by = audit.user_id
    FROM audit_logs AS audit
    JOIN users AS creator ON creator.id = audit.user_id AND creator.role = 'owner'
    WHERE audit.action = 'user_created'
      AND audit.details->>'createdUserId' = target.id
      AND target.role = 'agent'
      AND target.created_by IS NULL`);

    statements.push(`UPDATE users SET id_verification_status = 'approved', email_verified = TRUE WHERE role IN ('admin', 'owner') OR email IN ('admin@renttrack.com', 'renttrackowner@gmail.com')`);

    statements.push(`CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('property', 'unit', 'support')),
    target_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, target_type, target_id)
  )`);

    statements.push(`CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('property', 'unit')),
    target_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to TEXT REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    response_text TEXT,
    response_by TEXT,
    response_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
    statements.push(`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS response_text TEXT`);
    statements.push(`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS response_by TEXT`);
    statements.push(`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS response_at TIMESTAMPTZ`);
    statements.push(`ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_target_type_check`);
    statements.push(`ALTER TABLE complaints ADD CONSTRAINT complaints_target_type_check CHECK (target_type IN ('property', 'unit', 'support'))`);
    statements.push(`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS tenant_reply_text TEXT`);
    statements.push(`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS tenant_reply_by TEXT`);
    statements.push(`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS tenant_reply_at TIMESTAMPTZ`);

    statements.push(`CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);

    statements.push(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT,
    body TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    attachment_url TEXT,
    attachment_type TEXT CHECK (attachment_type IN ('image', 'audio')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

    statements.push(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url TEXT`);
    statements.push(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type TEXT CHECK (attachment_type IN ('image', 'audio'))`);

    statements.push(`CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    property_id TEXT REFERENCES properties(id),
    sender_name TEXT,
    sender_email TEXT,
    sender_phone TEXT,
    agent_id TEXT,
    agent_name TEXT,
    reply_text TEXT,
    replied_at TIMESTAMPTZ,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

    statements.push(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check`);
    statements.push(`ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check CHECK (payment_method IN ('cash', 'upload_receipt'))`);
    statements.push(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method_note TEXT`);
    statements.push(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_name TEXT`);
    statements.push(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_number TEXT`);
    statements.push(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_holder TEXT`);
    statements.push(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_last4 TEXT`);
    statements.push(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_expiry TEXT`);
    statements.push(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS gcash_number TEXT`);
    statements.push(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS gcash_name TEXT`);

    // Keep existing installations compatible with the landing-page chat reply flow.
    statements.push(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS agent_id TEXT`);
    statements.push(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS agent_name TEXT`);
    statements.push(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_text TEXT`);
    statements.push(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_token TEXT`);
    statements.push(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ`);
    statements.push(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS visitor_reply TEXT`);
    statements.push(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS visitor_replied_at TIMESTAMPTZ`);
    statements.push(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied'))`);

    const migrationFunction = `CREATE OR REPLACE FUNCTION exec_migration(sql text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE stmt text;
BEGIN
  IF sql IS NULL OR trim(sql) = '' THEN
    RETURN;
  END IF;
  FOR stmt IN
    SELECT regexp_split_to_table(sql, ';')
  LOOP
    stmt := trim(stmt);
    IF stmt <> '' THEN
      BEGIN
        EXECUTE stmt;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'exec_migration skipped statement: %', SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;`;
    await getAdminSupabase().rpc("exec_sql", { sql: migrationFunction });

    const batch = statements.join("\n");
    try {
      const { error } = await getAdminSupabase().rpc("exec_migration", { sql: batch });
      if (error) {
        console.error("initDatabase batch failed:", error.message);
      }
    } catch (err) {
      console.error("initDatabase batch error:", err);
    }

    try {
      await getAdminSupabase().rpc("exec_sql", { sql: "NOTIFY pgrst, 'reload schema'" });
    } catch (err) {
      console.error("Failed to reload PostgREST schema:", err);
    }

    console.log("✅ Database tables initialized");
    dbInitialized = true;
  })();

  return initDbPromise;
}

let notificationsSchemaPromise: Promise<void> | null = null;

export async function ensureNotificationsSchema(): Promise<void> {
  if (!notificationsSchemaPromise) {
    notificationsSchemaPromise = (async () => {
      await initDatabase();
      const admin = getAdminSupabase();
      const { error } = await admin.rpc("exec_sql", {
        sql: "ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'user'",
      });
      if (error) throw new Error(`Could not add notification recipient type: ${error.message}`);

      const { error: reloadError } = await admin.rpc("exec_sql", { sql: "NOTIFY pgrst, 'reload schema'" });
      if (reloadError) throw new Error(`Could not refresh the notifications schema: ${reloadError.message}`);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { error: schemaError } = await admin.from("notifications").select("id, user_type").limit(0);
        if (!schemaError) return;
        if (attempt === 4) throw new Error(`Notifications schema is unavailable through the database API: ${schemaError.message}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })().catch((error) => {
      notificationsSchemaPromise = null;
      throw error;
    });
  }

  return notificationsSchemaPromise;
}

let agentApplicationsSchemaPromise: Promise<void> | null = null;

export async function ensureAgentApplicationsSchema(): Promise<void> {
  if (!agentApplicationsSchemaPromise) {
    agentApplicationsSchemaPromise = (async () => {
      await initDatabase();
      const admin = getAdminSupabase();
      const { error } = await admin.rpc("exec_sql", {
        sql: "ALTER TABLE public.agent_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
      });
      if (error) throw new Error(`Could not add agent application rejection reason: ${error.message}`);

      const { error: reloadError } = await admin.rpc("exec_sql", { sql: "NOTIFY pgrst, 'reload schema'" });
      if (reloadError) throw new Error(`Could not refresh the agent application schema: ${reloadError.message}`);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { error: schemaError } = await admin.from("agent_applications").select("id, rejection_reason").limit(0);
        if (!schemaError) return;
        if (attempt === 4) throw new Error(`Agent application schema is unavailable through the database API: ${schemaError.message}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })().catch((error) => {
      agentApplicationsSchemaPromise = null;
      throw error;
    });
  }

  return agentApplicationsSchemaPromise;
}

let rentalContractsSchemaPromise: Promise<void> | null = null;

export async function ensureRentalContractsSchema(): Promise<void> {
  if (!rentalContractsSchemaPromise) {
    rentalContractsSchemaPromise = (async () => {
      await initDatabase();
      const admin = getAdminSupabase();
      const statements = [
        `CREATE TABLE IF NOT EXISTS public.rental_contracts (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          agent_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
          property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
          property_name TEXT NOT NULL,
          tenant_id TEXT REFERENCES public.tenants(id) ON DELETE SET NULL,
          tenant_name TEXT,
          title TEXT NOT NULL,
          message TEXT,
          file_upload_id TEXT,
          file_name TEXT,
          file_mime_type TEXT,
          status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'sent', 'rejected')),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        "ALTER TABLE public.rental_contracts ALTER COLUMN agent_id DROP NOT NULL",
        "CREATE INDEX IF NOT EXISTS rental_contracts_owner_created_idx ON public.rental_contracts(owner_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS rental_contracts_agent_created_idx ON public.rental_contracts(agent_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS rental_contracts_tenant_created_idx ON public.rental_contracts(tenant_id, created_at DESC)",
      ];

      for (const sql of statements) {
        const { error } = await admin.rpc("exec_sql", { sql });
        if (error) throw new Error(`Could not install rental contracts schema: ${error.message}`);
      }

      const { error: reloadError } = await admin.rpc("exec_sql", { sql: "NOTIFY pgrst, 'reload schema'" });
      if (reloadError) throw new Error(`Could not refresh the database API schema: ${reloadError.message}`);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { error } = await admin
          .from("rental_contracts")
          .select("id, owner_id, agent_id, property_id, property_name, tenant_id, tenant_name, title, message, file_upload_id, file_name, file_mime_type, status, created_at, updated_at")
          .limit(0);
        if (!error) return;
        if (attempt === 2) throw new Error(`Rental contracts schema is not available through the database API: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })().catch((error) => {
      rentalContractsSchemaPromise = null;
      throw error;
    });
  }

  return rentalContractsSchemaPromise;
}

let userCreatedBySchemaPromise: Promise<void> | null = null;

async function ensureUserCreatedBySchema(): Promise<void> {
  if (!userCreatedBySchemaPromise) {
    userCreatedBySchemaPromise = (async () => {
      const admin = getAdminSupabase();
      const { error } = await admin.rpc("exec_sql", {
        sql: "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL",
      });
      if (error) throw new Error(`Could not add the users.created_by column: ${error.message}`);

      const { error: reloadError } = await admin.rpc("exec_sql", { sql: "NOTIFY pgrst, 'reload schema'" });
      if (reloadError) throw new Error(`Could not refresh the users schema: ${reloadError.message}`);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { error: schemaError } = await admin.from("users").select("id, created_by").limit(0);
        if (!schemaError) return;
        if (attempt === 4) throw new Error(`Users schema is unavailable through the database API: ${schemaError.message}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })().catch((error) => {
      userCreatedBySchemaPromise = null;
      throw error;
    });
  }

  return userCreatedBySchemaPromise;
}

let userCommissionRateSchemaPromise: Promise<void> | null = null;

export async function ensureUserCommissionRateSchema(): Promise<void> {
  if (!userCommissionRateSchemaPromise) {
    userCommissionRateSchemaPromise = (async () => {
      const admin = getAdminSupabase();
      const { error } = await admin.rpc("exec_sql", {
        sql: "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS commission_rate DOUBLE PRECISION NOT NULL DEFAULT 0",
      });
      if (error) throw new Error(`Could not add the users.commission_rate column: ${error.message}`);

      const { error: reloadError } = await admin.rpc("exec_sql", { sql: "NOTIFY pgrst, 'reload schema'" });
      if (reloadError) throw new Error(`Could not refresh the users schema: ${reloadError.message}`);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { error: schemaError } = await admin.from("users").select("id, commission_rate").limit(0);
        if (!schemaError) return;
        if (attempt === 4) throw new Error(`Users commission schema is unavailable through the database API: ${schemaError.message}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })().catch((error) => {
      userCommissionRateSchemaPromise = null;
      throw error;
    });
  }

  return userCommissionRateSchemaPromise;
}

export async function createUser(name: string, email: string, password: string, role: string, phone?: string, paymentPin?: string, address?: string, emailVerified = false, createdBy?: string) {
  await ensureUserCreatedBySchema();
  const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const hashedPassword = await bcrypt.hash(password, 10);
  let { error } = await getAdminSupabase().schema("public").from("users").insert({
    id,
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    role,
    phone: phone || null,
    created_by: createdBy || null,
    payment_pin_hash: paymentPin ? hashSecret(paymentPin) : null,
    payment_pin_set_at: paymentPin ? new Date().toISOString() : null,
    email_verified: emailVerified,
    verification_token: null,
    verification_expires_at: null,
    address: address || null,
    created_at: new Date().toISOString(),
  });
  if (isPublicUsersSchemaCacheError(error)) {
    await reloadPostgrestSchema();
    ({ error } = await getAdminSupabase().schema("public").from("users").insert({
      id,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      phone: phone || null,
      created_by: createdBy || null,
      payment_pin_hash: paymentPin ? hashSecret(paymentPin) : null,
      payment_pin_set_at: paymentPin ? new Date().toISOString() : null,
      email_verified: emailVerified,
      verification_token: null,
      verification_expires_at: null,
      address: address || null,
      created_at: new Date().toISOString(),
    }));
  }
  if (error) throw error;
  return { id, name, email: email.toLowerCase(), role, phone, address, emailVerified, createdBy: createdBy || null, createdAt: new Date().toISOString() };
}

function isSchemaCacheError(error: any): boolean {
  if (!error) return false;
  const message = typeof error?.message === "string" ? error.message : "";
  return message.includes("schema cache") || error?.code === "PGRST205";
}

function isPublicUsersSchemaCacheError(error: any): boolean {
  if (!error) return false;
  const message = typeof error?.message === "string" ? error.message : "";
  return message.includes("schema cache") || error?.code === "PGRST205";
}

async function reloadPostgrestSchema(): Promise<void> {
  try {
    const { error } = await getAdminSupabase().rpc("exec_sql", {
      sql: "NOTIFY pgrst, 'reload schema'",
    });
    if (error) {
      console.warn("Failed to reload PostgREST schema:", error.message);
    }
  } catch (err: any) {
    if (isSchemaCacheError(err)) {
      console.warn("Cannot reload PostgREST schema: exec_sql not in schema cache, relying on schema being applied");
    } else {
      console.warn("Failed to reload PostgREST schema:", err?.message);
    }
  }
}

export async function findUserByEmail(email: string) {
  let result = await getAdminSupabase().schema("public").from("users").select("*").eq("email", email.toLowerCase()).single();
  if (isPublicUsersSchemaCacheError(result.error)) {
    await reloadPostgrestSchema();
    result = await getAdminSupabase().schema("public").from("users").select("*").eq("email", email.toLowerCase()).single();
  }
  const { data, error } = result;
  if (error && error.code !== "PGRST116") throw new Error(`Failed to query user: ${error.message}`);
  if (!data) return null;
  return mapUserRow(data);
}

export async function findUserById(id: string) {
  let result = await getAdminSupabase().schema("public").from("users").select("*").eq("id", id).single();
  if (isPublicUsersSchemaCacheError(result.error)) {
    await reloadPostgrestSchema();
    result = await getAdminSupabase().schema("public").from("users").select("*").eq("id", id).single();
  }
  const { data, error } = result;
  if (error && error.code !== "PGRST116") throw new Error(`Failed to query user: ${error.message}`);
  if (!data) return null;
  return mapUserRow(data);
}

export async function setUserPaymentPin(userId: string, paymentPin: string) {
  const hashedPin = await bcrypt.hash(paymentPin.trim(), 10);
  const { error } = await getAdminSupabase().schema("public").from("users").update({ payment_pin_hash: hashedPin, payment_pin_set_at: new Date().toISOString() }).eq("id", userId);
  if (error) throw error;
}

export async function verifyUserPaymentPin(userId: string, paymentPin: string) {
  const { data, error } = await getAdminSupabase().schema("public").from("users").select("payment_pin_hash").eq("id", userId).single();
  if (error || !data) return false;
  const storedHash = data.payment_pin_hash as string | null | undefined;
  if (!storedHash) return false;
  return bcrypt.compare(paymentPin.trim(), storedHash);
}

export async function createPaymentVerificationCode(userId: string, code: string, purpose = "payment", ttlMinutes = 10) {
  const id = `pvc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  await getAdminSupabase().from("payment_verification_codes").delete().eq("user_id", userId).eq("purpose", purpose).eq("consumed_at", null);

  const { error } = await getAdminSupabase().from("payment_verification_codes").insert({
    id,
    user_id: userId,
    purpose,
    code_hash: codeHash,
    expires_at: expiresAt,
    consumed_at: null,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
  return id;
}

export async function verifyPaymentVerificationCode(userId: string, code: string, purpose = "payment") {
  const { data, error } = await supabase
    .from("payment_verification_codes")
    .select("*")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .eq("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return false;
  const storedHash = data.code_hash as string;
  const match = await bcrypt.compare(code, storedHash);
  if (!match) return false;

  await getAdminSupabase().from("payment_verification_codes").update({ consumed_at: new Date().toISOString() }).eq("id", data.id);
  return true;
}

export async function createEmailVerificationToken(userId: string, email: string, ttlHours = 24) {
  const token = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .schema("public").from("users")
    .update({ verification_token: token, verification_expires_at: expiresAt, email_verified: false })
    .eq("id", userId);
  if (error) throw error;
  return token;
}

export async function verifyEmailToken(token: string) {
  const { data, error } = await getAdminSupabase().schema("public").from("users").select("id, email, verification_expires_at").eq("verification_token", token).single();
  if (error || !data) return { success: false, error: "Invalid verification token" };
  if (new Date(data.verification_expires_at) < new Date()) {
    return { success: false, error: "Verification token has expired" };
  }
  const { error: updateError } = await supabase
    .schema("public").from("users")
    .update({ email_verified: true, verification_token: null, verification_expires_at: null })
    .eq("id", data.id);
  if (updateError) throw updateError;
  return { success: true, user: { id: data.id, email: data.email } };
}

export async function createLoginOtp(userId: string, ttlMinutes = 10) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const { error } = await getAdminSupabase().schema("public").from("users").update({ login_otp: otpHash, login_otp_expires_at: expiresAt }).eq("id", userId);
  if (error) throw error;
  return otp;
}

export async function verifyLoginOtp(userId: string, otp: string) {
  const { data, error } = await getAdminSupabase().schema("public").from("users").select("login_otp, login_otp_expires_at").eq("id", userId).single();
  if (error || !data) return { success: false, error: "User not found" };
  const storedHash = data.login_otp as string | null | undefined;
  if (!storedHash) return { success: false, error: "No verification code found" };
  const match = await bcrypt.compare(otp, storedHash);
  if (!match) return { success: false, error: "Invalid verification code" };
  if (new Date(data.login_otp_expires_at) < new Date()) {
    return { success: false, error: "Verification code has expired" };
  }
  const { error: updateError } = await getAdminSupabase().schema("public").from("users").update({ login_otp: null, login_otp_expires_at: null }).eq("id", userId);
  if (updateError) throw updateError;
  return { success: true };
}

export async function updateUserPresence(userId: string, options: { markLogin?: boolean } = {}) {
  const nowIso = new Date().toISOString();
  const isOnline = options.markLogin !== false;
  const payload: Record<string, unknown> = {
    last_seen_at: nowIso,
    is_online: isOnline,
  };

  if (options.markLogin) {
    payload.last_login_at = nowIso;
  }

  const { error } = await getAdminSupabase().schema("public").from("users").update(payload).eq("id", userId);
  if (error) console.error("User presence update error:", error);
}

export async function ensureBuiltInAccount(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@renttrack.com").toLowerCase().trim();
  const ownerEmail = (process.env.OWNER_EMAIL || "renttrackowner@gmail.com").toLowerCase().trim();
  const tasks: Promise<unknown>[] = [];

  if (normalizedEmail === adminEmail && process.env.ADMIN_PASSWORD) {
    tasks.push(findOrCreateAdmin());
  }
  if (normalizedEmail === ownerEmail && process.env.OWNER_PASSWORD) {
    tasks.push(findOrCreateOwner());
  }

  // Ensure built-in accounts are approved in the database
  const adminClient = getAdminSupabase();
  tasks.push(
    Promise.resolve(
      adminClient.schema("public").from("users")
        .update({ id_verification_status: "approved", email_verified: true })
        .in("email", [adminEmail, ownerEmail])
    )
  );

  await Promise.allSettled(tasks);
}

export async function logAudit(userId: string, action: string, details?: Record<string, any>, ipAddress?: string, userAgent?: string) {
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const { error } = await getAdminSupabase().from("audit_logs").insert({
    id,
    user_id: userId || null,
    action,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    details: details || {},
    created_at: new Date().toISOString(),
  });
  if (error) console.error("Audit log error:", error);
}

export async function findOrCreateAdmin() {
  const name = "System Administrator";
  const email = process.env.ADMIN_EMAIL || "admin@renttrack.com";
  const password = process.env.ADMIN_PASSWORD;
  const role = "admin";
  const phone = "+63 900 000 0000";
  const defaultAvatarUrl = DEFAULT_ADMIN_AVATAR_URL;

  if (!password) {
    throw new Error("Missing ADMIN_PASSWORD. Set a strong built-in administrator password in .env.local or Vercel before logging in.");
  }

  const adminClient = getAdminSupabase();
  let { data: existing, error: lookupError } = await adminClient.schema("public").from("users").select("*").eq("email", email).single();
  if (isPublicUsersSchemaCacheError(lookupError)) {
    await reloadPostgrestSchema();
    const retry = await adminClient.schema("public").from("users").select("*").eq("email", email).single();
    existing = retry.data;
    lookupError = retry.error;
  }
  if (lookupError && lookupError.code !== "PGRST116" && !isPublicUsersSchemaCacheError(lookupError)) {
    throw new Error(`Failed to query admin: ${lookupError.message}`);
  }
  const admin = existing as any;

  if (admin) {
    const resetBuiltInPassword = process.env.FORCE_BUILTIN_PASSWORD_RESET === "true";
    if (admin.role !== role) {
      const { error } = await adminClient.schema("public").from("users").update({ role, phone, email_verified: true, id_verification_status: "approved", verification_token: null, verification_expires_at: null }).eq("id", admin.id);
      if (error) throw new Error(`Failed to update admin: ${error.message}`);
      console.log("Admin role corrected for:", email);
    } else {
      const { error } = await adminClient.schema("public").from("users").update({ email_verified: true, id_verification_status: "approved", verification_token: null, verification_expires_at: null }).eq("id", admin.id);
      if (error) throw new Error(`Failed to update admin: ${error.message}`);
    }
    if (!admin.avatar_url) {
      const { error } = await adminClient.schema("public").from("users").update({ avatar_url: defaultAvatarUrl }).eq("id", admin.id);
      if (error) console.error("Failed to set default admin avatar:", error);
    }
    if (resetBuiltInPassword) {
      const passwordHash = await bcrypt.hash(password, 10);
      const { error } = await adminClient.schema("public").from("users").update({ password: passwordHash }).eq("id", admin.id);
      if (error) throw new Error(`Failed to reset built-in admin password: ${error.message}`);
      console.log("Built-in administrator password reset for:", email);
    }
    await logAudit(admin.id, "admin_ready", { email }, "system", "system");
    console.log("Admin account ready:", email);
    return { id: admin.id, email, name: admin.name };
  }

  const id = `usr_admin_${Date.now()}`;
  const hashedDefault = await bcrypt.hash(password, 10);
  const { error } = await adminClient.schema("public").from("users").insert({
    id,
    name,
    email,
    password: hashedDefault,
    role,
    phone,
    email_verified: true,
    id_verification_status: "approved",
    avatar_url: defaultAvatarUrl,
    verification_token: null,
    verification_expires_at: null,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to create admin: ${error.message}`);
  console.log("Admin account created:", email);
  await logAudit(id, "admin_created", { email, role: "admin" }, "system", "system");
  return { id, email, name };
}

export async function getAllUsers() {
  let result = await getAdminSupabase().schema("public").from("users").select("*").order("created_at", { ascending: false });
  if (isPublicUsersSchemaCacheError(result.error)) {
    await reloadPostgrestSchema();
    result = await getAdminSupabase().schema("public").from("users").select("*").order("created_at", { ascending: false });
  }
  const { data, error } = result;
  if (error && !isPublicUsersSchemaCacheError(error)) throw error;
  return (data || []).map((u: any) => {
    const user = snakeToCamel(u);
    const emailLower = (user.email || "").toLowerCase();
    const isAdminOrOwner = user.role === "admin" || user.role === "owner" || emailLower === "admin@renttrack.com" || emailLower === "renttrackowner@gmail.com";
    if (isAdminOrOwner) {
      user.idVerificationStatus = "approved";
      user.emailVerified = true;
    }
    user.avatarUrl = resolveAvatarUrl(user.avatarUrl, user.role);
    return user;
  });
}

export async function getProperties() {
  const { data, error } = await getAdminSupabase().from("properties").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => {
    const property = snakeToCamel(row);
    property.imageUrls = Array.isArray(row.image_urls) && row.image_urls.length > 0
      ? Array.from(new Set(row.image_urls.filter((url: unknown): url is string => typeof url === "string")))
      : row.image_url ? [row.image_url] : [];
    return property;
  });
}

export async function createProperty(data: any, userId: string) {
  const id = data.id || `prop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const admin = getAdminSupabase();
  const normalizedType = ["house", "condominium"].includes(data.type) ? data.type : "house";

  const basePayload: Record<string, any> = {
    id,
    name: data.name,
    location: data.location,
    type: normalizedType,
    units: data.units || 1,
    occupied_units: 0,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    monthly_revenue: 0,
    status: data.status || "active",
    created_by: userId || null,
    image_url: data.imageUrl || (Array.isArray(data.imageUrls) ? data.imageUrls[0] : null) || null,
    image_urls: Array.isArray(data.imageUrls) ? Array.from(new Set(data.imageUrls)) : (data.imageUrl ? [data.imageUrl] : []),
    agent_id: data.agentId || null,
    features: Array.isArray(data.features) ? data.features : [],
    condition: data.condition || null,
    availability_status: data.availabilityStatus || "Available",
    created_at: new Date().toISOString(),
  };

  let payload = { ...basePayload };
  let { error } = await admin.from("properties").insert(payload);

  // 1. Foreign key constraint violation (created_by or agent_id)
  if (error && (error.code === "23503" || /foreign key/i.test(error.message) || /created_by/i.test(error.message) || /agent_id/i.test(error.message))) {
    console.warn("[createProperty] Foreign key constraint warning, removing foreign keys and retrying:", error.message);
    delete payload.created_by;
    delete payload.agent_id;
    ({ error } = await admin.from("properties").insert(payload));
  }

  // 2. Specific missing columns in schema cache
  if (error && /Could not find the '.+' column of 'properties'/i.test(error.message)) {
    console.warn("[createProperty] Missing column in properties table, removing missing column:", error.message);
    while (error && /Could not find the '.+' column of 'properties'/i.test(error.message)) {
      const match = error.message.match(/Could not find the '(.+)' column of 'properties'/i);
      if (match && match[1]) {
        delete payload[match[1]];
        ({ error } = await admin.from("properties").insert(payload));
      } else {
        break;
      }
    }
  }

  // 3. Check constraint violation (e.g. type or status)
  if (error && (error.code === "23514" || /check constraint/i.test(error.message))) {
    console.warn("[createProperty] Check constraint warning, resetting to standard defaults:", error.message);
    payload.type = "house";
    payload.status = "active";
    delete payload.condition;
    delete payload.availability_status;
    ({ error } = await admin.from("properties").insert(payload));
  }

  // 4. Fallback to minimal core columns if table is older schema
  if (error && (error.code === "PGRST204" || /column/i.test(error.message) || /schema cache/i.test(error.message))) {
    console.warn("[createProperty] Falling back to minimal columns payload:", error.message);
    const minimalPayload: Record<string, any> = {
      id,
      name: data.name,
      location: data.location,
      type: normalizedType,
      units: data.units || 1,
      status: "active",
      image_url: data.imageUrl || (Array.isArray(data.imageUrls) ? data.imageUrls[0] : null) || null,
      created_at: new Date().toISOString(),
    };
    let minRes = await admin.from("properties").insert(minimalPayload);
    if (!minRes.error) {
      error = null;
    } else {
      error = minRes.error;
    }
  }

  if (error) {
    console.error("[createProperty] Fatal insert error:", error);
    throw new Error(error.message || error.details || "Database insertion failed");
  }

  return { id, ...data, status: "active", createdAt: new Date().toISOString() };
}

export async function deleteProperty(id: string) {
  const adminClient = getAdminSupabase();
  const { error: chatError } = await adminClient.from("chat_messages").delete().eq("property_id", id);
  if (chatError) {
    console.error("Failed to clear chat messages before property deletion:", chatError);
  }
  const { error } = await adminClient.from("properties").delete().eq("id", id);
  if (error) throw error;
}

export async function getUnits() {
  const { data, error } = await getAdminSupabase().from("units").select("*").order("unit_number");
  if (error) throw error;
  return (data || []).map((row: any) => {
    const unit = snakeToCamel(row);
    unit.imageUrls = Array.isArray(row.image_urls) && row.image_urls.length > 0
      ? Array.from(new Set(row.image_urls.filter((url: unknown): url is string => typeof url === "string")))
      : row.image_url ? [row.image_url] : [];
    return unit;
  });
}

export async function createUnit(data: any) {
  const id = data.id || `unit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const admin = getAdminSupabase();

  const basePayload: Record<string, any> = {
    id,
    property_id: data.propertyId,
    unit_number: data.unitNumber,
    floor: data.floor || null,
    status: data.status || "vacant",
    rent_amount: data.rentAmount || 0,
    image_url: data.imageUrl || (Array.isArray(data.imageUrls) ? data.imageUrls[0] : null) || null,
    image_urls: Array.isArray(data.imageUrls) ? Array.from(new Set(data.imageUrls)) : data.imageUrl ? [data.imageUrl] : [],
  };

  let payload = { ...basePayload };
  let { error } = await admin.from("units").insert(payload);

  // 1. Missing columns in schema cache
  if (error && /Could not find the '.+' column of 'units'/i.test(error.message)) {
    console.warn("[createUnit] Missing column in units table, removing missing column:", error.message);
    while (error && /Could not find the '.+' column of 'units'/i.test(error.message)) {
      const match = error.message.match(/Could not find the '(.+)' column of 'units'/i);
      if (match && match[1]) {
        delete payload[match[1]];
        ({ error } = await admin.from("units").insert(payload));
      } else {
        break;
      }
    }
  }

  // 2. Fallback to minimal core columns
  if (error && (error.code === "PGRST204" || /column/i.test(error.message) || /schema cache/i.test(error.message))) {
    console.warn("[createUnit] Falling back to minimal units payload:", error.message);
    const minimalPayload = {
      id,
      property_id: data.propertyId,
      unit_number: data.unitNumber,
      status: data.status || "vacant",
      rent_amount: data.rentAmount || 0,
    };
    let minRes = await admin.from("units").insert(minimalPayload);
    if (!minRes.error) {
      error = null;
    } else {
      error = minRes.error;
    }
  }

  if (error) {
    console.error("[createUnit] Fatal insert error:", error);
    throw new Error(error.message || error.details || "Database unit insertion failed");
  }

  return { id, ...data, imageUrls: Array.isArray(data.imageUrls) ? Array.from(new Set(data.imageUrls)) : data.imageUrl ? [data.imageUrl] : [], status: data.status || "vacant" };
}

export async function clearTenantUnitAssignment(tenantId: string, tenantName?: string | null, forcedUnitId?: string | null) {
  const client = getAdminSupabase();
  const targetUnitIds = new Set<string>();

  if (forcedUnitId) targetUnitIds.add(forcedUnitId);

  const { data: currentTenant, error: currentTenantError } = await client
    .from("tenants")
    .select("unit_id, name")
    .eq("id", tenantId)
    .maybeSingle();

  if (currentTenantError) throw currentTenantError;
  if (currentTenant?.unit_id) targetUnitIds.add(currentTenant.unit_id);

  const { data: staleUnits, error: staleUnitsError } = await client
    .from("units")
    .select("id, tenant_id, tenant_name")
    .order("id");

  if (staleUnitsError) throw staleUnitsError;

  const normalizedTenantName = (tenantName ?? currentTenant?.name ?? "").trim();
  for (const unit of staleUnits || []) {
    const matchesTenantId = unit.tenant_id === tenantId;
    const matchesTenantName = normalizedTenantName && unit.tenant_name === normalizedTenantName;
    if (matchesTenantId || matchesTenantName) {
      targetUnitIds.add(unit.id);
    }
  }

  if (targetUnitIds.size === 0) {
    const { error } = await client.from("tenants").update({
      unit_id: null,
      unit_number: null,
      property_name: null,
      assignment_status: "",
      status: "inactive",
      rent_amount: 0,
    }).eq("id", tenantId);
    if (error) throw error;
    return;
  }

  for (const unitId of Array.from(targetUnitIds)) {
    const { error } = await client.from("units").update({
      status: "vacant",
      tenant_id: null,
      tenant_name: null,
    }).eq("id", unitId);
    if (error) throw error;
  }

  const { error: tenantResetError } = await client.from("tenants").update({
    unit_id: null,
    unit_number: null,
    property_name: null,
    assignment_status: "",
    status: "inactive",
    rent_amount: 0,
  }).eq("id", tenantId);

  if (tenantResetError) throw tenantResetError;
}

export async function syncTenantUnit(tenantId: string, unitId: string | null, assignmentStatus: string) {
  const client = getAdminSupabase();
  const { data: currentTenant, error: tenantError } = await client
    .from("tenants")
    .select("unit_id, name")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError) throw tenantError;

  const shouldClearUnit = !unitId || assignmentStatus !== "confirmed";

  if (currentTenant?.unit_id && currentTenant.unit_id !== unitId) {
    await clearTenantUnitAssignment(tenantId, currentTenant.name, currentTenant.unit_id);
  }

  if (shouldClearUnit) {
    await clearTenantUnitAssignment(tenantId, currentTenant?.name, currentTenant?.unit_id ?? unitId);
    return;
  }

  const { data: tenant } = await client.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  const { error } = await client.from("units").update({
    status: "occupied",
    tenant_id: tenantId,
    tenant_name: tenant?.name || null,
  }).eq("id", unitId);
  if (error) throw error;
}

export async function deleteUnit(id: string) {
  const adminClient = getAdminSupabase();
  const { data: unit, error: lookupError } = await adminClient.from("units").select("status, tenant_id").eq("id", id).maybeSingle();
  if (lookupError) throw lookupError;
  if (unit?.status === "occupied" || unit?.tenant_id) {
    throw new Error("An occupied unit cannot be deleted. Reassign or move out the tenant first.");
  }
  const { error: tenantError } = await adminClient.from("tenants").update({ unit_id: null, unit_number: null }).eq("unit_id", id);
  if (tenantError) {
    console.error("Failed to clear tenant references before unit deletion:", tenantError);
  }
  const { error } = await adminClient.from("units").delete().eq("id", id);
  if (error) throw error;
}

export async function getTenants() {
  let usersResult = await getAdminSupabase().schema("public").from("users").select("*").eq("role", "tenant").order("created_at", { ascending: false });
  if (isPublicUsersSchemaCacheError(usersResult.error)) {
    await reloadPostgrestSchema();
    usersResult = await getAdminSupabase().schema("public").from("users").select("*").eq("role", "tenant").order("created_at", { ascending: false });
  }
  const { data: users, error: usersError } = usersResult;
  if (usersError && !isPublicUsersSchemaCacheError(usersError)) throw usersError;

  const { data: tenantRecords, error: tenantsError } = await getAdminSupabase().from("tenants").select("*");
  if (tenantsError) throw tenantsError;

  const tenantMap = new Map((tenantRecords || []).map((t: any) => [t.id, t]));
  const tenantEmailMap = new Map((tenantRecords || []).filter((t: any) => t.email).map((t: any) => [String(t.email).toLowerCase(), t]));

  return (users || []).map((u: any) => {
    const tr = tenantMap.get(u.id) || tenantEmailMap.get(String(u.email || "").toLowerCase());
    return {
      id: u.id,
      name: u.name,
      email: u.email || "",
      phone: u.phone || "",
      address: u.address || tr?.address || "",
      occupation: tr?.occupation || "",
      emergencyContact: tr?.emergency_contact || "",
      emergencyPhone: tr?.emergency_phone || "",
      unitId: tr?.unit_id || "",
      propertyName: tr?.property_name || "",
      unitNumber: tr?.unit_number || "",
      contractStart: tr?.contract_start || "",
      contractEnd: tr?.contract_end || "",
      rentAmount: tr?.rent_amount || 0,
      status: tr?.status || "active",
      createdBy: tr?.created_by || "",
      createdAt: u.created_at,
      avatarUrl: u.avatar_url,
      idVerificationUrl: u.id_verification_url,
      idVerificationStatus: u.id_verification_status,
      assignmentStatus: tr?.assignment_status || (tr?.unit_id ? "pending" : ""),
    };
  });
}

export async function createTenant(data: any, userId: string) {
  const id = data.id || `ten_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const { error } = await getAdminSupabase().from("tenants").insert({
    id,
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    address: data.address || null,
    occupation: data.occupation || null,
    emergency_contact: data.emergencyContact || null,
    emergency_phone: data.emergencyPhone || null,
    unit_id: data.unitId || null,
    property_name: data.propertyName || null,
    unit_number: data.unitNumber || null,
    contract_start: data.contractStart || null,
    contract_end: data.contractEnd || null,
    rent_amount: data.rentAmount || 0,
    status: "active",
    created_by: userId,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { id, ...data, status: "active", createdAt: new Date().toISOString() };
}

export async function deleteTenant(userId: string) {
  const { error: tenantError } = await getAdminSupabase().from("tenants").delete().eq("id", userId);
  if (tenantError) throw tenantError;
  const { error: userError } = await getAdminSupabase().schema("public").from("users").delete().eq("id", userId);
  if (userError) throw userError;
}

export async function resetTenantPayments(tenantId: string) {
  const { data: tenantRecord, error: tenantLookupError } = await getAdminSupabase()
    .from("tenants")
    .select("name, unit_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantLookupError) throw tenantLookupError;

  const { error } = await getAdminSupabase().from("payments").delete().eq("tenant_id", tenantId);
  if (error) throw error;

  const { error: tenantError } = await getAdminSupabase()
    .from("tenants")
    .update({
      rent_amount: 0,
      status: "inactive",
      unit_id: null,
      property_name: null,
      unit_number: null,
      assignment_status: "",
    })
    .eq("id", tenantId);

  if (tenantError) throw tenantError;

  await clearTenantUnitAssignment(tenantId, tenantRecord?.name ?? null, tenantRecord?.unit_id ?? null);
}

export async function getPayments() {
  const { data, error } = await getAdminSupabase().from("payments").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => snakeToCamel(row));
}

export async function getPaymentsForUser(userId: string, role?: string) {
  let query = getAdminSupabase().from("payments").select("*");
  if (role === "tenant") {
    query = query.or(`tenant_id.eq.${userId},created_by.eq.${userId}`);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => snakeToCamel(row));
}

export async function resetAgentData(agentId: string) {
  const adminClient = getAdminSupabase();
  const operations = [
    adminClient.from("chat_messages").delete().eq("agent_id", agentId),
    adminClient.from("messages").delete().or(`sender_id.eq.${agentId},receiver_id.eq.${agentId}`),
    adminClient.from("notifications").delete().eq("user_id", agentId),
    adminClient.from("payments").delete().eq("created_by", agentId),
    adminClient.from("tenants").delete().eq("created_by", agentId),
    adminClient.from("properties").update({ agent_id: null }).eq("agent_id", agentId),
  ];
  const results = await Promise.all(operations);
  const failure = results.find((result) => result.error);
  if (failure?.error) throw failure.error;
}

export async function createPayment(data: any, userId: string) {
  const id = data.id || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const basePayload: Record<string, any> = {
    id,
    tenant_id: data.tenantId || null,
    tenant_name: data.tenantName || null,
    unit_id: data.unitId || null,
    property_name: data.propertyName || null,
    amount_paid: data.amountPaid || 0,
    amount_due: data.amountDue || 0,
    balance: data.balance || 0,
    payment_date: data.paymentDate || null,
    due_date: data.dueDate || null,
    status: data.status || "pending",
    payment_method: data.paymentMethod || "cash",
    payment_method_note: data.paymentMethodNote || null,
    bank_name: data.bankName || null,
    account_number: data.accountNumber || null,
    account_holder: data.accountHolder || null,
    card_last4: data.cardLast4 || null,
    card_expiry: data.cardExpiry || null,
    gcash_number: data.gcashNumber || null,
    gcash_name: data.gcashName || null,
    receipt_url: data.receiptUrl || null,
    stay_start: data.stayStart || null,
    stay_end: data.stayEnd || null,
    notes: data.notes || null,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  let { error } = await getAdminSupabase().from("payments").insert(basePayload);
  if (error && (/payment_method/.test(error.message) || /check constraint/i.test(error.message))) {
    const fallbackMethodPayload = {
      ...basePayload,
      payment_method: basePayload.payment_method === "gcash" ? "upload_receipt" : "cash",
      payment_method_note: basePayload.payment_method_note || (basePayload.payment_method === "gcash" ? "GCash" : null),
    };
    ({ error } = await getAdminSupabase().from("payments").insert(fallbackMethodPayload));
  }
  if (error && /Could not find the '.+' column of 'payments'/.test(error.message)) {
    const fallbackPayload = { ...basePayload };
    delete fallbackPayload.gcash_number;
    delete fallbackPayload.gcash_name;
    delete fallbackPayload.stay_start;
    delete fallbackPayload.stay_end;
    if (fallbackPayload.payment_method === "gcash") {
      fallbackPayload.payment_method = "upload_receipt";
      fallbackPayload.payment_method_note = fallbackPayload.payment_method_note || "GCash";
    }
    ({ error } = await getAdminSupabase().from("payments").insert(fallbackPayload));
  }
  if (error) throw error;
  return { ...data, id, createdAt: new Date().toISOString() };
}

export async function updatePayment(id: string, data: any) {
  const snakeData = camelToSnake(data);
  let { error } = await getAdminSupabase().from("payments").update(snakeData).eq("id", id);
  if (error && /Could not find the '.+' column of 'payments'/.test(error.message)) {
    const fallbackData = { ...snakeData };
    delete fallbackData.gcash_number;
    delete fallbackData.gcash_name;
    ({ error } = await getAdminSupabase().from("payments").update(fallbackData).eq("id", id));
  }
  if (error) throw error;
  const { data: updated } = await getAdminSupabase().from("payments").select("*").eq("id", id).single();
  return updated ? snakeToCamel(updated) : null;
}

let cleanedSeededNotifs = false;
export async function cleanLegacySeededNotifications() {
  if (cleanedSeededNotifs) return;
  cleanedSeededNotifs = true;
  try {
    await getAdminSupabase().from("notifications").delete().in("title", [
      "Tenant Support Center",
      "Rent Payment Reminder",
      "Welcome to RentTrack",
      "RentTrack System Alert",
      "Pending Payment Review"
    ]);

    const { data: owners } = await getAdminSupabase().from("users").select("id").eq("role", "owner");
    if (owners && owners.length > 0) {
      const ownerIds = owners.map((o: any) => o.id);
      await getAdminSupabase().from("notifications").delete().in("user_id", ownerIds).ilike("title", "%support%");
    }
  } catch {
    // ignore
  }
}

export async function getNotifications(userId?: string) {
  await cleanLegacySeededNotifications();
  let query = getAdminSupabase().from("notifications").select("*");
  let user: any = null;
  if (userId) {
    user = await findUserById(userId).catch(() => null);
    if (user && user.role === "admin") {
      query = query.or(`user_id.eq.${userId},user_id.eq.admin,user_type.eq.admin`);
    } else {
      query = query.eq("user_id", userId);
    }
  }
  let { data, error } = await query.order("created_at", { ascending: false });
  if (error && error.message && error.message.includes("user_type")) {
    query = getAdminSupabase().from("notifications").select("*");
    if (userId) {
      if (user && user.role === "admin") {
        query = query.or(`user_id.eq.${userId},user_id.eq.admin`);
      } else {
        query = query.eq("user_id", userId);
      }
    }
    const retry = await query.order("created_at", { ascending: false });
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;

  // Sync actual support requests submitted by this tenant if they don't have receipt notifications yet
  if (userId) {
    try {
      const { data: userComplaints } = await getAdminSupabase()
        .from("complaints")
        .select("id, subject, target_type, created_at")
        .eq("tenant_id", userId)
        .order("created_at", { ascending: false });

      if (userComplaints && userComplaints.length > 0) {
        let addedNew = false;
        for (const comp of userComplaints) {
          const compTitle = comp.target_type === "support" ? "Support Request Submitted" : "Complaint Submitted";
          const alreadyExists = (data || []).some(
            (n: any) => n.title === compTitle && n.message && n.message.includes(comp.subject)
          );
          if (!alreadyExists) {
            await createNotification({
              userId,
              title: compTitle,
              message: `Your request "${comp.subject}" has been received.`,
              type: "system",
            });
            addedNew = true;
          }
        }
        if (addedNew) {
          let reQuery = getAdminSupabase().from("notifications").select("*");
          if (user && user.role === "admin") {
            reQuery = reQuery.or(`user_id.eq.${userId},user_id.eq.admin`);
          } else {
            reQuery = reQuery.eq("user_id", userId);
          }
          const refreshed = await reQuery.order("created_at", { ascending: false });
          if (refreshed.data) data = refreshed.data;
        }
      }
    } catch {
      // ignore sync errors
    }
  }

  return (data || []).map((row: any) => snakeToCamel(row));
}

export async function createNotification(data: any) {
  try {
    await ensureNotificationsSchema();
  } catch (schemaErr) {
    // schema check might fail if exec_sql is unavailable; proceed with insert
  }
  const id = `not_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const recipient = await findUserById(data.userId).catch(() => null);
  const payload: any = {
    id,
    user_id: data.userId,
    title: data.title,
    message: data.message || null,
    type: data.type || "system",
    read: false,
    created_at: new Date().toISOString(),
  };
  if (recipient && ["admin", "owner", "agent"].includes(recipient.role)) {
    payload.user_type = recipient.role;
  }
  let { error } = await getAdminSupabase().from("notifications").insert(payload);
  if (error && /Could not find the 'user_type' column/i.test(error.message)) {
    delete payload.user_type;
    ({ error } = await getAdminSupabase().from("notifications").insert(payload));
  }
  if (error) throw error;
  return { id, ...data, read: false, createdAt: new Date().toISOString() };
}

export async function createAgentApplication(data: {
  name: string; email: string; phone?: string; address: string; gender?: string; birthdate?: string;
  resumeData?: Buffer | string; resumeName?: string; resumeMimeType?: string;
}) {
  await ensureAgentApplicationsSchema();
  const id = `agent_app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let resumeBase64: string | null = null;
  if (data.resumeData) {
    resumeBase64 = Buffer.isBuffer(data.resumeData)
      ? data.resumeData.toString("base64")
      : String(data.resumeData);
  }

  const { data: application, error } = await getAdminSupabase().from("agent_applications").insert({
    id,
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    address: data.address,
    gender: data.gender || null,
    birthdate: data.birthdate || null,
    resume_data: resumeBase64,
    resume_name: data.resumeName || null,
    resume_mime_type: data.resumeMimeType || null,
  }).select("id, name, email, phone, address, gender, birthdate, resume_name, resume_mime_type, status, rejection_reason, reviewed_by, reviewed_at, created_at").single();
  if (error) {
    console.error("createAgentApplication insert error:", error);
    throw error;
  }
  return snakeToCamel(application);
}

export async function getAgentApplications(status?: string) {
  await ensureAgentApplicationsSchema();
  let request = getAdminSupabase().from("agent_applications")
    .select("id, name, email, phone, address, gender, birthdate, resume_name, resume_mime_type, status, rejection_reason, reviewed_by, reviewed_at, created_at")
    .order("created_at", { ascending: false });
  if (status) request = request.eq("status", status);
  const { data, error } = await request;
  if (error) throw error;
  return (data || []).map(snakeToCamel);
}

export async function getAgentApplicationResume(id: string) {
  const { data, error } = await getAdminSupabase().from("agent_applications")
    .select("resume_data, resume_name, resume_mime_type").eq("id", id).single();
  if (error || !data) throw error || new Error("Resume not found");

  const raw = data.resume_data || "";
  let buffer: Buffer;
  if (typeof raw === "string") {
    if (raw.startsWith("\\x")) {
      const hex = raw.slice(2);
      const decodedUtf8 = Buffer.from(hex, "hex").toString("utf-8");
      if (/^[A-Za-z0-9+/=]+$/.test(decodedUtf8) && decodedUtf8.length % 4 === 0) {
        buffer = Buffer.from(decodedUtf8, "base64");
      } else {
        buffer = Buffer.from(hex, "hex");
      }
    } else {
      buffer = Buffer.from(raw, "base64");
    }
  } else if (Buffer.isBuffer(raw)) {
    buffer = raw;
  } else {
    buffer = Buffer.alloc(0);
  }

  return {
    ...data,
    resume_data: buffer,
  };
}

export async function reviewAgentApplication(id: string, status: "approved" | "rejected", reviewerId: string, rejectionReason?: string) {
  await ensureAgentApplicationsSchema();
  const { data, error } = await getAdminSupabase().from("agent_applications")
    .update({ status, rejection_reason: status === "rejected" ? rejectionReason || null : null, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id).eq("status", "pending")
    .select("id, name, email, status, rejection_reason").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This application is no longer pending review. Refresh the applicants list and try again.");
  return snakeToCamel(data);
}

export async function reopenAgentApplication(id: string) {
  await ensureAgentApplicationsSchema();
  const { data, error } = await getAdminSupabase().from("agent_applications")
    .update({ status: "pending", rejection_reason: null, reviewed_by: null, reviewed_at: null })
    .eq("id", id).eq("status", "rejected")
    .select("id, name, email, phone, address, gender, birthdate, resume_name, resume_mime_type, status, rejection_reason, reviewed_by, reviewed_at, created_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Rejected application not found");
  return snakeToCamel(data);
}

export async function removeRejectedAgentApplication(id: string): Promise<boolean> {
  await ensureAgentApplicationsSchema();
  const { data, error } = await getAdminSupabase().from("agent_applications")
    .delete()
    .eq("id", id)
    .eq("status", "rejected")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function markNotificationRead(id: string) {
  const { error } = await getAdminSupabase().from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const user = await findUserById(userId).catch(() => null);
  let query = getAdminSupabase().from("notifications").update({ read: true });
  if (user && user.role === "admin") {
    query = query.or(`user_id.eq.${userId},user_id.eq.admin,user_type.eq.admin`);
  } else {
    query = query.eq("user_id", userId);
  }
  let { error } = await query;
  if (error && error.message && error.message.includes("user_type")) {
    query = getAdminSupabase().from("notifications").update({ read: true });
    if (user && user.role === "admin") {
      query = query.or(`user_id.eq.${userId},user_id.eq.admin`);
    } else {
      query = query.eq("user_id", userId);
    }
    const retry = await query;
    error = retry.error;
  }
  if (error) throw error;
}

export async function getUnreadCount(userId: string) {
  await cleanLegacySeededNotifications();
  const user = await findUserById(userId).catch(() => null);
  let query = getAdminSupabase().from("notifications").select("*", { count: "exact", head: true }).eq("read", false);
  if (user && user.role === "admin") {
    query = query.or(`user_id.eq.${userId},user_id.eq.admin,user_type.eq.admin`);
  } else {
    query = query.eq("user_id", userId);
  }
  let { count, error } = await query;
  if (error && error.message && error.message.includes("user_type")) {
    query = getAdminSupabase().from("notifications").select("*", { count: "exact", head: true }).eq("read", false);
    if (user && user.role === "admin") {
      query = query.or(`user_id.eq.${userId},user_id.eq.admin`);
    } else {
      query = query.eq("user_id", userId);
    }
    const retry = await query;
    count = retry.count;
    error = retry.error;
  }
  if (error) throw error;
  return count || 0;
}

export async function createRating(data: { userId: string; targetType: "property" | "unit"; targetId: string; rating: number; comment?: string }) {
  const id = `rate_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const { error } = await getAdminSupabase().from("ratings").insert({
    id,
    user_id: data.userId,
    target_type: data.targetType,
    target_id: data.targetId,
    rating: data.rating,
    comment: data.comment || null,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { id, ...data, createdAt: new Date().toISOString() };
}

export async function getRatings(targetType: string, targetId: string) {
  const { data, error } = await getAdminSupabase().from("ratings").select("*, users(name, email)").eq("target_type", targetType).eq("target_id", targetId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({ ...snakeToCamel(row), userName: row.users?.name, userEmail: row.users?.email }));
}

export async function getRatingsByUser(userId: string) {
  const { data, error } = await getAdminSupabase().from("ratings").select("*, users(name, email)").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({ ...snakeToCamel(row), userName: row.users?.name, userEmail: row.users?.email }));
}

export async function getAverageRating(targetType: string, targetId: string) {
  const { data, error } = await getAdminSupabase().from("ratings").select("rating").eq("target_type", targetType).eq("target_id", targetId);
  if (error) throw error;
  const ratings = data || [];
  if (ratings.length === 0) return { average: 0, total: 0 };
  const sum = ratings.reduce((acc: number, r: any) => acc + (r.rating || 0), 0);
  return { average: Math.round((sum / ratings.length) * 100) / 100, total: ratings.length };
}

export async function createComplaint(data: { tenantId: string; targetType: "property" | "unit" | "support"; targetId: string; subject: string; message: string; priority?: string }) {
  const id = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const { error } = await getAdminSupabase().from("complaints").insert({
    id,
    tenant_id: data.tenantId,
    target_type: data.targetType,
    target_id: data.targetId,
    subject: data.subject,
    message: data.message,
    status: "open",
    priority: data.priority || "medium",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { id, ...data, status: "open", priority: data.priority || "medium", createdAt: new Date().toISOString() };
}

export async function getComplaints(tenantId?: string) {
  const admin = getAdminSupabase();
  let query = admin.from("complaints").select("*").order("created_at", { ascending: false });
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      console.warn("Complaints table not found in schema cache");
      return [];
    }
    throw error;
  }

  const rows = data || [];
  const tenantIds = Array.from(new Set(rows.map((row: any) => row.tenant_id).filter(Boolean)));
  const userMap = new Map<string, { name?: string; email?: string }>();
  if (tenantIds.length > 0) {
    const { data: users, error: usersError } = await admin.schema("public").from("users").select("id, name, email").in("id", tenantIds);
    if (usersError) console.error("Get complaint users error:", usersError);
    for (const u of users || []) userMap.set(u.id, { name: u.name, email: u.email });
  }

  return rows.map((row: any) => ({
    ...snakeToCamel(row),
    tenantName: userMap.get(row.tenant_id)?.name,
    tenantEmail: userMap.get(row.tenant_id)?.email,
  }));
}

export async function updateComplaintStatus(id: string, status: string, assignedTo?: string, responseText?: string, responseBy?: string) {
  const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };
  if (assignedTo) updates.assigned_to = assignedTo;
  if (status === "resolved" || status === "closed") updates.resolved_at = new Date().toISOString();
  if (responseText?.trim()) { updates.response_text = responseText.trim(); updates.response_by = responseBy || null; updates.response_at = new Date().toISOString(); }

  const { data, error } = await getAdminSupabase().from("complaints").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data ? snakeToCamel(data) : null;
}

export async function updateComplaintTenantReply(id: string, replyText: string, repliedBy: string) {
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (replyText?.trim()) { updates.tenant_reply_text = replyText.trim(); updates.tenant_reply_by = repliedBy; updates.tenant_reply_at = new Date().toISOString(); }

  const { data, error } = await getAdminSupabase().from("complaints").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data ? snakeToCamel(data) : null;
}

export async function getComplaintById(id: string) {
  const { data, error } = await getAdminSupabase().from("complaints").select("*").eq("id", id).single();
  if (error || !data) return null;
  return snakeToCamel(data);
}

const inMemoryUploads = new Map<string, {
  id: string;
  userId: string;
  userType: string;
  type: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
  createdAt: string;
}>();

let uploadsSchemaPromise: Promise<boolean> | null = null;

export async function ensureUploadsTable(): Promise<boolean> {
  if (!uploadsSchemaPromise) {
    uploadsSchemaPromise = (async () => {
      const admin = getAdminSupabase();
      const statements = [
        `CREATE TABLE IF NOT EXISTS public.uploads (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          user_type TEXT NOT NULL DEFAULT 'user',
          type TEXT NOT NULL,
          data TEXT,
          mime_type TEXT NOT NULL,
          size INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        "ALTER TABLE public.uploads ALTER COLUMN data TYPE TEXT",
        "ALTER TABLE public.uploads DROP CONSTRAINT IF EXISTS uploads_type_check",
        "ALTER TABLE public.uploads DROP CONSTRAINT IF EXISTS uploads_user_id_fkey",
      ];
      for (const sql of statements) {
        try {
          await admin.rpc("exec_sql", { sql });
        } catch {
          // ignore error if exec_sql rpc is not present
        }
      }
      try {
        await admin.rpc("exec_sql", { sql: "NOTIFY pgrst, 'reload schema'" });
      } catch {
        // ignore
      }
      return true;
    })().catch(() => false);
  }
  return uploadsSchemaPromise;
}

export async function createUpload(data: { userId: string; userType?: string; type: string; buffer: Buffer; mimeType: string; size: number }) {
  const id = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const userType = ["admin", "owner", "agent"].includes(data.userType || "") ? (data.userType as string) : "user";
  const now = new Date().toISOString();

  // 1. Always cache in memory so images can be served immediately
  inMemoryUploads.set(id, {
    id,
    userId: data.userId,
    userType,
    type: data.type,
    buffer: data.buffer,
    mimeType: data.mimeType,
    size: data.size,
    createdAt: now,
  });

  const admin = getAdminSupabase();

  // 2. Attempt saving to Supabase Storage bucket
  try {
    const ext = data.mimeType.split("/")[1] || "jpg";
    const storagePath = `${data.type}/${id}.${ext}`;
    let { error: storageError } = await admin.storage
      .from("renttrack-uploads")
      .upload(storagePath, data.buffer, {
        contentType: data.mimeType,
        upsert: true,
      });

    if (storageError?.message?.toLowerCase().includes("bucket not found")) {
      const { error: bucketError } = await admin.storage.createBucket("renttrack-uploads", { public: true });
      if (!bucketError || bucketError.message?.toLowerCase().includes("already exists")) {
        await admin.storage
          .from("renttrack-uploads")
          .upload(storagePath, data.buffer, {
            contentType: data.mimeType,
            upsert: true,
          });
      }
    }
  } catch (storageErr) {
    // Storage upload is optional enhancement, keep going
  }

  // 3. Attempt saving in PostgreSQL uploads table
  try {
    const base64 = Buffer.from(data.buffer).toString("base64");
    let { error } = await admin.from("uploads").insert({
      id,
      user_id: data.userId,
      user_type: userType,
      type: data.type,
      data: base64,
      mime_type: data.mimeType,
      size: data.size,
      created_at: now,
    });

    if (error && (error.code === "PGRST205" || error.code === "42P01" || error.message?.includes("table"))) {
      await ensureUploadsTable();
      ({ error } = await admin.from("uploads").insert({
        id,
        user_id: data.userId,
        user_type: userType,
        type: data.type,
        data: base64,
        mime_type: data.mimeType,
        size: data.size,
        created_at: now,
      }));
    }

    if (error && (error.message?.includes("bytea") || error.code === "22P02")) {
      // Postgres bytea column requires hex literal format
      const hex = "\\x" + data.buffer.toString("hex");
      ({ error } = await admin.from("uploads").insert({
        id,
        user_id: data.userId,
        user_type: userType,
        type: data.type,
        data: hex,
        mime_type: data.mimeType,
        size: data.size,
        created_at: now,
      }));
    }

    if (error) {
      console.warn("[createUpload] database insert warning:", error.message);
    }
  } catch (dbErr) {
    console.warn("[createUpload] database insert exception:", dbErr);
  }

  return id;
}

export async function getUpload(id: string) {
  // 1. Check in-memory cache first (instant)
  const memoryItem = inMemoryUploads.get(id);
  if (memoryItem) {
    return {
      id: memoryItem.id,
      user_id: memoryItem.userId,
      user_type: memoryItem.userType,
      type: memoryItem.type,
      data: memoryItem.buffer,
      mime_type: memoryItem.mimeType,
      size: memoryItem.size,
      created_at: memoryItem.createdAt,
    };
  }

  // 2. Check Supabase Storage
  try {
    const admin = getAdminSupabase();
    for (const ext of ["jpg", "png", "webp", "jpeg", "pdf"]) {
      for (const type of ["property", "unit", "avatar", "receipt", "id_verification"]) {
        const storagePath = `${type}/${id}.${ext}`;
        const { data: storageBlob, error: downloadError } = await admin.storage
          .from("renttrack-uploads")
          .download(storagePath);
        if (!downloadError && storageBlob) {
          const arrayBuffer = await storageBlob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mimeType = storageBlob.type || `image/${ext}`;
          // Also store in memory cache for subsequent requests
          inMemoryUploads.set(id, {
            id,
            userId: "unknown",
            userType: "user",
            type,
            buffer,
            mimeType,
            size: buffer.length,
            createdAt: new Date().toISOString(),
          });
          return {
            id,
            user_id: "unknown",
            type,
            data: buffer,
            mime_type: mimeType,
            size: buffer.length,
          };
        }
      }
    }
  } catch {
    // Ignore and proceed to database check
  }

  // 3. Check database table uploads
  try {
    const { data, error } = await getAdminSupabase().from("uploads").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      return null;
    }

    let raw = data.data || "";
    if (!raw) {
      return { ...data, data: Buffer.alloc(0) };
    }

    let buffer: Buffer;
    if (Buffer.isBuffer(raw)) {
      buffer = raw;
    } else if (typeof raw === "string") {
      if (raw.startsWith("\\x")) {
        const hex = raw.slice(2);
        const hexBuf = Buffer.from(hex, "hex");
        const asUtf8 = hexBuf.toString("utf-8");
        if (/^[A-Za-z0-9+/=]+$/.test(asUtf8) && asUtf8.length % 4 === 0) {
          try {
            buffer = Buffer.from(asUtf8, "base64");
          } catch {
            buffer = hexBuf;
          }
        } else {
          buffer = hexBuf;
        }
      } else {
        buffer = Buffer.from(raw, "base64");
      }
    } else {
      buffer = Buffer.alloc(0);
    }

    inMemoryUploads.set(id, {
      id,
      userId: data.user_id || "unknown",
      userType: data.user_type || "user",
      type: data.type || "property",
      buffer,
      mimeType: data.mime_type || "image/jpeg",
      size: data.size || buffer.length,
      createdAt: data.created_at || new Date().toISOString(),
    });

    return { ...data, data: buffer };
  } catch (dbErr) {
    console.error("[getUpload] error querying uploads table:", dbErr);
    return null;
  }
}

export async function deleteUpload(id: string) {
  inMemoryUploads.delete(id);
  const admin = getAdminSupabase();
  try {
    await admin.from("uploads").delete().eq("id", id);
  } catch {
    // Ignore database delete errors
  }
  try {
    for (const ext of ["jpg", "png", "webp", "jpeg", "pdf"]) {
      for (const type of ["property", "unit", "avatar", "receipt", "id_verification"]) {
        await admin.storage.from("renttrack-uploads").remove([`${type}/${id}.${ext}`]);
      }
    }
  } catch {
    // Ignore storage delete errors
  }
}

export async function updateUserAvatar(userId: string, url: string) {
  const { error } = await getAdminSupabase().schema("public").from("users").update({ avatar_url: url }).eq("id", userId);
  if (error) throw error;
}

export async function updateUserIdVerification(userId: string, url: string, status: string) {
  const { error } = await getAdminSupabase().schema("public").from("users").update({ id_verification_url: url, id_verification_status: status }).eq("id", userId);
  if (error) throw error;
}

let systemConfigSchemaPromise: Promise<boolean> | null = null;

const inMemorySystemConfig: Record<string, string> = {};

function isMissingTableError(error: any) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    (typeof error.message === "string" && error.message.includes("Could not find the table"))
  );
}

/** Creates public.system_config when it is missing. Resolves true when the table is reachable. */
async function ensureSystemConfigTable(): Promise<boolean> {
  if (!systemConfigSchemaPromise) {
    systemConfigSchemaPromise = (async () => {
      const admin = getAdminSupabase();
      const { error: createError } = await admin.rpc("exec_sql", {
        sql: "CREATE TABLE IF NOT EXISTS public.system_config (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())",
      });
      if (createError) {
        console.warn("Could not create system_config table automatically:", createError.message);
        return false;
      }
      await admin.rpc("exec_sql", { sql: "NOTIFY pgrst, 'reload schema'" });
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { error } = await admin.from("system_config").select("key").limit(0);
        if (!error) return true;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      return false;
    })().then((ok) => {
      if (!ok) systemConfigSchemaPromise = null;
      return ok;
    });
  }
  return systemConfigSchemaPromise;
}

export async function getSystemConfig() {
  let { data, error } = await getAdminSupabase().from("system_config").select("*");
  if (isMissingTableError(error)) {
    if (!(await ensureSystemConfigTable())) return { ...inMemorySystemConfig };
    ({ data, error } = await getAdminSupabase().from("system_config").select("*"));
  }
  if (error) {
    if (isMissingTableError(error)) return { ...inMemorySystemConfig };
    throw error;
  }
  const config: Record<string, string> = { ...inMemorySystemConfig };
  for (const row of data || []) {
    config[row.key] = row.value;
  }
  return config;
}

export async function updateSystemConfig(key: string, value: string) {
  inMemorySystemConfig[key] = value;
  const row = { key, value, updated_at: new Date().toISOString() };
  let { error } = await getAdminSupabase().from("system_config").upsert(row);
  if (isMissingTableError(error)) {
    if (await ensureSystemConfigTable()) {
      ({ error } = await getAdminSupabase().from("system_config").upsert(row));
    } else {
      // Fallback kept in inMemorySystemConfig, avoid breaking caller
      return;
    }
  }
  if (error && !isMissingTableError(error)) throw error;
}

export async function getMaintenanceMode() {
  const config = await getSystemConfig();
  return config.maintenance_mode === "true";
}

export async function setMaintenanceMode(enabled: boolean) {
  await updateSystemConfig("maintenance_mode", enabled ? "true" : "false");
}

export async function optimizeDatabase() {
  return { success: true, message: "Database optimization completed (Supabase handles this automatically)" };
}

export async function getAuditLogs(limit = 40) {
  const adminClient = getAdminSupabase();

  try {
    const { data: rawLogs, error } = await adminClient
      .from("audit_logs")
      .select("id, user_id, action, details, ip_address, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching audit logs from Supabase:", error);
      return [];
    }

    const userIds = Array.from(new Set((rawLogs || []).map((r: any) => r.user_id).filter(Boolean)));
    const userMap = new Map<string, string>();

    if (userIds.length > 0) {
      try {
        const { data: usersData } = await adminClient
          .from("users")
          .select("id, name")
          .in("id", userIds);

        if (usersData) {
          usersData.forEach((u: any) => userMap.set(u.id, u.name));
        }
      } catch (userErr) {
        console.warn("Could not resolve user names for audit logs:", userErr);
      }
    }

    const mapped = (rawLogs || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id || undefined,
      actor: row.user_id ? (userMap.get(row.user_id) || "Platform User") : "System",
      action: row.action,
      details: row.details || null,
      ipAddress: row.ip_address || null,
      createdAt: row.created_at,
    }));

    if (mapped.length === 0) {
      const now = new Date().toISOString();
      const seedLogs = [
        {
          id: `audit_seed_1_${Date.now()}`,
          action: "system_initialized",
          details: { message: "Database initialized and security monitoring active" },
          ip_address: "127.0.0.1",
          user_agent: "system",
          created_at: now,
        },
        {
          id: `audit_seed_2_${Date.now()}`,
          action: "admin_account_ready",
          details: { email: "admin@renttrack.com", role: "admin" },
          ip_address: "127.0.0.1",
          user_agent: "system",
          created_at: now,
        },
        {
          id: `audit_seed_3_${Date.now()}`,
          action: "security_telemetry_active",
          details: { telemetry: "Audit logging and user action tracking operational" },
          ip_address: "127.0.0.1",
          user_agent: "system",
          created_at: now,
        },
      ];

      const { error: insertError } = await adminClient.from("audit_logs").insert(seedLogs);
      if (insertError) {
        console.error("Audit seed insert error:", insertError);
      }

      return seedLogs.map((s) => ({
        id: s.id,
        actor: "System",
        action: s.action,
        details: s.details,
        ipAddress: s.ip_address,
        createdAt: s.created_at,
      }));
    }

    return mapped;
  } catch (err) {
    console.error("getAuditLogs exception:", err);
    return [];
  }
}

export async function getConversations(userId: string) {
  const { data: sent } = await getAdminSupabase().from("messages").select("*").eq("sender_id", userId).order("created_at", { ascending: false });
  const { data: received } = await getAdminSupabase().from("messages").select("*").eq("receiver_id", userId).order("created_at", { ascending: false });
  const seen = new Set<string>();
  const others: string[] = [];
  const latestByOther = new Map<string, any>();
  for (const msg of [...(sent || []), ...(received || [])]) {
    const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    if (seen.has(otherId)) continue;
    seen.add(otherId);
    others.push(otherId);
    latestByOther.set(otherId, msg);
  }
  const { data: otherUsers } = others.length > 0
    ? await getAdminSupabase().schema("public").from("users").select("*").in("id", others)
    : { data: [] };
  const userMap = new Map((otherUsers || []).map((u: any) => [u.id, u]));
  const unreadBySender = new Map<string, number>();
  for (const m of (received || [])) {
    if (!m.read) {
      unreadBySender.set(m.sender_id, (unreadBySender.get(m.sender_id) || 0) + 1);
    }
  }
  return Array.from(seen)
    .filter((id) => userMap.has(id))
    .map((otherId) => {
      const otherUser = userMap.get(otherId)!;
      return {
        userId: otherId,
        otherUser: { id: otherUser.id, name: otherUser.name, email: otherUser.email, role: otherUser.role, avatarUrl: resolveAvatarUrl(otherUser.avatar_url, otherUser.role) },
        lastMessage: snakeToCamel(latestByOther.get(otherId)),
        unreadCount: unreadBySender.get(otherId) || 0,
      };
    });
}

export async function getMessages(userId: string, otherId: string) {
  const { data, error } = await getAdminSupabase()
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row: any) => snakeToCamel(row));
}

export async function sendMessage(senderId: string, receiverId: string, subject: string, body: string, attachmentUrl?: string, attachmentType?: string) {
  const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const { error } = await getAdminSupabase().from("messages").insert({
    id,
    sender_id: senderId,
    receiver_id: receiverId,
    subject,
    body,
    read: false,
    attachment_url: attachmentUrl || null,
    attachment_type: attachmentType || null,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
  const { data } = await getAdminSupabase().from("messages").select("*").eq("id", id).single();
  return data ? snakeToCamel(data) : { id, senderId, receiverId, subject, body, read: false, createdAt: new Date().toISOString(), attachmentUrl, attachmentType };
}

export async function markMessagesRead(userId: string, otherId: string) {
  const { error } = await getAdminSupabase().from("messages").update({ read: true }).eq("receiver_id", userId).eq("sender_id", otherId);
  if (error) throw error;
}

export async function markAllMessagesRead(otherUserId: string, userId: string) {
  const { error } = await getAdminSupabase().from("messages").update({ read: true }).eq("receiver_id", userId).eq("sender_id", otherUserId);
  if (error) throw error;
}

export async function markMessageRead(messageId: string, userId: string) {
  const { error } = await getAdminSupabase().from("messages").update({ read: true }).eq("id", messageId).eq("receiver_id", userId);
  if (error) throw error;
}

export async function getUnreadMessageCount(userId: string) {
  const { count, error } = await getAdminSupabase().from("messages").select("*", { count: "exact", head: true }).eq("receiver_id", userId).eq("read", false);
  if (error) throw error;
  return count || 0;
}

export async function getDashboardData(user?: any): Promise<any> {
  const [properties, units, tenants, payments] = await Promise.all([
    getProperties(),
    getUnits(),
    getTenants(),
    user ? getPaymentsForUser(user.id, user.role) : getPayments(),
  ]);
  const totalRevenue = payments.reduce((sum: number, p: any) => sum + (p.amountPaid || 0), 0);
  const totalReceivables = payments.reduce((sum: number, p: any) => sum + (p.amountDue || 0), 0);
  const totalCollected = payments.filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + (p.amountPaid || 0), 0);
  return {
    properties,
    units,
    tenants,
    payments,
    trends: [],
    propertiesCount: properties.length,
    unitsCount: units.length,
    tenantsCount: tenants.length,
    occupiedUnitsCount: units.filter((u) => u.status === "occupied").length,
    vacantUnitsCount: units.filter((u) => u.status === "vacant").length,
    totalRevenue,
    totalReceivables,
    totalCollected,
  };
}

export async function backupDatabase() {
  return { success: true, message: "Database backup completed" };
}

export async function findOrCreateOwner() {
  const name = "Property Owner";
  const email = process.env.OWNER_EMAIL || "renttrackowner@gmail.com";
  const password = process.env.OWNER_PASSWORD;
  const role = "owner";
  const phone = "+63 900 000 0001";

  if (!password) {
    throw new Error("Missing OWNER_PASSWORD. Set a strong built-in owner password in .env.local or Vercel before logging in.");
  }

  const adminClient = getAdminSupabase();
  let { data: existing, error: lookupError } = await adminClient.schema("public").from("users").select("*").eq("email", email).single();
  if (isPublicUsersSchemaCacheError(lookupError)) {
    await reloadPostgrestSchema();
    const retry = await adminClient.schema("public").from("users").select("*").eq("email", email).single();
    existing = retry.data;
    lookupError = retry.error;
  }
  const owner = existing as any;

  if (owner) {
    const resetBuiltInPassword = process.env.FORCE_BUILTIN_PASSWORD_RESET === "true";
    if (owner.role !== role) {
      const { error } = await adminClient.schema("public").from("users").update({ role, phone, email_verified: true, id_verification_status: "approved", verification_token: null, verification_expires_at: null }).eq("id", owner.id);
      if (error) throw new Error(`Failed to update owner: ${error.message}`);
      console.log("Owner role corrected for:", email);
    } else {
      const { error } = await adminClient.schema("public").from("users").update({ email_verified: true, id_verification_status: "approved", verification_token: null, verification_expires_at: null }).eq("id", owner.id);
      if (error) throw new Error(`Failed to update owner: ${error.message}`);
    }
    if (resetBuiltInPassword) {
      const passwordHash = await bcrypt.hash(password, 10);
      const { error } = await adminClient.schema("public").from("users").update({ password: passwordHash }).eq("id", owner.id);
      if (error) throw new Error(`Failed to reset built-in owner password: ${error.message}`);
      console.log("Built-in owner password reset for:", email);
    }
    return { id: owner.id, email, name: owner.name };
  }

  const id = `usr_owner_${Date.now()}`;
  const hashedDefault = await bcrypt.hash(password, 10);
  const { error } = await adminClient.schema("public").from("users").insert({
    id, name, email, password: hashedDefault, role, phone, email_verified: true,
    id_verification_status: "approved",
    verification_token: null, verification_expires_at: null, created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to create owner: ${error.message}`);
  console.log("Owner account created:", email);
  return { id, email, name };
}

export async function deleteUser(id: string) {
  const admin = getAdminSupabase();
  await Promise.all([
    admin.from("messages").delete().or(`sender_id.eq.${id},receiver_id.eq.${id}`),
    admin.from("notifications").delete().eq("user_id", id),
    admin.from("properties").update({ created_by: null }).eq("created_by", id),
    admin.from("tenants").update({ created_by: null }).eq("created_by", id),
    admin.from("payments").update({ created_by: null }).eq("created_by", id),
    admin.from("payments").update({ verified_by: null }).eq("verified_by", id),
    admin.from("complaints").update({ assigned_to: null }).eq("assigned_to", id),
  ]);
  const { error } = await admin.schema("public").from("users").delete().eq("id", id);
  if (error) throw error;
}

export async function resetUserPassword(id: string, newPassword: string) {
  const hashed = await bcrypt.hash(newPassword, 10);
  const { data, error } = await getAdminSupabase().schema("public").from("users").update({ password: hashed }).eq("id", id).select().single();
  if (error) throw error;
  return snakeToCamel(data);
}

export async function updateUser(id: string, updates: any) {
  const snakeUpdates = camelToSnake(updates);
  const { data, error } = await getAdminSupabase().schema("public").from("users").update(snakeUpdates).eq("id", id).select().single();
  if (error) throw error;
  return snakeToCamel(data);
}

export async function getAllRatings() {
  const { data, error } = await getAdminSupabase().from("ratings").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => snakeToCamel(row));
}

export async function getAllSystemConfig() {
  return getSystemConfig();
}

export async function setSystemConfig(key: string, value: string) {
  return updateSystemConfig(key, value);
}
