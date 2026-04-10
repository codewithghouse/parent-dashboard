import { useState } from "react";
import { Outlet } from "react-router-dom";
import { ParentSidebar } from "./ParentSidebar";
import { ParentTopbar } from "./ParentTopbar";
import { MobileBottomNav } from "./MobileBottomNav";

export const ParentLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <ParentSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:ml-[280px] min-w-0">
        <ParentTopbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-3 md:p-6 overflow-x-hidden bg-slate-50/50 pb-28 lg:pb-8">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileBottomNav onMenuClick={() => setSidebarOpen(true)} />
</div>
  );
};
