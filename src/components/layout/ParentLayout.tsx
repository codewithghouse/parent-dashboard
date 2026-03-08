import { ReactNode } from "react";
import { ParentSidebar } from "./ParentSidebar";
import { ParentTopbar } from "./ParentTopbar";

interface ParentLayoutProps {
  children: ReactNode;
}

export const ParentLayout = ({ children }: ParentLayoutProps) => {
  return (
    <div className="flex min-h-screen w-full">
      <ParentSidebar />
      <div className="flex-1 flex flex-col ml-[280px]">
        <ParentTopbar />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
