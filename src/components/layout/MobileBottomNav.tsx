import { useLocation, Link } from "react-router-dom";

interface MobileBottomNavProps {
  onMenuClick: () => void;
}

// Premium custom SVG icons — filled when active, stroke when inactive
const NavIcons = {
  Home: ({ filled }: { filled: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {filled ? (
        <>
          <path d="M10.707 2.293a1 1 0 0 1 1.414 0l8 8A1 1 0 0 1 20 12h-1v8a1 1 0 0 1-1 1h-4v-5H10v5H6a1 1 0 0 1-1-1v-8H4a1 1 0 0 1-.707-1.707l8-8Z" fill="currentColor"/>
        </>
      ) : (
        <path d="M3 12L12 3l9 9M5 10v10a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1V10M9 21V12h6v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      )}
    </svg>
  ),

  Tests: ({ filled }: { filled: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {filled ? (
        <path d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm9 0v5h5M8 13h8M8 17h5" fill="currentColor" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
      ) : (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </>
      )}
    </svg>
  ),

  Progress: ({ filled }: { filled: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {filled ? (
        <>
          <rect x="2" y="14" width="4" height="8" rx="1.5" fill="currentColor" opacity="0.6"/>
          <rect x="9" y="9" width="4" height="13" rx="1.5" fill="currentColor" opacity="0.8"/>
          <rect x="16" y="4" width="4" height="18" rx="1.5" fill="currentColor"/>
          <path d="M3 7l5-4 5 4 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="18" cy="2.5" r="1.5" fill="currentColor"/>
        </>
      ) : (
        <>
          <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </>
      )}
    </svg>
  ),

  Alerts: ({ filled }: { filled: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {filled ? (
        <>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9Z" fill="currentColor"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </>
      )}
    </svg>
  ),

  Messages: ({ filled }: { filled: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {filled ? (
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" fill="currentColor"/>
      ) : (
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      )}
    </svg>
  ),

  Menu: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  ),
};

const bottomNavItems = [
  { key: "Home" as const, label: "Home", path: "/" },
  { key: "Tests" as const, label: "Tests", path: "/tests" },
  { key: "Progress" as const, label: "Progress", path: "/performance" },
  { key: "Alerts" as const, label: "Alerts", path: "/alerts", badge: 3 },
  { key: "Messages" as const, label: "Messages", path: "/teacher-notes" },
];

// Gradient map per tab
const activeGradient: Record<string, string> = {
  Home:     "from-violet-500 to-indigo-600",
  Tests:    "from-blue-500 to-cyan-500",
  Progress: "from-emerald-500 to-teal-500",
  Alerts:   "from-rose-500 to-pink-500",
  Messages: "from-amber-400 to-orange-500",
};

const activeText: Record<string, string> = {
  Home:     "text-indigo-600",
  Tests:    "text-cyan-600",
  Progress: "text-emerald-600",
  Alerts:   "text-rose-500",
  Messages: "text-amber-500",
};

export const MobileBottomNav = ({ onMenuClick }: MobileBottomNavProps) => {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 lg:hidden z-[100]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Frosted glass bar */}
      <div className="mx-3 mb-3 rounded-3xl bg-white/75 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex items-center h-[68px] px-1">

        {bottomNavItems.map(({ key, label, path, badge }) => {
          const isActive = location.pathname === path;
          const IconComp = NavIcons[key];
          return (
            <Link
              key={path}
              to={path}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-all duration-200"
            >
              {/* Floating pill behind active icon */}
              <div className={`relative flex items-center justify-center transition-all duration-300 ${
                isActive ? "w-12 h-9 rounded-2xl" : "w-10 h-9"
              }`}>
                {isActive && (
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${activeGradient[key]} opacity-15`} />
                )}

                <div className={`transition-all duration-200 ${isActive ? "scale-110" : "scale-100"} relative`}>
                  <div className={isActive ? activeText[key] : "text-slate-400"}>
                    <IconComp filled={isActive} />
                  </div>

                  {/* Badge */}
                  {badge && (
                    <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] bg-red-500 rounded-full text-[9px] font-black flex items-center justify-center text-white border-[1.5px] border-white shadow-sm">
                      {badge}
                    </span>
                  )}
                </div>
              </div>

              <span className={`text-[9px] font-bold tracking-wide transition-all duration-200 ${
                isActive ? `${activeText[key]} font-extrabold` : "text-slate-400"
              }`}>
                {label}
              </span>
            </Link>
          );
        })}

        {/* Menu button */}
        <button
          onClick={onMenuClick}
          className="flex-1 flex flex-col items-center justify-center gap-[3px] text-slate-400 transition-all active:scale-95"
        >
          <div className="w-10 h-9 rounded-2xl bg-slate-100/80 flex items-center justify-center">
            <NavIcons.Menu />
          </div>
          <span className="text-[9px] font-bold tracking-wide text-slate-400">Menu</span>
        </button>

      </div>
    </nav>
  );
};
