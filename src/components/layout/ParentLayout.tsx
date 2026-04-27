import { useState } from "react";
import { Outlet } from "react-router-dom";
import { ParentSidebar } from "./ParentSidebar";
import { ParentTopbar } from "./ParentTopbar";
import { MobileBottomNav } from "./MobileBottomNav";
import { PageTransition } from "@/components/PageTransition";

export const ParentLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    /* h-screen + overflow-hidden = fixed viewport shell, scroll lives in <main>.
       bg-[#EEF4FF] fills the 10px gaps around the floating sidebar so its
       elevation/shadow reads against a non-sidebar surface. */
    <div className="flex h-screen w-full overflow-hidden bg-[#EEF4FF]">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[105] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <ParentSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Right column — topbar (fixed height) + scrollable main.
         lg:ml-[300px] = 10px left gap + 280px sidebar + 10px right gap (shadow room). */}
      <div className="flex-1 flex flex-col lg:ml-[300px] min-w-0 h-full overflow-hidden">
        <ParentTopbar onMenuClick={() => setSidebarOpen(true)} />

        {/* ── Scrollable content area ─────────────────────────────────────
            overflow-y-auto  → this is the ONE scroll container
            pb-28            → space for fixed bottom nav on mobile
            lg:pb-8          → no bottom nav on desktop
        */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 pb-[calc(88px+env(safe-area-inset-bottom)+1rem)] lg:pb-8 flex flex-col bg-[#EEF4FF]"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' }}
        >
          <PageTransition>
            <div className="max-w-[1600px] mx-auto w-full flex-1 flex flex-col">
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
