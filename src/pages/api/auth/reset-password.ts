import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const MIN_PASSWORD_LENGTH = 6;

// Mirror the client-side ResetPasswordForm + minimum_password_length = 6: a min-length new password
// that matches its confirmation. The server is not the only layer trusting the client.
const resetSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
  });

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const parsed = resetSchema.safeParse({
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
  });

  if (!parsed.success) {
    const message = `Password must be at least ${MIN_PASSWORD_LENGTH} characters and match the confirmation`;
    return context.redirect(`/auth/reset-password?error=${encodeURIComponent(message)}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/reset-password?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  // The recovery session minted by the page's verifyOtp is read from cookies. If it expired (user took
  // too long), updateUser fails and we relay the error — the page then shows the expired state.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return context.redirect(`/auth/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  // Drop the recovery session so the user signs in fresh with the new password.
  await supabase.auth.signOut();
  return context.redirect("/auth/signin?reset=1");
};
