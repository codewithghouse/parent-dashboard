import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
}

export const PageHeader = ({ title, subtitle, badge }: PageHeaderProps) => {
  return (
    <div className="mb-6 md:mb-8">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {badge && (
          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="text-slate-500 mt-1 text-sm md:text-base">{subtitle}</p>}
    </div>
  );
};
