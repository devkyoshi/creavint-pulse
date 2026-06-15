import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto thin-scrollbar rounded-[--radius-lg]">
      <table className={cn("w-full text-sm border-collapse", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("border-b border-border bg-surface-raised/50", className)} {...props}>
      {children}
    </thead>
  );
}

export function Tbody({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border-subtle", className)} {...props}>{children}</tbody>;
}

export function Tr({ className, children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors duration-100 hover:bg-surface-raised/60", className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Th({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 text-text-secondary align-middle", className)} {...props}>
      {children}
    </td>
  );
}
