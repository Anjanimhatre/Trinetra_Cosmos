import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Database, Download, LayoutDashboard, LogOut, RefreshCw,
  Search, ShieldCheck, ShieldOff, Trash2, UserPlus, Users, X,
} from "lucide-react";
import { api } from "../services/api.js";
import "./AdminHome.css";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const DAY = 86_400_000;
const fmt = (v) => (v ? new Date(v).toLocaleString() : "—");
const fmtDay = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

/* Endpoints the backend may not have yet. A 404/405 becomes a clear message
   instead of a crash, so every other part of the page keeps working. */
async function call(path, opts) {
  try {
    return await api(path, opts);
  } catch (e) {
    if (e.status === 404 || e.status === 405) {
      const m = new Error(`The backend has no endpoint for ${opts?.method || "GET"} ${path} yet.`);
      m.missing = true;
      throw m;
    }
    throw e;
  }
}

const ACTIONS = {
  registered:   { label: "Registered themselves",  tone: "ok" },
  user_created: { label: "Created by an admin",    tone: "info" },
  deleted_self: { label: "Deleted own account",    tone: "warn" },
  user_deleted: { label: "Deleted by an admin",    tone: "danger" },
  role_changed: { label: "Role changed",           tone: "info" },
  login:        { label: "Signed in",              tone: "muted" },
  sync_started: { label: "Sync started",           tone: "muted" },
};

function downloadCsv(rows) {
  const head = ["name", "email", "role", "joined"];
  const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((u) => [u.name, u.email, u.role, u.created_at].map(esc).join(","));
  const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */
function Stat({ label, value, hint }) {
  return (
    <div className="ad-stat">
      <span className="ad-stat-num">{value ?? "—"}</span>
      <span className="ad-stat-label">{label}</span>
      {hint && <span className="ad-stat-hint">{hint}</span>}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="ad-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ad-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ad-modal-head">
          <h2>{title}</h2>
          <button type="button" className="ad-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* Asks the admin to type a word before a destructive action runs. */
function ConfirmDelete({ title, body, word, onConfirm, onClose }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = typed.trim().toLowerCase() === word.toLowerCase();
  return (
    <Modal title={title} onClose={onClose}>
      <p className="ad-modal-text">{body}</p>
      <label className="ad-label" htmlFor="ad-confirm">Type <strong>{word}</strong> to confirm</label>
      <input id="ad-confirm" className="ad-input" value={typed} autoFocus
             onChange={(e) => setTyped(e.target.value)} />
      <div className="ad-modal-actions">
        <button type="button" className="ad-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="ad-danger" disabled={!ok || busy}
                onClick={async () => { setBusy(true); await onConfirm(); }}>
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

function CreateUser({ onCreate, onClose }) {
  const [f, setF] = useState({ name: "", email: "", password: "", role: "user" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) return setErr("Enter a name and a valid email.");
    if (f.password.length < 8) return setErr("The password needs at least 8 characters.");
    setBusy(true);
    setErr("");
    try {
      await onCreate({ ...f, name: f.name.trim(), email: f.email.trim() });
    } catch (er) {
      setErr(er.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Create account" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <label className="ad-label" htmlFor="cu-name">Full name</label>
        <input id="cu-name" className="ad-input" value={f.name} onChange={set("name")} autoFocus />
        <label className="ad-label" htmlFor="cu-email">Email</label>
        <input id="cu-email" type="email" className="ad-input" value={f.email} onChange={set("email")} />
        <label className="ad-label" htmlFor="cu-pass">Temporary password</label>
        <input id="cu-pass" type="text" className="ad-input" value={f.password}
               onChange={set("password")} autoComplete="off" />
        <label className="ad-label" htmlFor="cu-role">Account type</label>
        <select id="cu-role" className="ad-input" value={f.role} onChange={set("role")}>
          <option value="user">Normal user</option>
          <option value="admin">Admin</option>
        </select>
        {err && <p className="ad-alert error" role="alert">{err}</p>}
        <div className="ad-modal-actions">
          <button type="button" className="ad-ghost" onClick={onClose}>Cancel</button>
          <button className="ad-primary" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function AdminHomePage({ user, onLogout }) {
  const [tab, setTab] = useState("overview"); // overview | accounts | activity | sync
  const [health, setHealth] = useState(null);
  const [runs, setRuns] = useState([]);
  const [schedule, setSchedule] = useState("");
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);     // server totals (optional endpoint)
  const [audit, setAudit] = useState(null);     // null = not loaded / not available
  const [missing, setMissing] = useState({});   // which optional endpoints are absent
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const syncBaseline = useRef({ id: 0, polls: 0 });

  // Accounts tab
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [picked, setPicked] = useState(() => new Set());
  const [dialog, setDialog] = useState(null); // { type: "create" } | { type: "delete", ids: [] }

  // Activity tab
  const [auditFilter, setAuditFilter] = useState("all");

  /* ---------- loaders ---------- */
  const loadHealth = useCallback(
    () => api("/api/nasa-rag/health", { auth: false }).then(setHealth).catch((e) => setError(e.message)),
    [],
  );
  const loadRuns = useCallback(
    () => api("/api/nasa-rag/sync/status").then((d) => {
      setRuns(d.runs);
      setSchedule(d.schedule);
      return d.runs;
    }),
    [],
  );
  const loadUsers = useCallback(
    () => api("/api/auth/users").then((d) => setUsers(d.users)),
    [],
  );
  const loadOptional = useCallback(async () => {
    const [s, a] = await Promise.allSettled([
      call("/api/admin/stats"),
      call("/api/admin/audit?limit=200"),
    ]);
    setStats(s.status === "fulfilled" ? s.value : null);
    setAudit(a.status === "fulfilled" ? a.value.events || a.value : null);
    setMissing({
      stats: s.status === "rejected" && s.reason.missing,
      audit: a.status === "rejected" && a.reason.missing,
    });
  }, []);

  useEffect(() => {
    Promise.all([loadHealth(), loadRuns(), loadUsers(), loadOptional()])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [loadHealth, loadRuns, loadUsers, loadOptional]);

  // While a sync is running, check its status every 3 seconds.
  useEffect(() => {
    if (!syncing) return undefined;
    const timer = setInterval(async () => {
      try {
        const latest = (await loadRuns())[0];
        const base = syncBaseline.current;
        base.polls += 1;
        const isNew = latest && latest.id > base.id;
        if (isNew && latest.status !== "running") {
          setSyncing(false);
          setNotice(latest.message || `Sync ${latest.status}.`);
          loadHealth();
        } else if (!isNew && base.polls > 20) {
          setSyncing(false);
          setNotice("No new sync was recorded. Another sync may already be running.");
        }
      } catch (e) {
        setSyncing(false);
        setError(e.message);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [syncing, loadRuns, loadHealth]);

  // Notices fade after a few seconds.
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const refreshAll = async () => {
    setError("");
    try {
      await Promise.all([loadHealth(), loadRuns(), loadUsers(), loadOptional()]);
      setNotice("Refreshed.");
    } catch (e) {
      setError(e.message);
    }
  };

  /* ---------- actions ---------- */
  const afterChange = async (msg) => {
    setNotice(msg);
    setPicked(new Set());
    await Promise.all([loadUsers(), loadOptional()]);
  };

  const createUser = async (body) => {
    await call("/api/admin/users", { method: "POST", body });
    setDialog(null);
    await afterChange(`Created ${body.email}.`);
  };

  const changeRole = async (u) => {
    const role = u.role === "admin" ? "user" : "admin";
    setError("");
    try {
      await call(`/api/admin/users/${u.id}`, { method: "PATCH", body: { role } });
      await afterChange(`${u.email} is now ${role === "admin" ? "an admin" : "a normal user"}.`);
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteUsers = async (ids) => {
    setError("");
    try {
      for (const id of ids) await call(`/api/admin/users/${id}`, { method: "DELETE" });
      setDialog(null);
      await afterChange(ids.length === 1 ? "Account deleted." : `${ids.length} accounts deleted.`);
    } catch (e) {
      setDialog(null);
      setError(e.message);
      await loadUsers();
    }
  };

  const startSync = async () => {
    setError("");
    setNotice("");
    try {
      syncBaseline.current = { id: runs[0]?.id ?? 0, polls: 0 };
      await api("/api/nasa-rag/sync", { method: "POST" });
      setSyncing(true);
    } catch (e) {
      setError(e.status === 429 ? "Sync limit reached (3 per hour). Try again later." : e.message);
    }
  };

  /* ---------- derived data ---------- */
  const now = Date.now();
  const admins = users.filter((u) => u.role === "admin").length;
  const joinedWithin = (days) => users.filter((u) => now - new Date(u.created_at) < days * DAY).length;

  // Counts by action, from the audit log (or the server's stats if it provides them)
  const byAction = useMemo(() => {
    const c = {};
    (audit || []).forEach((e) => { c[e.action] = (c[e.action] || 0) + 1; });
    return c;
  }, [audit]);
  const count = (key) => stats?.[key] ?? (audit ? byAction[key] || 0 : null);

  // Sign-ups per day for the last 14 days
  const signups = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
      return { date: d, n: 0 };
    });
    users.forEach((u) => {
      const d = new Date(u.created_at); d.setHours(0, 0, 0, 0);
      const slot = days.find((x) => x.date.getTime() === d.getTime());
      if (slot) slot.n += 1;
    });
    return days;
  }, [users]);
  const maxSignup = Math.max(1, ...signups.map((d) => d.n));

  const shownUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = users.filter((u) =>
      (roleFilter === "all" || u.role === roleFilter) &&
      (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)));
    const by = {
      newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      name:   (a, b) => (a.name || "").localeCompare(b.name || ""),
    }[sort];
    list = [...list].sort(by);
    return list;
  }, [users, query, roleFilter, sort]);

  const selectable = shownUsers.filter((u) => u.id !== user.id);
  const allPicked = selectable.length > 0 && selectable.every((u) => picked.has(u.id));
  const togglePick = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePickAll = () => setPicked(allPicked ? new Set() : new Set(selectable.map((u) => u.id)));

  const shownAudit = (audit || []).filter((e) => auditFilter === "all" || e.action === auditFilter);
  const orgs = Object.entries(health?.by_organisation || {});
  const maxOrg = Math.max(1, ...orgs.map(([, n]) => n));
  const lastOk = runs.find((r) => r.status === "ok");
  const busyNow = syncing || runs[0]?.status === "running";

  const deleteTargets = dialog?.type === "delete" ? users.filter((u) => dialog.ids.includes(u.id)) : [];

  const TABS = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "accounts", label: "Accounts", icon: Users },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "sync",     label: "Data sync", icon: Database },
  ];

  /* ---------- render ---------- */
  return (
    <div className="ad-page">
      <header className="ad-top">
        <div>
          <h1>Admin console</h1>
          <p>Signed in as {user.name} ({user.email})</p>
        </div>
        <div className="ad-top-actions">
          <button type="button" className="ad-ghost" onClick={refreshAll}><RefreshCw size={16} /> Refresh</button>
          <button type="button" className="ad-ghost" onClick={onLogout}><LogOut size={16} /> Log out</button>
        </div>
      </header>

      <nav className="ad-tabs" role="tablist" aria-label="Admin sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
                  className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      {error && <p className="ad-alert error" role="alert">{error}</p>}
      {notice && <p className="ad-alert info" role="status">{notice}</p>}
      {loading && <p className="ad-summary">Loading…</p>}

      {/* ============ OVERVIEW ============ */}
      {tab === "overview" && !loading && (
        <>
          <section className="ad-stats">
            <Stat label="Accounts" value={users.length} hint={`${admins} admin, ${users.length - admins} normal`} />
            <Stat label="Joined in 7 days" value={joinedWithin(7)} hint={`${joinedWithin(30)} in 30 days`} />
            <Stat label="Signed up by themselves" value={count("registered")} />
            <Stat label="Created by an admin" value={count("user_created")} />
            <Stat label="Deleted by the user" value={count("deleted_self")} />
            <Stat label="Deleted by an admin" value={count("user_deleted")} />
          </section>
          {(missing.stats && missing.audit) && (
            <p className="ad-alert info">
              The last four numbers need the audit endpoints described in the setup notes. Until the backend has
              them they show a dash.
            </p>
          )}

          <section className="ad-grid">
            <div className="ad-panel">
              <h2>Sign-ups, last 14 days</h2>
              <div className="ad-chart" role="img"
                   aria-label={`Sign-ups per day, highest ${maxSignup}`}>
                {signups.map((d) => (
                  <div key={d.date.getTime()} className="ad-col" title={`${fmtDay(d.date)}: ${d.n}`}>
                    <span className="ad-col-n">{d.n || ""}</span>
                    <span className="ad-col-bar" style={{ height: `${(d.n / maxSignup) * 100}%` }} />
                    <span className="ad-col-d">{d.date.getDate()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ad-panel">
              <h2>Indexed sources</h2>
              {orgs.length === 0 ? (
                <p className="ad-empty">Nothing is indexed yet. Open Data sync and run a sync.</p>
              ) : (
                <ul className="ad-bars">
                  {orgs.map(([name, n]) => (
                    <li key={name}>
                      <span className="ad-bar-label">{name}</span>
                      <span className="ad-bar-track"><span className="ad-bar-fill" style={{ width: `${(n / maxOrg) * 100}%` }} /></span>
                      <span className="ad-bar-num">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="ad-meta">
                {health?.indexed_chunks ?? 0} chunks.{" "}
                {lastOk ? `Last successful sync ${fmt(lastOk.finished_at)}.` : "No successful sync yet."}
              </p>
            </div>
          </section>

          <section className="ad-panel">
            <h2>Newest accounts</h2>
            <ul className="ad-recent">
              {[...users].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5).map((u) => (
                <li key={u.id}>
                  <span><strong>{u.name}</strong> <span className="ad-meta">{u.email}</span></span>
                  <span className={`ad-pill ${u.role}`}>{u.role === "admin" ? "Admin" : "Normal user"}</span>
                  <span className="ad-meta">{fmt(u.created_at)}</span>
                </li>
              ))}
              {users.length === 0 && <li className="ad-empty">No accounts yet.</li>}
            </ul>
          </section>
        </>
      )}

      {/* ============ ACCOUNTS ============ */}
      {tab === "accounts" && !loading && (
        <section className="ad-panel">
          <div className="ad-toolbar">
            <div className="ad-search">
              <Search size={16} aria-hidden="true" />
              <input type="search" placeholder="Search by name or email" aria-label="Search accounts"
                     value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="ad-input ad-select" aria-label="Filter by type" value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All types</option>
              <option value="user">Normal users</option>
              <option value="admin">Admins</option>
            </select>
            <select className="ad-input ad-select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A to Z</option>
            </select>
            <button type="button" className="ad-ghost" onClick={() => downloadCsv(shownUsers)}>
              <Download size={16} /> Export CSV
            </button>
            <button type="button" className="ad-primary" onClick={() => setDialog({ type: "create" })}>
              <UserPlus size={16} /> Create account
            </button>
          </div>

          {picked.size > 0 && (
            <div className="ad-bulk" role="status">
              <span>{picked.size} selected</span>
              <button type="button" className="ad-danger" onClick={() => setDialog({ type: "delete", ids: [...picked] })}>
                <Trash2 size={16} /> Delete selected
              </button>
              <button type="button" className="ad-ghost" onClick={() => setPicked(new Set())}>Clear</button>
            </div>
          )}

          <div className="ad-scroll">
            <table>
              <thead>
                <tr>
                  <th className="ad-check">
                    <input type="checkbox" aria-label="Select all" checked={allPicked} onChange={togglePickAll} />
                  </th>
                  <th>Name</th><th>Email</th><th>Type</th><th>Joined</th><th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shownUsers.map((u) => {
                  const me = u.id === user.id;
                  return (
                    <tr key={u.id}>
                      <td className="ad-check">
                        <input type="checkbox" aria-label={`Select ${u.email}`} disabled={me}
                               checked={picked.has(u.id)} onChange={() => togglePick(u.id)} />
                      </td>
                      <td>{u.name} {me && <span className="ad-you">you</span>}</td>
                      <td>{u.email}</td>
                      <td><span className={`ad-pill ${u.role}`}>{u.role === "admin" ? "Admin" : "Normal user"}</span></td>
                      <td>{fmt(u.created_at)}</td>
                      <td className="ad-row-actions">
                        <button type="button" className="ad-icon" disabled={me}
                                title={u.role === "admin" ? "Make normal user" : "Make admin"}
                                aria-label={u.role === "admin" ? `Make ${u.email} a normal user` : `Make ${u.email} an admin`}
                                onClick={() => changeRole(u)}>
                          {u.role === "admin" ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                        </button>
                        <button type="button" className="ad-icon danger" disabled={me} title="Delete account"
                                aria-label={`Delete ${u.email}`}
                                onClick={() => setDialog({ type: "delete", ids: [u.id] })}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {shownUsers.length === 0 && (
                  <tr><td colSpan={6} className="ad-empty">No accounts match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="ad-meta">
            {shownUsers.length} of {users.length} accounts. You can’t delete or demote your own account here.
            Chat conversations are private and are not shown.
          </p>
        </section>
      )}

      {/* ============ ACTIVITY ============ */}
      {tab === "activity" && !loading && (
        <section className="ad-panel">
          <div className="ad-toolbar">
            <h2 className="ad-grow">Account activity</h2>
            <select className="ad-input ad-select" aria-label="Filter activity" value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}>
              <option value="all">All events</option>
              {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {audit === null ? (
            <p className="ad-empty">
              {missing.audit
                ? "The backend has no audit log yet. Add GET /api/admin/audit (see the setup notes) to see who created, deleted and changed accounts."
                : "The activity log could not be loaded."}
            </p>
          ) : (
            <div className="ad-scroll">
              <table>
                <thead><tr><th>When</th><th>Event</th><th>Who</th><th>Account</th><th>Details</th></tr></thead>
                <tbody>
                  {shownAudit.map((e) => {
                    const meta = ACTIONS[e.action] || { label: e.action, tone: "muted" };
                    return (
                      <tr key={e.id}>
                        <td>{fmt(e.created_at)}</td>
                        <td><span className={`ad-pill tone-${meta.tone}`}>{meta.label}</span></td>
                        <td>{e.actor_email || "—"}</td>
                        <td>{e.target_email || "—"}</td>
                        <td>{e.detail || "—"}</td>
                      </tr>
                    );
                  })}
                  {shownAudit.length === 0 && <tr><td colSpan={5} className="ad-empty">No events yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ============ DATA SYNC ============ */}
      {tab === "sync" && !loading && (
        <section className="ad-panel">
          <h2>Data sync</h2>
          <p className="ad-meta">
            Automatic schedule: {schedule === "disabled" ? "off" : `${schedule} (UTC)`}.
            {health && ` Chat model ${health.chat_model}. Embeddings ${health.embedding_model}.`}
          </p>
          <button type="button" className="ad-primary" onClick={startSync} disabled={busyNow}>
            <RefreshCw size={16} className={busyNow ? "ad-spin" : ""} /> {busyNow ? "Sync running…" : "Sync sources now"}
          </button>
          <p className="ad-meta">Manual syncs are limited to 3 per hour.</p>

          {runs.length > 0 && (
            <div className="ad-scroll">
              <table>
                <thead><tr><th>Started</th><th>Finished</th><th>Trigger</th><th>Status</th><th>Chunks added</th></tr></thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td>{fmt(r.started_at)}</td>
                      <td>{fmt(r.finished_at)}</td>
                      <td>{r.trigger}</td>
                      <td><span className={`ad-pill ${r.status}`}>{r.status}</span></td>
                      <td>{r.chunks_saved ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ============ DIALOGS ============ */}
      {dialog?.type === "create" && <CreateUser onCreate={createUser} onClose={() => setDialog(null)} />}
      {dialog?.type === "delete" && deleteTargets.length > 0 && (
        <ConfirmDelete
          title={deleteTargets.length === 1 ? "Delete this account?" : `Delete ${deleteTargets.length} accounts?`}
          body={deleteTargets.length === 1
            ? `${deleteTargets[0].name} (${deleteTargets[0].email}) will lose access immediately. This can’t be undone.`
            : "These people will lose access immediately. This can’t be undone."}
          word={deleteTargets.length === 1 ? deleteTargets[0].email : "DELETE"}
          onConfirm={() => deleteUsers(dialog.ids)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}