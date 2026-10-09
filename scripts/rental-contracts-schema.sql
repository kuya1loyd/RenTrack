CREATE TABLE IF NOT EXISTS public.rental_contracts (
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
);

ALTER TABLE public.rental_contracts ALTER COLUMN agent_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS rental_contracts_owner_created_idx
  ON public.rental_contracts(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rental_contracts_agent_created_idx
  ON public.rental_contracts(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rental_contracts_tenant_created_idx
  ON public.rental_contracts(tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.exec_sql(sql text, params text[] DEFAULT '{}')
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

NOTIFY pgrst, 'reload schema';
