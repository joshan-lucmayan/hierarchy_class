import { School } from "@/types/school";

// TEMP: replace with `supabase.from("schools").select("id, name, abbreviation")`
// once the multi-tenant schools table exists. Keeping this here for now so the
// login UI is fully testable before the backend is wired up.
export const MOCK_SCHOOLS: School[] = [
  { id: "csa", name: "CSA - College of Saint Amateil", abbreviation: "CSA" },
  { id: "svs", name: "SVS - St. Vincent School", abbreviation: "SVS" },
  { id: "hna", name: "HNA - Holy Name Academy", abbreviation: "HNA" },
  { id: "gis", name: "GIS - Greenfield Integrated School", abbreviation: "GIS" },
  { id: "mvs", name: "MVS - Mount Vernon School", abbreviation: "MVS" },
];
