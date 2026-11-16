export default function Navbar({ page, onNavigate, user, onLogout }) {
  const links = [
    ["home", "Home"],
    ["moon", "Moon"],
    ["mars", "Mars"],
    ["chat", "Chat with AI"],
    ["explorer", "Explorer"], // remove this line if you don't want your old Explorer
  ];
  if (user?.role === "admin") links.push(["admin", "Admin"]);

  return (
    <nav className="topnav">
      <button className="brand" onClick={() => onNavigate(user?.role === "admin" ? "admin" : "home")}>
        🚀 Space Relics
      </button>
      <ul>
        {links.map(([id, label]) => (
          <li key={id}>
            <button className={page === id ? "active" : ""} onClick={() => onNavigate(id)}>
              {label}
            </button>
          </li>
        ))}
      </ul>
      <div className="user">
        {user?.name && (
          <span>
            {user.name}
            {user.role === "admin" ? " (admin)" : ""}
          </span>
        )}
        <button className="logout" onClick={onLogout}>Log out</button>
      </div>
    </nav>
  );
}