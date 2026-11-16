import { useState } from "react";
import { BookOpen, Eye, EyeOff, Microscope, Rocket } from "lucide-react";
import { LogoBadge } from "./Icons.jsx";
import "../pro-auth.css";

const POINTS = [
  { icon: BookOpen,   title: "Real mission stories", text: "Learn about NASA’s historic missions" },
  { icon: Microscope, title: "Science discoveries",  text: "Explore the knowledge they brought" },
  { icon: Rocket,     title: "Interactive journey",  text: "Dive into the space journey" },
];

/* Split screen: image + story on the left, form on the right.
   variant: "login" (blue) or "register" (orange) */
export function AuthLayout({ variant, image, headline, lead, children }) {
  return (
    <div className={`pa pa-${variant}`}>
      <aside className="pa-hero" style={{ backgroundImage: `url(${image})` }}>
        <div className="pa-brand">
          <LogoBadge />
          <span>Abandoned But Not Forgotten</span>
        </div>

        <div className="pa-pitch">
          <h1>{headline}</h1>
          <p className="pa-lead">{lead}</p>
        </div>

        <div>
          <ul className="pa-points">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon size={22} aria-hidden="true" />
                <strong>{title}</strong>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <p className="pa-fine">Unofficial fan project. Not affiliated with or endorsed by NASA.</p>
        </div>
      </aside>

      <main className="pa-panel">
        <div className="pa-form-wrap">{children}</div>
      </main>
    </div>
  );
}

/* Labelled input with icon, optional show/hide for passwords, inline error */
export function Field({ id, label, icon: Icon, password, error, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className={"pa-field" + (error ? " has-error" : "")}>
      <label htmlFor={id}>{label}</label>
      <div className="pa-input">
        <Icon size={18} aria-hidden="true" />
        <input
          id={id}
          {...props}
          type={password ? (show ? "text" : "password") : props.type || "text"}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        {password && (
          <button
            type="button"
            className="pa-eye"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        )}
      </div>
      {error && <p className="pa-err" id={`${id}-err`}>{error}</p>}
    </div>
  );
}

export const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);