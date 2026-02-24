import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Skeleton for a full-page loading state with header and cards */
export const PageSkeleton = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded" />
          <Skeleton className="h-9 w-32 rounded" />
        </div>
      </div>
    </header>
    <main className="mx-auto px-4 py-8 max-w-[1600px] space-y-4">
      <Skeleton className="h-12 w-full rounded-lg" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded" />
          ))}
        </CardContent>
      </Card>
    </main>
  </div>
);

/** Skeleton for table rows */
export const TableRowSkeleton = ({ cols = 10 }: { cols?: number }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="p-3">
        <Skeleton className="h-5 w-full rounded" />
      </td>
    ))}
  </tr>
);
