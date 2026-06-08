const FALLBACK_URL = "https://atipsraxpxbjbecjobuv.supabase.co";
const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0aXBzcmF4cHhiamJlY2pvYnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Mzk5MTUsImV4cCI6MjA5NTQxNTkxNX0.RyPg0gJqTbrgvgSfk6DfnkHwVqvvncVLswtNqO5nw_o";

export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;

export const SUPABASE_PUBLISHABLE_KEY: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_KEY;

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn("VITE_SUPABASE_URL non défini, utilisation de la valeur de secours.");
}
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.warn("VITE_SUPABASE_PUBLISHABLE_KEY non défini, utilisation de la valeur de secours.");
}
