import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://ityuheysxkyedtvvzgmq.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0eXVoZXlzeGt5ZWR0dnZ6Z21xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMzk3ODAsImV4cCI6MjEwNTcxNTc4MH0.HCxIWA4SB6AzsXrVSs-bURLv8S49xEz2XifXGXJxIuk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
