import { Navigate } from "react-router-dom";
import { useAuthz } from "@/hooks/useAuthz";

export default function AdminGuard({ children }: { children: JSX.Element }) {
  const { isAdmin } = useAuthz();
  
  // isAdmin now includes superuser, admin_plus, and admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}
