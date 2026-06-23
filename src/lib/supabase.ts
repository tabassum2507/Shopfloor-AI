import { createBrowserClient } from '@supabase/ssr'

// ── Browser client ────────────────────────────────────────────
// Import this in Client Components only.
// @supabase/ssr stores the session in cookies (not localStorage) so the
// same session is visible to the server-side middleware on every request.

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
