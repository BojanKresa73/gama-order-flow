import { CtpFiltersState } from "@/pages/CtpStats";

export function buildCtpRpcParams(filters: CtpFiltersState) {
  return {
    p_from: filters.dateRange.from.toISOString().split("T")[0],
    p_to: filters.dateRange.to.toISOString().split("T")[0],
    p_client_ids: filters.clientIds.length > 0 ? filters.clientIds : null,
    p_plate_format_ids: filters.plateFormatIds.length > 0 ? filters.plateFormatIds : null,
  };
}
