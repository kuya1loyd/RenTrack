// Run this with: node scripts/reset-agent-password.mjs
// Usage: node scripts/reset-agent-password.mjs <email> <new-password>

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || "").trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.warn("Could not load .env.local", e);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pwnqqkmtftipvdkbbjyo.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3bnFxa210ZnRpcHZka2JianlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEyOTM4MCwiZXhwIjoyMTA1NzA1MzgwfQ.m-Ci9P-FgEkB_sQCar4dezO9xl55_RBiNF1bDcdm6N8";

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log("Usage: node scripts/reset-agent-password.mjs <email> <new-password>");
  console.log("Example: node scripts/reset-agent-password.mjs kurtyancy4@gmail.com MyNewPass123");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const hashed = await bcrypt.hash(newPassword, 10);

const { data, error } = await supabase
  .from("users")
  .update({ password: hashed })
  .eq("email", email.toLowerCase())
  .select("id, name, email, role, email_verified");

if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

console.log("✅ Password updated successfully!");
console.log(`   Email: ${data[0].email}`);
console.log(`   Name: ${data[0].name}`);
console.log(`   Role: ${data[0].role}`);
console.log(`   Verified: ${data[0].email_verified}`);
console.log(`\n   You can now login with: ${email} / ${newPassword}`);
