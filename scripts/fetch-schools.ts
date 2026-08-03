import { createClient } from "@supabase/supabase-js";
import type { Database, SchoolRow } from "@/types/supabase";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient<Database>(url, anonKey);

async function fetchSchools() {
  try {
    const { data, error } = await supabase
      .from("schools")
      .select("id, name, abbreviation")
      .eq("active", true)
      .order("name");

    if (error) {
      console.error("Database error:", error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.error("No schools found in database");
      process.exit(1);
    }

    console.log("Schools from database:\n");
    data.forEach((school: SchoolRow) => {
      console.log(`  {
    id: "${school.id}",
    name: "${school.name}",
    abbreviation: "${school.abbreviation}",
  },`);
    });

    console.log("\n✅ Copy the above into data/schools.ts\n");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

fetchSchools();
