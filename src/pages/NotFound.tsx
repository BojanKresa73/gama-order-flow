import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="text-xl text-muted-foreground">Stranica nije pronađena</p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button onClick={() => navigate("/dashboard")}>
            Nazad na Dashboard
          </Button>
          <Button variant="outline" onClick={() => navigate("/work-orders/new")}>
            Kreiraj novi nalog
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
