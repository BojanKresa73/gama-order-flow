import type { WorkOrderFiltersState } from "@/components/work-orders/WorkOrderFilters";

export const serializeFiltersToParams = (filters: WorkOrderFiltersState): URLSearchParams => {
  const params = new URLSearchParams();
  if (filters.dateRange.from) params.set("dateFrom", filters.dateRange.from.toISOString());
  if (filters.dateRange.to) params.set("dateTo", filters.dateRange.to.toISOString());
  if (filters.clientIds.length > 0) params.set("clients", filters.clientIds.join(","));
  if (filters.orderType !== "all") params.set("type", filters.orderType);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.searchText) params.set("search", filters.searchText);
  if (filters.fileNameFilter) params.set("file", filters.fileNameFilter);
  return params;
};

export const parseFiltersFromParams = (params: URLSearchParams): WorkOrderFiltersState => {
  return {
    dateRange: {
      from: params.get("dateFrom") ? new Date(params.get("dateFrom")!) : undefined,
      to: params.get("dateTo") ? new Date(params.get("dateTo")!) : undefined,
    },
    clientIds: params.get("clients")?.split(",").filter(Boolean) || [],
    orderType: params.get("type") || "all",
    status: params.get("status") || "all",
    searchText: params.get("search") || "",
    fileNameFilter: params.get("file") || "",
  };
};
