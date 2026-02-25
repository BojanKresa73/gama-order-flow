import { Navigate } from "react-router-dom";
import { useAuthz } from "@/hooks/useAuthz";
import { Loader2 } from "lucide-react";

export default function AdminGuard({ children }: { children: JSX.Element }) {
  const { role, isAdmin, isLoading } = useAuthz();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (role === "guest") {
    return <Navigate to="/" replace />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}
