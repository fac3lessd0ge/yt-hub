import type { ReactNode } from "react";

interface HistoryDateGroupProps {
  label: string;
  children: ReactNode;
}

export function HistoryDateGroup({ label, children }: HistoryDateGroupProps) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </h3>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}
