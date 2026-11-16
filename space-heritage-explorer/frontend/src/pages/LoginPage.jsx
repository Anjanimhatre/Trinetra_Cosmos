import { useState } from "react";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { AuthLayout, Field } from "../components/AuthLayout.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import { auth } from "../services/auth.js";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function LoginPage({ onAuth, onSwitch }) {
  const [f, setF] = useState({ email: "", password: "", remember: false });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState(null); // { type: "error" | "info", text }
  const [busy, setBusy] = useState(false);

  const errors = {
    email: EMAIL_RE.test(f.email) ? "" : "Enter a valid email address.",
    password: f.password ? "" : "Enter your password.",
  };
  const shown = (k) => (touched[k] || submitted ? errors[k] : "");

  const bind = (k) => ({
    value: f[k],
    error: shown(k),
    onChange: (e) => {
      const value = e.target.value;
      setF((s) => ({ ...s, [k]: value }));
      setStatus(null);
    },
    onBlur: () => setTouched((t) => ({ ...t, [k]: true })),
  });

  // Saves the token, then hands the user (with role) to App.
  const finish = (data, remember) => {
    auth.save(data, remember);
    onAuth(data.user, remember);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (errors.email || errors.password) return;
    setBusy(true);
    setStatus(null);
    try {
      finish(await auth.login(f.email, f.password), f.remember);
    } catch (er) {
      setStatus({ type: "error", text: er.message });
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async (credential) => {
    setBusy(true);
    setStatus(null);
    try {
      finish(await auth.loginGoogle(credential), true);
    } catch (er) {
      setStatus({
        type: "error",
        text: er.status === 404 ? "No account found for this Google account. Register first." : er.message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      variant="login"
      image="/moon.jpg"
      headline="Pick up where you left off."
      lead="Discover the untold story of NASA’s discarded equipment on the Moon and Mars."
    >
      <h2>Login</h2>
      <p className="pa-sub">Continue your journey.</p>

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
          <button
            type="button"
            className="pa-link"
            onClick={() => setStatus({ type: "info", text: "Password reset is coming soon." })}
          >
            Forgot password?
          </button>
        </div>

        <button className="pa-btn" disabled={busy}>
          {busy ? "Signing in…" : "Login"} <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>

      <div className="pa-or"><span>or</span></div>

      <GoogleButton
        text="continue_with"
        disabled={busy}
        onCredential={onGoogle}
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

