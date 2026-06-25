// Single source of truth for the minimum password length policy. Mirrored (and drift-guarded)
// against `supabase/config.toml`'s `minimum_password_length` by `src/lib/constants.test.ts`.
export const MIN_PASSWORD_LENGTH = 8;
