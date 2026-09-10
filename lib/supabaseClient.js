import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,        // guarda la sesión en localStorage
    autoRefreshToken: true,      // renueva el token automáticamente antes de expirar
    detectSessionInUrl: true,
  },
});
