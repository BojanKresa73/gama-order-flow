import { Navigate } from "react-router-dom";
import { useAuthz } from "@/hooks/useAuthz";

export default function AdminGuard({ children }: { children: JSX.Element }) {
  const { isSuper, isAdmin } = useAuthz();
  
  if (!isSuper && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}
