import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5 rounded", i === lines - 1 ? "w-3/4" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-3.5 w-full rounded" />
        </td>
      ))}
    </tr>
  );
}
