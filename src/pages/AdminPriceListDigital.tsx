import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PriceListDigitalTable } from "@/components/admin/PriceListDigitalTable";

const AdminPriceListDigital = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Cenovnik Digital
              </h1>
              <p className="text-sm text-muted-foreground">
                Upravljanje cenovnikom za digitalni štampač
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <PriceListDigitalTable />
      </div>
    </div>
  );
};

export default AdminPriceListDigital;
