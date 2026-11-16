
import { api, tokenStore } from "./api.js";

export const auth = {
  // Google credential + password + "user" | "admin". Name and email come from the Google account.
  register: (credential, password, userType) =>
    api("/api/auth/register", { method: "POST", auth: false, body: { credential, password, user_type: userType } }),

  loginGoogle: (credential) =>
    api("/api/auth/google", { method: "POST", auth: false, body: { credential } }),

  login: (email, password) =>
    api("/api/auth/login", { method: "POST", auth: false, body: { email: email.trim(), password } }),

  me: () => api("/api/auth/me"),

  // Call with the response of register/login/loginGoogle: { access_token, user }
  save: (data, remember) => tokenStore.set(data.access_token, remember),
  logout: () => tokenStore.clear(),
  hasToken: () => Boolean(tokenStore.get()),
};

// Reads name/email out of a Google credential for DISPLAY only.
// The server verifies the credential itself, so never trust this for security decisions.
export function readGoogleProfile(credential) {
  try {
    const b64 = credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    return { name: p.name || "", email: p.email || "" };
  } catch {
    return { name: "", email: "" };
  }
}





