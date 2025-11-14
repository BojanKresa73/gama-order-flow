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
      <CardContent className="grid grid-cols-2 gap-3">
        <Button
          variant="default"
          className="h-20 flex-col gap-2"
          onClick={() => nav("/admin/users")}
        >
          <Users className="h-6 w-6" />
          <span className="font-semibold">Korisnici</span>
        </Button>

        <Button
          variant="outline"
          className="h-20 flex-col gap-2"
          onClick={() => nav("/admin/inventory")}
        >
          <Boxes className="h-6 w-6" />
          <span className="font-semibold">Inventar</span>
        </Button>
      </CardContent>
    </Card>
  );
}
