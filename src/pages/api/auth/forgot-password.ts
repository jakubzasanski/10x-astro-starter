import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const emailSchema = z.email();

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email");

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return context.redirect(`/auth/forgot-password?error=${encodeURIComponent("Enter a valid email address")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/forgot-password?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  // The recovery email links back here; the page mints the recovery session from the token_hash.
  const redirectTo = new URL("/auth/reset-password", context.url.origin).toString();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });

  // Only surface transport/config errors. "Email not found" is NOT distinguished by Supabase — the
  // confirmation is intentionally non-enumerating, so any non-error path lands on the same "sent" state.
  if (error) {
    return context.redirect(`/auth/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/auth/forgot-password?sent=1");
};
