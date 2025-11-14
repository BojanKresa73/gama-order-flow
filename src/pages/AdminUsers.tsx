import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function AdminUsers() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            <CardTitle>Administracija korisnika</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Ovde će biti tabela sa svim korisnicima, mogućnost dodele/uklanjanja rola i reset lozinke.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
