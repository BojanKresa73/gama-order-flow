import { CtpFiltersState } from "@/pages/CtpStats";
import { format } from "date-fns";

export function buildCtpRpcParams(filters: CtpFiltersState) {
  return {
    p_from: format(filters.dateRange.from, "yyyy-MM-dd"),
    p_to: format(filters.dateRange.to, "yyyy-MM-dd"),
    p_client_ids: filters.clientIds.length > 0 ? filters.clientIds : null,
    p_plate_format_ids: filters.plateFormatIds.length > 0 ? filters.plateFormatIds : null,
  };
}
