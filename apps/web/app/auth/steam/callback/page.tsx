"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Partner OAuth returns `access_token` in the URL **fragment** (hash), which never reaches the server.
 * This page reads the fragment and POSTs the token to `/api/auth/steam/complete`.
 *
 * @see https://partner.steamgames.com/doc/webapi_overview/oauth
 */
export default function SteamPartnerOAuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing Steam sign-in…");

  useEffect(() => {
    const run = async () => {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("code")) {
        setMessage(
          "Authorization code is in the query string, but Valve does not document the token exchange URL in the public OAuth overview. Use implicit flow (default: STEAM_OAUTH_RESPONSE_TYPE unset or `token`) unless Valve gave you a code-exchange endpoint.",
        );
        return;
      }

      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const fromHash = new URLSearchParams(hash);

      const error = fromHash.get("error");
      const errorDescription = fromHash.get("error_description");
      if (error) {
        setMessage(error === "access_denied" ? "Sign-in cancelled." : (errorDescription ?? error));
        return;
      }

      const access_token = fromHash.get("access_token");
      const state = fromHash.get("state");
      if (!access_token || !state) {
        setMessage("Missing token or state. Open sign-in from this site again.");
        return;
      }

      const res = await fetch("/api/auth/steam/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token, state }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        redirect?: string;
      };

      if (!res.ok) {
        setMessage(data.error ?? `Sign-in failed (${res.status})`);
        return;
      }

      const next =
        typeof data.redirect === "string" && data.redirect.startsWith("/") && !data.redirect.startsWith("//")
          ? data.redirect
          : "/";

      window.history.replaceState(null, "", window.location.pathname);
      router.replace(next);
    };

    void run();
  }, [router]);

  return (
    <main className="steam-main steam-narrow">
      <p className="steam-muted">{message}</p>
    </main>
  );
}
