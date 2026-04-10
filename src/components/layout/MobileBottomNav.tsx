import { useLocation, Link } from "react-router-dom";
import { Home, TrendingUp, Bell, MessageSquare, Menu, FileText } from "lucide-react";

interface MobileBottomNavProps {
  onMenuClick: () => void;
}

const bottomNavItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: FileText, label: "Tests", path: "/tests" },
  { icon: TrendingUp, label: "Progress", path: "/performance" },
  { icon: Bell, label: "Alerts", path: "/alerts", badge: 3 },
  { icon: MessageSquare, label: "Messages", path: "/teacher-notes" },
];

export const MobileBottomNav = ({ onMenuClick }: MobileBottomNavProps) => {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-100 flex items-stretch lg:hidden z-[100] h-20 px-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {bottomNavItems.map(({ icon: Icon, label, path, badge }) => {
        const isActive = location.pathname === path;
        return (
          <Link
            key={path}
            to={path}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all relative ${
              isActive ? "text-primary scale-110" : "text-slate-400 active:text-slate-600"
            }`}
          >
            {isActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full shadow-[0_4px_12px_rgba(30,58,138,0.4)]" />
            )}
            <div className="relative">
              <Icon className={`w-6 h-6 transition-transform ${isActive ? "drop-shadow-[0_0_8px_rgba(30,58,138,0.2)]" : ""}`} />
              {badge && (
                <span className="absolute -top-2 -right-2.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] font-black flex items-center justify-center text-white px-1 border-2 border-white shadow-sm animate-bounce">
                  {badge}
                </span>
              )}
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest transition-opacity ${isActive ? "opacity-100" : "opacity-60"}`}>{label}</span>
          </Link>
        );
      })}

      <button
        onClick={onMenuClick}
        className="flex-1 flex flex-col items-center justify-center gap-1 text-slate-400 active:text-slate-600 transition-all"
      >
        <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center">
          <Menu className="w-5 h-5" />
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Menu</span>
      </button>
    </nav>
  );
};
