import { Bell } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";

export const ParentTopbar = () => {
  const { studentData, user } = useAuth();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex flex-col leading-none">
        {studentData?.schoolName && (
          <span className="text-xs font-bold text-foreground truncate max-w-[200px]">
            {studentData.schoolName}
          </span>
        )}
        {studentData?.branch && (
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">
            {studentData.branch}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
      <button className="relative p-2 rounded-full hover:bg-muted transition-colors">
        <Bell className="w-5 h-5 text-muted-foreground" />
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">3</span>
      </button>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm shadow-md">
          {studentData?.name?.[0] || user?.displayName?.[0] || "P"}
        </div>
        <div className="text-right hidden sm:block leading-none">
          <p className="text-sm font-bold text-foreground">{studentData?.name || user?.displayName || "Parent"}</p>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">Authorized Parent</p>
        </div>
      </div>
      </div>
    </header>
  );
};
