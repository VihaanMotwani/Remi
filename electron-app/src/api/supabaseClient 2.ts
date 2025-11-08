import { createClient } from '@supabase/supabase-js';

// It's best practice to keep keys in environment variables
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase URL or anon key in environment variables");
}

// Create a single Supabase client instance
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
