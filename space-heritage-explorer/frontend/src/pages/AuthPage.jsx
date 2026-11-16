import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Microscope,
  Rocket,
  ShieldCheck,
  User,
  UserPlus,
  UserRound,
} from "lucide-react";
import Backdrop from "../components/Backdrop.jsx";
import Stars from "../components/Stars.jsx";
import { LogoBadge } from "../components/Icons.jsx";
import { auth } from "../services/auth.js";

/* ---------- Data ---------- */
const FEATURES = [
  { icon: BookOpen,    title: "Real Mission Stories",   text: "Learn about NASA’s historic missions" },
  { icon: Microscope,  title: "Science Discoveries",    text: "Explore the knowledge they brought" },
  { icon: Rocket,      title: "Interactive Experience", text: "Dive into the space journey" },
  { icon: ShieldCheck, title: "A Legacy That Lives On", text: "Be inspired by their courage" },
];

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0-4
}

/* ---------- Small pieces ---------- */
function Field({ icon: Icon, password, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="ap-field">
      <Icon size={18} className="ap-ico" aria-hidden="true" />
      <input
        {...props}
        aria-label={props.placeholder}
        type={password ? (show ? "text" : "password") : props.type || "text"}
      />
      {password && (
        <button
          type="button"
          className="ap-eye"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      )}
    </div>
  );
}

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

/* ---------- Login card ---------- */
function LoginCard({ onAuth }) {
  const [f, setF] = useState({ email: "", password: "", remember: false });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const change = (key) => (e) => {
    const value = e.target.value;
    setF((s) => ({ ...s, [key]: value }));
    setMsg("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(f.email)) return setMsg("Enter a valid email address.");
    if (!f.password) return setMsg("Enter your password.");
    setBusy(true);
    setMsg("");
    try {
      onAuth(await auth.login(f.email, f.password), f.remember);
    } catch (er) {
      setMsg(er.message);
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return setMsg("Add VITE_GOOGLE_CLIENT_ID to frontend/.env first.");
    if (!window.google?.accounts?.oauth2) return setMsg("Google is still loading. Try again.");
    setBusy(true);
    setMsg("");

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
          onAuth({ name: p.name, email: p.email, picture: p.picture }, true);
        } catch (er) {
          setMsg(er.message);
        } finally {
          setBusy(false);
        }
      },
      error_callback: () => {
        setBusy(false);
        setMsg("Google sign-in was closed.");
      },
    });
    client.requestAccessToken();
  };

  return (
    <section className="ap-card ap-blue" aria-labelledby="login-h">
      <div className="ap-head">
        <UserRound size={46} strokeWidth={1.5} className="ap-headico" aria-hidden="true" />
        <div>
          <h2 id="login-h">Login</h2>
          <p>Continue your journey</p>
        </div>
      </div>

      <form onSubmit={submit} noValidate>
        <Field
          icon={Mail}
          id="login-email"
          type="email"
          placeholder="Email Address"
          autoComplete="email"
          value={f.email}
          onChange={change("email")}
        />
        <Field
          icon={Lock}
          password
          placeholder="Password"
          autoComplete="current-password"
          value={f.password}
          onChange={change("password")}
        />

        <div className="ap-row">
          <label>
            <input
              type="checkbox"
              checked={f.remember}
              onChange={(e) => setF((s) => ({ ...s, remember: e.target.checked }))}
            />
            Remember Me
          </label>
          <a
            href="#forgot"
            onClick={(e) => {
              e.preventDefault();
              setMsg("Password reset is coming soon.");
            }}
          >
            Forgot Password?
          </a>
        </div>

        <button className="ap-btn ap-btn-blue" disabled={busy}>
          <Rocket size={18} aria-hidden="true" /> {busy ? "Signing in…" : "Login"}{" "}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>

      <div className="ap-or"><span>OR</span></div>
      <button type="button" className="ap-google" onClick={googleLogin} disabled={busy}>
        <GoogleIcon /> Continue with Google
      </button>

      <p className="ap-msg" role="status">{msg}</p>
    </section>
  );
}

/* ---------- Register card ---------- */
function RegisterCard({ onAuth }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((s) => ({ ...s, [key]: value }));
    if (msg) setMsg(null);
  };

  const score = useMemo(() => strength(form.password), [form.password]);

  const submit = async (e) => {
    e.preventDefault();
    const { name, email, password, confirm } = form;
    if (name.trim().length < 2) return setMsg({ err: "Enter your full name." });
    if (!EMAIL_RE.test(email)) return setMsg({ err: "Enter a valid email address." });
    if (password.length < 8) return setMsg({ err: "Use a password with at least 8 characters." });
    if (password !== confirm) return setMsg({ err: "The passwords don’t match." });

    setBusy(true);
    setMsg(null);
    try {
      const user = await auth.register(name.trim(), email.trim(), password);
      setMsg({ ok: "Account created! Launching…" });
      onAuth(user, true);
    } catch (er) {
      setMsg({ err: er.message || "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ap-card ap-orange" aria-labelledby="register-h">
      <div className="ap-head">
        <UserPlus size={46} strokeWidth={1.5} className="ap-headico" aria-hidden="true" />
        <div>
          <h2 id="register-h">Register</h2>
          <p>Create your account</p>
        </div>
      </div>

      <form onSubmit={submit} noValidate>
        <Field icon={User} name="name" placeholder="Full Name" autoComplete="name"
               value={form.name} onChange={set("name")} />
        <Field icon={Mail} type="email" name="email" placeholder="Email Address" autoComplete="email"
               value={form.email} onChange={set("email")} />
        <Field icon={Lock} password name="password" placeholder="Password" autoComplete="new-password"
               value={form.password} onChange={set("password")} />

        {form.password && (
          <div className="ap-meter" aria-live="polite">
            <div className="ap-bars">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={i <= score ? `on s${score}` : ""} />
              ))}
            </div>
            <small>{STRENGTH_LABELS[score]}</small>
          </div>
        )}

        <Field icon={Lock} password name="confirm" placeholder="Confirm Password" autoComplete="new-password"
               value={form.confirm} onChange={set("confirm")} />

        <button className="ap-btn ap-btn-orange" disabled={busy}>
          <UserPlus size={18} aria-hidden="true" /> {busy ? "Creating…" : "Register"}{" "}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>

      <p className="ap-foot">
        Already have an account?{" "}
        <a
          href="#login"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("login-email")?.focus();
          }}
        >
          Login
        </a>
      </p>

      <p className={"ap-msg" + (msg?.ok ? " ok" : "")} role="status">
        {msg?.err || msg?.ok}
      </p>
    </section>
  );
}

/* ---------- Page ---------- */
export default function AuthPage({ onAuth }) {
  return (
    <div className="stage">
      <Backdrop />
      <Stars count={45} />

      <div className="ap-content">
        <header className="brand">
          <LogoBadge />
          <h1>
            Abandoned <em>But Not</em> <span className="hot">Forgotten</span>
          </h1>
          <div className="tag">Explore. Remember. Learn.</div>
          <p className="sub">
            Discover the untold story of NASA’s discarded equipment on the Moon and Mars
          </p>
        </header>

        <main className="ap-cards">
          <LoginCard onAuth={onAuth} />
          <RegisterCard onAuth={onAuth} />
        </main>

        {/* Feature strip: pinned to the bottom by margin-top:auto in auth.css */}
        <ul className="ap-features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            </li>
          ))}
        </ul>

        <footer className="ap-footer">Space Heritage Explorer · Forever Exploring</footer>
      </div>
    </div>
  );
}