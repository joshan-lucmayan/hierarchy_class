/**
 * Seed script for populating schools in Supabase.
 * Run this from your local machine after migrations are applied:
 *   npx ts-node -P tsconfig.json scripts/seed.ts
 *
 * Or execute the SQL directly in Supabase dashboard:
 *   SQL Editor > New Query > paste contents below
 *
 * School registration is PLATFORM-OWNER controlled: this script is the
 * controlled mechanism for a fresh database. Existing rows are untouched
 * (upsert on name). CSA - College of Saint Amateil is the sole registered
 * school; registration_enabled = true means it is open for public
 * student/teacher signup. New schools are added only by the platform owner
 * (add a row here, then flip registration_enabled to true when ready).
 */

import { createClient } from "@supabase/supabase-js";
import type { Database, SchoolInsert } from "@/types/supabase";

// The sole registered school. Add future tenants here as the platform owner.
const SCHOOLS_SEED: SchoolInsert[] = [
  { name: "CSA - College of Saint Amateil", abbreviation: "CSA", active: true, registration_enabled: true },
];

async function seed(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  console.log("Seeding schools...");

  for (const school of SCHOOLS_SEED) {
    const { data, error } = await (supabase
      .from("schools")
      .upsert([school] as any, { onConflict: "name" })
      .select() as any);

    if (error) {
      console.error(`Error seeding school ${school.name}:`, error);
    } else {
      console.log(`✓ Seeded school: ${school.name}`);
    }
  }

  console.log("Done!");
}

seed().catch((error: Error) => {
  console.error("Seed error:", error);
  process.exit(1);
});
