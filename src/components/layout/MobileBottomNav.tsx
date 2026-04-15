import { useLocation, Link } from "react-router-dom";

interface MobileBottomNavProps {
  onMenuClick: () => void;
}

const bottomNavItems = [
  { key: "Home", label: "Home", path: "/" },
  { key: "Tests", label: "Tests", path: "/tests" },
  { key: "Progress", label: "Progress", path: "/performance" },
  { key: "Alerts", label: "Alerts", path: "/alerts" },
  { key: "Messages", label: "Messages", path: "/teacher-notes" },
];

const NavIcons: Record<string, (props: { active: boolean }) => JSX.Element> = {
  Home: ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#007AFF" : "none"} stroke={active ? "#007AFF" : "#8E8E93"} strokeWidth={active ? "0" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  ),
  Tests: ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#007AFF" : "#8E8E93"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  Progress: ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#007AFF" : "#8E8E93"} strokeWidth="1.8" strokeLinecap="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Alerts: ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#007AFF" : "#8E8E93"} strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Messages: ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#007AFF" : "#8E8E93"} strokeWidth="1.8" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

export const MobileBottomNav = ({ onMenuClick }: MobileBottomNavProps) => {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 lg:hidden z-[100]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="flex items-start justify-around pt-[10px]"
        style={{
          height: 82,
          background: "rgba(249,249,249,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "0.5px solid rgba(60,60,67,0.12)",
        }}
      >
        {bottomNavItems.map(({ key, label, path }) => {
          const isActive = location.pathname === path;
          const IconComp = NavIcons[key];
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center gap-1 min-w-[60px] px-3 py-1 active:scale-95 transition-transform"
            >
              <div className="w-7 h-7 flex items-center justify-center relative">
                <IconComp active={isActive} />
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: isActive ? "#007AFF" : "#AEAEB2" }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};