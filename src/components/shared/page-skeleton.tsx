import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Generic route fallback: page header + a card of rows. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-9 w-full max-w-md rounded-lg" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-[60%]" />
                <Skeleton className="h-3 w-[35%]" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
