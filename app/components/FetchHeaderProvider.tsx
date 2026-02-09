"use client";

import { useEffect } from "react";

/**
 * Client-side provider that monkey-patches window.fetch to add
 * the `ngrok-skip-browser-warning` header to requests going to
 * the backend (localhost:8000 and ngrok domains).
 *
 * It runs once on the client and wraps the original fetch.
 */
export default function FetchHeaderProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const w = window as unknown as { fetch: typeof fetch };
    if (!w.fetch) return;

    const originalFetch = w.fetch.bind(window);

    const isBackendUrl = (urlStr: string) => {
      try {
        const u = new URL(urlStr, window.location.href);
        // backend on local dev port 8000
        if (u.hostname === 'localhost' && (u.port === '8000' || u.port === '')) return true;
        // common ngrok domains
        if (u.hostname.includes('ngrok') || u.hostname.endsWith('.ngrok-free.dev')) return true;
        // also accept explicit matching of port 8000 on other hosts
        if (u.port === '8000') return true;
        return false;
      } catch (e) {
        console.error(e);
        return false;
      }
    };

    function wrappedFetch(input: RequestInfo, init?: RequestInit) {
      try {
        let urlStr = '';
        if (typeof input === 'string') urlStr = input;
        else if (input instanceof Request) urlStr = input.url;

        if (urlStr && isBackendUrl(urlStr)) {
          const newInit: RequestInit = Object.assign({}, init);

          // Normalize headers into a Headers instance
          const headers = new Headers(newInit.headers || (input instanceof Request ? input.headers : undefined));

          // Set the ngrok skip header (value can be anything)
          headers.set('ngrok-skip-browser-warning', '1');

          newInit.headers = headers;

          return originalFetch(input, newInit);
        }

        return originalFetch(input, init);
      } catch (err) {
        console.error(err)
        return originalFetch(input, init);
      }
    }

    // Replace the global fetch
    (window as unknown as { fetch: typeof fetch }).fetch = wrappedFetch as unknown as typeof fetch;

    return () => {
      // restore original on unmount
      (window as unknown as { fetch: typeof fetch }).fetch = originalFetch as unknown as typeof fetch;
    };
  }, []);

  return null;
}
