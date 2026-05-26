import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const SESSION_KEY = "hh_session_started";

/**
 * Safely read from sessionStorage — throws are silenced so that
 * private/incognito browsing modes do not break the app.
 */
function sessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safely write to sessionStorage — see above. */
function sessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private browsing — ignore */
  }
}

/**
 * ColdStartRedirect — on mobile cold start (fresh session),
 * redirects any non-root route back to Dashboard (/).
 *
 * Detection:
 *  - Cold start = sessionStorage has no `hh_session_started` flag.
 *  - Mobile = uses the same useIsMobile() hook as the sidebar.
 *
 * After the initial check, the flag is set so that subsequent
 * navigation (or React StrictMode re-renders) never redirect again.
 */
export function ColdStartRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    // If the session flag already exists, this is not a cold start
    if (sessionGet(SESSION_KEY)) return;

    // Mark the session as started immediately — this prevents
    // any infinite redirect loop even if React re-renders.
    sessionSet(SESSION_KEY, "true");

    // Only redirect on mobile and only if we are not already at root
    if (isMobile && location.pathname !== "/") {
      navigate("/", { replace: true });
    }
  }, [navigate, location, isMobile]);

  // This component renders nothing — it only performs side effects.
  return null;
}
