const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

export const AstronautIcon = ({ size = 46 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" {...base} aria-hidden="true">
    <circle cx="24" cy="20" r="13" />
    <rect x="15" y="14" width="18" height="12" rx="6" />
    <path d="M10 43c0-8 6-12 14-12s14 4 14 12" />
    <circle cx="10.5" cy="21" r="2" />
    <circle cx="37.5" cy="21" r="2" />
    <path d="M19 31v4M29 31v4" />
  </svg>
);

export const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="3" aria-hidden="true">
    <path d="M6.91 6.91A7.2 7.2 0 0 1 17.52 7.37" stroke="#EA4335" />
    <path d="M6.91 17.09A7.2 7.2 0 0 1 6.91 6.91" stroke="#FBBC05" />
    <path d="M17.09 17.09A7.2 7.2 0 0 1 6.91 17.09" stroke="#34A853" />
    <path d="M19.2 12A7.2 7.2 0 0 1 17.09 17.09M12 12h7.2" stroke="#4285F4" />
  </svg>
);

export const GithubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...base} aria-hidden="true">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export const MicrosoftIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2" y="2" width="9.5" height="9.5" fill="#F25022" />
    <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00" />
    <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF" />
    <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900" />
  </svg>
);

export const LogoBadge = () => <img className="logo" src="/logo.webp" alt="Space Heritage Explorer" />;