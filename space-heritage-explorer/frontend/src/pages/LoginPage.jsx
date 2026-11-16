// TEST-ONLY fake login. No backend calls. Replace with the real LoginPage.jsx after testing.
import { useState } from "react";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { AuthLayout, Field } from "../components/AuthLayout.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import { auth } from "../services/auth.js";

// Change these to match the roles your App expects.
const ROLES = ["user", "admin"];

export default function LoginPage({ onAuth, onSwitch }) {
  const [f, setF] = useState({ email: "test@example.com", password: "test1234", remember: false });
  const [role, setRole] = useState(ROLES[0]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const bind = (k) => ({
    value: f[k],
    error: "",
    onChange: (e) => {
      const value = e.target.value;
      setF((s) => ({ ...s, [k]: value }));
    },
    onBlur: () => {},
  });

  // Builds a fake session and hands it to App, same shape as the real flow.
  const fakeLogin = (email, remember) => {
    setBusy(true);
    setTimeout(() => {
      const data = {
        token: "fake-token-for-testing",
        user: {
          id: "fake-1",
          name: (email || "Test User").split("@")[0],
          email: email || "test@example.com",
          role,
        },
      };
      try {
        auth.save(data, remember); // so a page refresh keeps you logged in
      } catch {
        /* ignore if auth.save differs; App state still gets the user below */
      }
      onAuth(data.user, remember);
      setBusy(false);
    }, 400);
  };

  const submit = (e) => {
    e.preventDefault();
    fakeLogin(f.email, f.remember);
  };

  return (
    <AuthLayout
      variant="login"
      image="/moon.jpg"
      headline="Pick up where you left off."
      lead="Discover the untold story of NASA’s discarded equipment on the Moon and Mars."
    >
      <h2>Login</h2>
      <p className="pa-sub">Test mode: any credentials work.</p>

      <form onSubmit={submit} noValidate>
        <Field id="login-email" label="Email address" icon={Mail} type="email"
               autoComplete="email" placeholder="you@example.com" {...bind("email")} />
        <Field id="login-password" label="Password" icon={Lock} password
               autoComplete="current-password" placeholder="Enter your password" {...bind("password")} />

        <div className="pa-row">
          <label>
            <input
              type="checkbox"
              checked={f.remember}
              onChange={(e) => setF((s) => ({ ...s, remember: e.target.checked }))}
            />
            Remember me
          </label>
          <label>
            Role:{" "}
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>

        <button className="pa-btn" disabled={busy}>
          {busy ? "Signing in…" : "Login"} <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>

      <div className="pa-or"><span>or</span></div>

      <GoogleButton
        text="continue_with"
        disabled={busy}
        onCredential={() => fakeLogin("google.user@example.com", true)}
        onError={(er) => setStatus({ type: "error", text: er.message })}
      />

      <div className="pa-status-slot" role="status">
        {status && <p className={`pa-status ${status.type}`}>{status.text}</p>}
      </div>

      <p className="pa-switch">
        New here?{" "}
        <button type="button" className="pa-link" onClick={onSwitch}>Create an account</button>
      </p>
    </AuthLayout>
  );
}