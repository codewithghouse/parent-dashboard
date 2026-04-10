import { Bell, Menu } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";

interface ParentTopbarProps {
  onMenuClick: () => void;
}

export const ParentTopbar = ({ onMenuClick }: ParentTopbarProps) => {
  const { studentData, user } = useAuth();

  return (
    <header className="h-16 bg-white/70 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 md:px-8 sticky top-0 z-[60]">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>

        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-sm font-black text-slate-800 truncate max-w-[140px] md:max-w-none uppercase tracking-tight">
            {studentData?.schoolName || "EDUINTELLECT"}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
              {studentData?.branch || "Portal Active"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6 flex-shrink-0">
        <button className="relative w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-all group">
          <Bell className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
        </button>
        
        <div className="flex items-center gap-3 pl-3 md:pl-6 border-l border-slate-100">
          <div className="text-right hidden sm:block leading-none">
            <p className="text-sm font-black text-slate-800">{studentData?.name || user?.displayName || "Parent"}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Guardian</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-black text-sm shadow-lg shadow-blue-900/20 ring-4 ring-blue-50">
            {studentData?.name?.[0] || user?.displayName?.[0] || "P"}
          </div>
        </div>
      </div>
    </header>
  );
};
