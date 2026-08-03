/**
 * Seed script for populating schools in Supabase
 * Run this from your local machine after migrations are applied:
 *   npx ts-node -P tsconfig.json scripts/seed.ts
 *
 * Or execute the SQL directly in Supabase dashboard:
 *   SQL Editor > New Query > paste contents below
 */

import { createClient } from "@supabase/supabase-js";
import type { Database, SchoolInsert } from "@/types/supabase";

const SCHOOLS_SEED: SchoolInsert[] = [
  {
    name: "CSA - College of Saint Amateil",
    abbreviation: "CSA",
    active: true,
  },
  {
    name: "SVS - St. Vincent School",
    abbreviation: "SVS",
    active: true,
  },
  {
    name: "HNA - Holy Name Academy",
    abbreviation: "HNA",
    active: true,
  },
  {
    name: "GIS - Greenfield Integrated School",
    abbreviation: "GIS",
    active: true,
  },
  {
    name: "MVS - Mount Vernon School",
    abbreviation: "MVS",
    active: true,
  },
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
