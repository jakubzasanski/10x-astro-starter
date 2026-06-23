import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n";

const PROTECTED_ROUTES = ["/dashboard", "/generate", "/review", "/cards"];

// Guest-only pages: a signed-in user has no reason to see the marketing landing or the
// auth entry points, so send them to the app. Reset-password and confirm-email are NOT
// listed — they are mid-flow pages reached while holding a recovery / just-signed-up session.
const GUEST_ONLY_ROUTES = ["/", "/auth/signin", "/auth/signup", "/auth/forgot-password"];

export const onRequest = defineMiddleware(async (context, next) => {
  // Resolve the UI locale once per request (cookie → Accept-Language → en),
  // so every page and `<html lang>` renders server-side with no flash.
  context.locals.locale = resolveLocale(
    context.cookies.get(LOCALE_COOKIE)?.value,
    context.request.headers.get("accept-language"),
  );

  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  // Keep signed-in users out of the guest-only pages — send them straight to the app.
  if (context.locals.user && GUEST_ONLY_ROUTES.includes(context.url.pathname)) {
    return context.redirect("/dashboard");
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
