import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Boxes } from "lucide-react";

export default function AdminInventory() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Boxes className="h-6 w-6" />
            <CardTitle>Inventar</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Ovde će biti upravljanje formatima ploča, zalihe i upozorenja.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
