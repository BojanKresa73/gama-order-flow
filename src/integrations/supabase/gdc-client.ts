// Read-only Supabase client for the GDC Order project.
// Used by the Quick Price Calculator to fetch live material/kasiranje prices.
// The URL + anon (publishable) key are public and safe to ship in the browser bundle;
// RLS on the GDC project protects the data.

import { createClient } from "@supabase/supabase-js";

const GDC_SUPABASE_URL = "https://xnoqixdpzvcpomeeqhus.supabase.co";
const GDC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhub3FpeGRwenZjcG9tZWVxaHVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODYyMDEsImV4cCI6MjA4MDg2MjIwMX0.KBNsCL6eW-5-ZUwKF_EsFKdmtwPxGNLZAuMZKLZwEHg";

export const supabaseGDC = createClient(GDC_SUPABASE_URL, GDC_SUPABASE_ANON_KEY, {
  auth: {
    // We don't authenticate against GDC — never persist any session.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: "gdc-order-readonly-noauth",
  },
});
