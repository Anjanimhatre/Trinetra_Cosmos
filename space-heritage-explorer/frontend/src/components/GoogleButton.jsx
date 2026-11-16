import { useEffect, useRef } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
let scriptPromise = null;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("Couldn’t load Google sign-in. Check your connection."));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Google’s own button. When the person picks an account, onCredential(idToken) is called.
 * text: "continue_with" | "signup_with" | "signin_with"
 */
export default function GoogleButton({ onCredential, onError, text = "continue_with", disabled = false }) {
  const holder = useRef(null);
  const onCred = useRef(onCredential);
  const onErr = useRef(onError);
  onCred.current = onCredential;
  onErr.current = onError;

  useEffect(() => {
    let cancelled = false;
    if (!CLIENT_ID) {
      onErr.current?.(new Error("Google sign-in isn’t configured. Set VITE_GOOGLE_CLIENT_ID."));
      return undefined;
    }
    loadGoogleScript()
      .then(() => {
        if (cancelled || !holder.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => onCred.current?.(response.credential),
        });
        const width = Math.min(400, Math.max(240, holder.current.offsetWidth || 320));
        window.google.accounts.id.renderButton(holder.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text,
          width,
        });
      })
      .catch((e) => onErr.current?.(e));
    return () => {
      cancelled = true;
    };
  }, [text]);

  return (
    <div
      ref={holder}
      className="pa-gbtn"
      style={{ opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? "none" : "auto" }}
    />
  );
}