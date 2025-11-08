import { createClient } from '@supabase/supabase-js';

// It's best practice to keep keys in environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or anon key in environment variables");
}

// Create a single Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseKey);
