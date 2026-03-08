import { useLocation, Link } from "react-router-dom";
import {
  Home, User, TrendingUp, CalendarCheck, ClipboardList,
  FileText, Brain, SmilePlus, StickyNote, MessageSquare,
  Bell, Settings, GraduationCap
} from "lucide-react";

const navItems = [
  { title: "Dashboard", path: "/", icon: Home },
  { title: "My Child", path: "/my-child", icon: User },
  { title: "Performance", path: "/performance", icon: TrendingUp },
  { title: "Attendance", path: "/attendance", icon: CalendarCheck },
  { title: "Assignments", path: "/assignments", icon: ClipboardList },
  { title: "Tests & Exams", path: "/tests", icon: FileText },
  { title: "Concept Strengths", path: "/concepts", icon: Brain },
  { title: "Behaviour", path: "/behaviour", icon: SmilePlus },
  { title: "Teacher Notes", path: "/teacher-notes", icon: StickyNote },
  { title: "Messages", path: "/messages", icon: MessageSquare, badge: 2 },
  { title: "Alerts", path: "/alerts", icon: Bell, badge: 3 },
  { title: "Settings", path: "/settings", icon: Settings },
];

export const ParentSidebar = () => {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[280px] bg-primary flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="w-8 h-8 bg-primary-foreground rounded-lg flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-primary" />
        </div>
        <span className="text-primary-foreground font-bold text-lg tracking-wide">EDUINTELLECT</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all relative ${
                isActive
                  ? "bg-primary-foreground text-primary shadow-md"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.title}</span>
              {item.badge && (
                <span className={`absolute right-3 min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold ${
                  isActive ? "bg-edu-red text-primary-foreground" : "bg-edu-red text-primary-foreground"
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
