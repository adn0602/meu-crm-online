import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mtepzyicszsizcezvihq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZXB6eWljc3pzaXpjZXp2aWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTEzNTEsImV4cCI6MjA3NTA4NzM1MX0.rrIBeO_ik8RmI-bmuwv9FAVGuxkntvMwW9YM4qvMS2s'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})