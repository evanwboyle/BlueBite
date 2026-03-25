import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — realtime will not work');
} else {
  console.log('[Supabase] Client initialized with URL:', supabaseUrl);
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
);
