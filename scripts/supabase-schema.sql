-- RentTrack Complete Supabase Schema - Separate Tables Design

CREATE SCHEMA IF NOT EXISTS public;
SET search_path TO public;

-- ============================================
-- CORE AUTH TABLES (Separate by Role)
-- ============================================

-- Admins (created by system only)
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  phone TEXT,
  email_verified BOOLEAN DEFAULT TRUE,
  verification_token TEXT,
  verification_expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Owners (created by admin only)
CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  phone TEXT,
  address TEXT,
  email_verified BOOLEAN DEFAULT TRUE,
  verification_token TEXT,
  verification_expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES admins(id)
);

-- Agents (created by owner/admin only via approval)
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  phone TEXT,
  address TEXT NOT NULL CHECK (address IN ('Cebu', 'Manila', 'Davao', 'Butuan')),
  license_number TEXT,
  specialization TEXT,
  experience TEXT DEFAULT '0 Years',
  avatar_url TEXT,
  id_verification_url TEXT,
  id_verification_status TEXT DEFAULT 'pending' CHECK (id_verification_status IN ('pending', 'approved', 'rejected')),
  email_verified BOOLEAN DEFAULT TRUE,
  verification_token TEXT,
  verification_expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES owners(id)
);

-- Public Users / Tenants (self-registration allowed)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'tenant' CHECK (role IN ('admin', 'owner', 'agent', 'tenant')),
  phone TEXT,
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  commission_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  address TEXT,
  payment_pin_hash TEXT,
  payment_pin_set_at TIMESTAMPTZ,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  verification_expires_at TIMESTAMPTZ,
  login_otp TEXT,
  login_otp_expires_at TIMESTAMPTZ,
  gender TEXT,
  birthdate DATE,
  country TEXT,
  avatar_url TEXT,
  id_verification_url TEXT,
  id_verification_status TEXT DEFAULT 'pending' CHECK (id_verification_status IN ('pending', 'approved', 'rejected')),
  profile_visibility BOOLEAN DEFAULT TRUE,
  show_email BOOLEAN DEFAULT FALSE,
  show_phone BOOLEAN DEFAULT FALSE,
  allow_messages BOOLEAN DEFAULT TRUE,
  data_sharing BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'tenant' CHECK (role IN ('admin', 'owner', 'agent', 'tenant'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS commission_rate DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE public.users DROP COLUMN IF EXISTS languages;
ALTER TABLE public.users DROP COLUMN IF EXISTS hobbies;
ALTER TABLE public.users DROP COLUMN IF EXISTS about_me;

INSERT INTO public.users (
  id,
  name,
  email,
  password,
  role,
  phone,
  email_verified,
  verification_token,
  verification_expires_at,
  created_at
)
VALUES
  (
    'usr_builtin_admin',
    'System Administrator',
    'admin@renttrack.com',
    '$2b$10$28P2/SB3muVLzXxanHxrnOTuCa/S.oGeM/j.H7Q3zmuVeFDJ.bdDC',
    'admin',
    '+63 900 000 0000',
    TRUE,
    NULL,
    NULL,
    NOW()
  ),
  (
    'usr_builtin_owner',
    'Property Owner',
    'renttrackowner@gmail.com',
    '$2b$10$EDMO6/akEKnhWFFklmU2SOzPVj.Hed8iY7.6ateecNEB/yKUhQlBG',
    'owner',
    '+63 900 000 0001',
    TRUE,
    NULL,
    NULL,
    NOW()
  )
ON CONFLICT (email) DO UPDATE
SET
  role = EXCLUDED.role,
  email_verified = TRUE,
  password = COALESCE(public.users.password, EXCLUDED.password),
  verification_token = NULL,
  verification_expires_at = NULL;

NOTIFY pgrst, 'reload schema';

-- ============================================
-- SUPPORTING TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'owner', 'agent', 'user')),
  type TEXT NOT NULL CHECK (type IN ('avatar', 'id_verification', 'property', 'unit', 'receipt')),
  data BYTEA NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_type_check;
ALTER TABLE uploads ADD CONSTRAINT uploads_type_check
  CHECK (type IN ('avatar', 'id_verification', 'property', 'unit', 'receipt', 'contract'));

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('house', 'condominium')),
  units INTEGER DEFAULT 0,
  occupied_units INTEGER DEFAULT 0,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  monthly_revenue DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES owners(id),
  agent_id TEXT REFERENCES agents(id),
  image_url TEXT,
  image_urls JSONB DEFAULT '[]'::jsonb,
  features JSONB DEFAULT '[]'::jsonb,
  condition TEXT,
  availability_status TEXT DEFAULT 'Available'
);

CREATE TABLE IF NOT EXISTS units (
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
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
  assignment_status TEXT DEFAULT '' CHECK (assignment_status IN ('', 'pending', 'confirmed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS rental_contracts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
);

CREATE INDEX IF NOT EXISTS rental_contracts_owner_created_idx ON rental_contracts(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rental_contracts_agent_created_idx ON rental_contracts(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS move_out_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_name TEXT,
  unit_id TEXT,
  property_name TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
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
  gcash_number TEXT,
  gcash_name TEXT,
  receipt_url TEXT,
  notes TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'owner', 'agent', 'user')),
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'system' CHECK (type IN ('payment', 'tenant', 'property', 'system', 'id_verification')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_applications (
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
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE TABLE IF NOT EXISTS payment_verification_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'owner', 'agent', 'user')),
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_type TEXT CHECK (user_type IN ('admin', 'owner', 'agent', 'user')),
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'owner', 'agent', 'user')),
  target_type TEXT NOT NULL CHECK (target_type IN ('property', 'unit', 'support')),
  target_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, user_type, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS agent_certificates (
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
);

CREATE INDEX IF NOT EXISTS agent_certificates_agent_id_created_at_idx
  ON agent_certificates(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_badges (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  awarded_by TEXT NOT NULL REFERENCES public.users(id),
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, badge_key)
);

CREATE INDEX IF NOT EXISTS agent_badges_agent_id_awarded_at_idx
  ON agent_badges(agent_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('property', 'unit', 'support')),
  target_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to TEXT,
  resolved_at TIMESTAMPTZ,
  response_text TEXT,
  response_by TEXT,
  response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'owner', 'agent', 'user')),
  receiver_id TEXT NOT NULL,
  receiver_type TEXT NOT NULL CHECK (receiver_type IN ('admin', 'owner', 'agent', 'user')),
  subject TEXT,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  attachment_url TEXT,
  attachment_type TEXT CHECK (attachment_type IN ('image', 'audio')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  property_id TEXT REFERENCES properties(id),
  sender_name TEXT,
  sender_email TEXT,
  sender_phone TEXT,
  tenant_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES agents(id),
  agent_name TEXT,
  reply_text TEXT,
  reply_token TEXT,
  replied_at TIMESTAMPTZ,
  visitor_reply TEXT,
  visitor_replied_at TIMESTAMPTZ,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_agent_tenant_idx
  ON public.chat_messages(agent_id, tenant_id);

CREATE TABLE IF NOT EXISTS agent_reviews (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  inquiry_id TEXT NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS agent_reviews_agent_id_created_at_idx
  ON agent_reviews(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RPC FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION exec_sql(sql text, params text[] DEFAULT '{}')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF params IS NULL OR cardinality(params) = 0 THEN
    EXECUTE sql;
  ELSE
    EXECUTE sql USING params;
  END IF;
END;
$$;

-- ============================================
-- REFRESH POSTGREST CACHE
-- ============================================

NOTIFY pgrst, 'reload schema';
