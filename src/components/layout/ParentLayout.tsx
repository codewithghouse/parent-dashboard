import { Outlet } from "react-router-dom";
import { ParentSidebar } from "./ParentSidebar";
import { ParentTopbar } from "./ParentTopbar";

export const ParentLayout = () => {
  return (
    <div className="flex min-h-screen w-full">
      <ParentSidebar />
      <div className="flex-1 flex flex-col ml-[280px]">
        <ParentTopbar />
        <main className="flex-1 p-6 overflow-auto bg-slate-50/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
