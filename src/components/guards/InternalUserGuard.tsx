import { Navigate } from "react-router-dom";
import { useAuthz } from "@/hooks/useAuthz";
import { Loader2 } from "lucide-react";

/**
 * Guard that blocks client_user role from accessing internal application pages.
 * Redirects them to the client portal instead.
 */
export default function InternalUserGuard({ children }: { children: JSX.Element }) {
  const { role, isLoading, isClientUser } = useAuthz();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  // If user is a client_user, redirect to portal
  if (isClientUser) {
    return <Navigate to="/portal" replace />;
  }
  
  // If user is guest (not logged in), redirect to login
  if (role === "guest") {
    return <Navigate to="/" replace />;
  }
  
  return children;
}
