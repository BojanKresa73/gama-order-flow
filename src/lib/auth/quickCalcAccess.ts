import { useAuthz } from "@/hooks/useAuthz";

/**
 * Brzi kalkulator je dostupan samo Admin / Admin Plus / Superuser ulogama.
 */
export function useCanUseQuickCalc() {
  const { isSuper, isAdmin } = useAuthz();
  return isSuper || isAdmin;
}
