import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Boxes } from "lucide-react";
import { useAuthz } from "@/hooks/useAuthz";

export default function AdminSection() {
  const nav = useNavigate();
  const { isSuper, isAdmin } = useAuthz();

  if (!isSuper && !isAdmin) return null;

  return (
    <Card className="col-span-12 xl:col-span-4 shadow-md">
      <CardHeader className="flex flex-row items-center gap-2">
        <Shield className="h-5 w-5" />
        <CardTitle>Administracija</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          variant="default"
          className="h-24 justify-start gap-3 text-left"
          onClick={() => nav("/admin/users")}
        >
          <Users className="h-5 w-5" />
          <div>
            <div className="font-semibold">Korisnici</div>
            <div className="text-xs opacity-70">Dodavanje, uloge, reset lozinke</div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-24 justify-start gap-3 text-left"
          onClick={() => nav("/admin/inventory")}
        >
          <Boxes className="h-5 w-5" />
          <div>
            <div className="font-semibold">Inventar</div>
            <div className="text-xs opacity-70">Formati ploča, zalihe, upozorenja</div>
          </div>
        </Button>
      </CardContent>
    </Card>
  );
}
