import { useState } from "react";
import { Outlet } from "react-router-dom";
import { ParentSidebar } from "./ParentSidebar";
import { ParentTopbar } from "./ParentTopbar";
import { MobileBottomNav } from "./MobileBottomNav";
import { PageTransition } from "@/components/PageTransition";

export const ParentLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    /* h-screen + overflow-hidden = fixed viewport shell, scroll lives in <main> */
    <div className="flex h-screen w-full overflow-hidden">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <ParentSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Right column — topbar (fixed height) + scrollable main */}
      <div className="flex-1 flex flex-col lg:ml-[280px] min-w-0 h-full overflow-hidden">
        <ParentTopbar onMenuClick={() => setSidebarOpen(true)} />

        {/* ── Scrollable content area ─────────────────────────────────────
            overflow-y-auto  → this is the ONE scroll container
            pb-28            → space for fixed bottom nav on mobile
            lg:pb-8          → no bottom nav on desktop
        */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/50 p-3 md:p-6 pb-28 lg:pb-8"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' }}
        >
          <PageTransition>
            <div className="max-w-7xl mx-auto w-full">
              <Outlet />
            </div>
          </PageTransition>
        </main>
      </div>

      {/* Fixed bottom nav — always above scroll area */}
      <MobileBottomNav onMenuClick={() => setSidebarOpen(true)} />
    </div>
  );
};
