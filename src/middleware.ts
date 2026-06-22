import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n";

const PROTECTED_ROUTES = ["/dashboard", "/generate", "/review", "/cards"];

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

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
