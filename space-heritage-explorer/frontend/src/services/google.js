/* Google sign-in helper (needs the Google script in index.html and
   VITE_GOOGLE_CLIENT_ID in frontend/.env).
   Resolves with { name, email, picture } or rejects with a readable Error.

   NOTE: this only reads the profile in the browser. Before going live,
   send the token to your backend and verify it there. */
export function googleSignIn() {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return reject(new Error("Add VITE_GOOGLE_CLIENT_ID to frontend/.env first."));
    if (!window.google?.accounts?.oauth2) return reject(new Error("Google is still loading. Try again."));

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: async (resp) => {
        try {
          if (resp.error) throw new Error("Google sign-in was cancelled.");
          const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${resp.access_token}` },
          });
          if (!r.ok) throw new Error("Could not read your Google profile.");
          const p = await r.json();
          resolve({ name: p.name, email: p.email, picture: p.picture });
        } catch (er) {
          reject(er);
        }
      },
      error_callback: () => reject(new Error("Google sign-in was closed.")),
    });
    client.requestAccessToken();
  });
}