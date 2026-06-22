declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    locale: import("@/i18n").Locale;
  }
}
