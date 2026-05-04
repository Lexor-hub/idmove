import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jmxckbbunoyrsxkaubmi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpteGNrYmJ1bm95cnN4a2F1Ym1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MDcyMDksImV4cCI6MjA5MzE4MzIwOX0.52m2GgS1dqV_7896DgvPCI6Yr-yBjroobs7RLSEb-Jw';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const isSupabaseConfigured = () => true;

export const requireSupabaseConfig = () => {
  // Always configured — fallback values ensure connectivity
};
