import { Bell } from "lucide-react";

export const ParentTopbar = () => {
  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-end px-6 gap-4">
      <button className="relative p-2 rounded-full hover:bg-muted transition-colors">
        <Bell className="w-5 h-5 text-muted-foreground" />
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-edu-red rounded-full text-[10px] font-bold flex items-center justify-center text-primary-foreground">3</span>
      </button>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
          RS
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">Rahul Sharma</p>
          <p className="text-xs text-muted-foreground">Parent</p>
        </div>
      </div>
    </header>
  );
};
