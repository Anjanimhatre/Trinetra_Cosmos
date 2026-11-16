import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import Home from "./pages/Home.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import Explorer from "./pages/Explorer.jsx";
import SpaceExplorer from "./pages/SpaceExplorer.jsx";
import AdminHomePage from "./pages/AdminHomePage.jsx";
import Navbar from "./components/Navbar.jsx";
import { auth } from "./services/auth.js";
import "./home.css";
import MoonMission from "./pages/MoonMission.jsx";   // wherever you saved the file

// where you render the current page:

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("home"); // home | moon | mars | chat | explorer | admin
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [checking, setChecking] = useState(() => auth.hasToken()); // restoring a saved login?

  // Restore the session on page load. The server returns the user and their current role.
  useEffect(() => {
    if (!auth.hasToken()) return undefined;
    let cancelled = false;
    auth
      .me()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setPage(u.role === "admin" ? "admin" : "home");
      })
      .catch(() => {}) // an expired token is already cleared by the api helper
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Any request that comes back 401 (expired or revoked login) sends the person to the login page.
  useEffect(() => {
    const expired = () => {
      setUser(null);
      setPage("home");
      setAuthMode("login");
    };
    window.addEventListener("pa:unauthorized", expired);
    return () => window.removeEventListener("pa:unauthorized", expired);
  }, []);

  // LoginPage and RegisterPage have already saved the token before calling this.
  const onAuth = (u) => {
    setUser(u);
    setPage(u.role === "admin" ? "admin" : "home");
  };

  const onLogout = () => {
    auth.logout();
    setUser(null);
    setPage("home");
    setAuthMode("login");
  };

  if (checking) return <div className="shell" aria-busy="true" />;

  if (!user) {
    return authMode === "login" ? (
      <LoginPage onAuth={onAuth} onSwitch={() => setAuthMode("register")} />
    ) : (
      <RegisterPage onAuth={onAuth} onSwitch={() => setAuthMode("login")} />
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <div className="shell">
      <Navbar page={page} onNavigate={setPage} user={user} onLogout={onLogout} />
      <main className="shell-main">
        {page === "home" && <Home onNavigate={setPage} />}
        {(page === "moon" || page === "mars") && <SpaceExplorer key={page} world={page} />}
        {page === "chat" && <ChatPage user={user} />}
        {page === "explorer" && <Explorer user={user} onLogout={onLogout} />}
        {page === "mission" && <MoonMission />}
        {page === "admin" && isAdmin && <AdminHomePage user={user} onLogout={onLogout} />}
      </main>
    </div>
  );
}