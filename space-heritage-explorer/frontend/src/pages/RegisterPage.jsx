import { useState } from "react";
import { ArrowRight, Check, Circle, Lock } from "lucide-react";
import { AuthLayout, Field } from "../components/AuthLayout.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import { auth, readGoogleProfile } from "../services/auth.js";

const TYPES = [
  { value: "user", title: "Normal user", hint: "Explore missions and chat with the assistant." },
  { value: "admin", title: "Admin", hint: "Manage data sync and accounts. Approved emails only." },
];

export default function RegisterPage({ onAuth, onSwitch }) {
  // Step 1: Google gives us a verified name + email. Step 2: password.
  // Account type is chosen at the top and kept in `f.userType` the whole time.
  const [credential, setCredential] = useState(null);
  const [profile, setProfile] = useState({ name: "", email: "" });

  const [f, setF] = useState({ password: "", confirm: "", userType: "user" });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState(null); // { type: "error" | "ok", text }
  const [busy, setBusy] = useState(false);

  const rules = [
    { ok: f.password.length >= 8, text: "At least 8 characters" },
    { ok: /[a-z]/.test(f.password) && /[A-Z]/.test(f.password), text: "Upper and lower case letters" },
    { ok: /\d/.test(f.password), text: "A number" },
  ];

  const errors = {
    password: rules.every((r) => r.ok) ? "" : "Meet all the password requirements.",
    confirm: f.confirm && f.confirm === f.password ? "" : "The passwords don’t match.",
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

  const onGoogle = (cred) => {
    setCredential(cred);
    setProfile(readGoogleProfile(cred));
    setStatus(null);
  };

  const changeAccount = () => {
    setCredential(null);
    setProfile({ name: "", email: "" });
    setStatus(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    setStatus(null);
    try {
      const data = await auth.register(credential, f.password, f.userType);
      auth.save(data, true);
      setStatus({ type: "ok", text: "Account created. Launching…" });
      onAuth(data.user, true);
    } catch (er) {
      if (er.status === 401) {
        // Google credentials expire after about an hour
        changeAccount();
        setStatus({ type: "error", text: "Your Google verification expired. Verify again to continue." });
      } else {
        setStatus({ type: "error", text: er.message || "Something went wrong. Try again." });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      variant="register"
      image="/mars.jpg"
      headline="Help keep these missions remembered."
      lead="Create a free account to explore the equipment NASA left on the Moon and Mars."
    >
      <h2>Register</h2>
      <p className="pa-sub">
        {!credential
          ? "Choose your account type, then verify your name and email with Google."
          : "Almost done. Set a password to finish."}
      </p>

      {/* Account type: always visible */}
      <div className="pa-types" role="radiogroup" aria-label="Account type">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={f.userType === t.value}
            className={f.userType === t.value ? "on" : ""}
            disabled={busy}
            onClick={() => {
              setF((s) => ({ ...s, userType: t.value }));
              setStatus(null);
            }}
          >
            <strong>{t.title}</strong>
            <span>{t.hint}</span>
          </button>
        ))}
      </div>

      {!credential ? (
        <GoogleButton
          text="signup_with"
          onCredential={onGoogle}
          onError={(er) => setStatus({ type: "error", text: er.message })}
        />
      ) : (
        <>
          <div className="pa-profile">
            <div>
              <strong>{profile.name || "Google account"}</strong>
              <span>{profile.email}</span>
            </div>
            <button type="button" className="pa-link" onClick={changeAccount} disabled={busy}>
              Change
            </button>
          </div>

          <form onSubmit={submit} noValidate>
            <Field id="reg-password" label="Password" icon={Lock} password autoComplete="new-password"
                   placeholder="Create a password" {...bind("password")} />

            {f.password && (
              <ul className="pa-rules" aria-label="Password requirements">
                {rules.map((r) => (
                  <li key={r.text} className={r.ok ? "ok" : ""}>
                    {r.ok ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
                    {r.text}
                  </li>
                ))}
              </ul>
            )}

            <Field id="reg-confirm" label="Confirm password" icon={Lock} password autoComplete="new-password"
                   placeholder="Re-enter your password" {...bind("confirm")} />

            <button className="pa-btn" disabled={busy}>
              {busy ? "Creating…" : "Create account"} <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
        </>
      )}

      <div className="pa-status-slot" role="status">
        {status && <p className={`pa-status ${status.type}`}>{status.text}</p>}
      </div>

      <p className="pa-switch">
        Already have an account?{" "}
        <button type="button" className="pa-link" onClick={onSwitch}>Login</button>
      </p>
    </AuthLayout>
  );
}