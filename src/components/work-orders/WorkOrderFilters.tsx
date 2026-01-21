import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays } from "date-fns";
import { CalendarIcon, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface WorkOrderFiltersState {
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  clientIds: string[];
  orderType: string; // "all" | "ctp" | "digital" | "film" | "other"
  status: string; // "all" | "open" | "closed"
  searchText: string;
}

interface WorkOrderFiltersProps {
  filters: WorkOrderFiltersState;
  onFiltersChange: (filters: WorkOrderFiltersState) => void;
}

const ORDER_TYPE_OPTIONS = [
  { value: "all", label: "Svi tipovi" },
  { value: "ctp", label: "CTP" },
  { value: "digital", label: "Digital" },
  { value: "film", label: "Filmovanje" },
  { value: "other", label: "Ostalo" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Svi statusi" },
  { value: "open", label: "Otvoreni" },
  { value: "closed", label: "Zatvoreni" },
  { value: "invoiced", label: "Fakturisano" },
];

export function WorkOrderFilters({ filters, onFiltersChange }: WorkOrderFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  // Sync local filters with props when they change (e.g., from URL params)
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleApply = () => {
    onFiltersChange(localFilters);
  };

  const handleReset = () => {
    const resetFilters: WorkOrderFiltersState = {
      dateRange: {
        from: undefined,
        to: undefined,
      },
      clientIds: [],
      orderType: "all",
      status: "all",
      searchText: "",
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  const toggleClient = (clientId: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      clientIds: prev.clientIds.includes(clientId)
        ? prev.clientIds.filter((id) => id !== clientId)
        : [...prev.clientIds, clientId],
    }));
  };

  const removeClient = (clientId: string) => {
    const newFilters = {
      ...localFilters,
      clientIds: localFilters.clientIds.filter((id) => id !== clientId),
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const setQuickDateRange = (days: number | null) => {
    const newFilters = {
      ...localFilters,
      dateRange: days === null
        ? { from: undefined, to: undefined }
        : { from: subDays(new Date(), days), to: new Date() },
    };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const activeFiltersCount = 
    (localFilters.dateRange.from ? 1 : 0) +
    (localFilters.clientIds.length > 0 ? 1 : 0) +
    (localFilters.orderType !== "all" ? 1 : 0) +
    (localFilters.status !== "all" ? 1 : 0) +
    (localFilters.searchText ? 1 : 0);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Quick date buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateRange(7)}
              className={cn(
                localFilters.dateRange.from &&
                  Math.round((new Date().getTime() - localFilters.dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) === 7
                  ? "bg-primary text-primary-foreground"
                  : ""
              )}
            >
              7 dana
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateRange(30)}
              className={cn(
                localFilters.dateRange.from &&
                  Math.round((new Date().getTime() - localFilters.dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) === 30
                  ? "bg-primary text-primary-foreground"
                  : ""
              )}
            >
              30 dana
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateRange(90)}
              className={cn(
                localFilters.dateRange.from &&
                  Math.round((new Date().getTime() - localFilters.dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) === 90
                  ? "bg-primary text-primary-foreground"
                  : ""
              )}
            >
              90 dana
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateRange(null)}
              className={cn(
                !localFilters.dateRange.from && !localFilters.dateRange.to
                  ? "bg-primary text-primary-foreground"
                  : ""
              )}
            >
              Svi
            </Button>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Period</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !localFilters.dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {localFilters.dateRange?.from ? (
                      localFilters.dateRange.to ? (
                        <>
                          {format(localFilters.dateRange.from, "dd.MM.yy")} -{" "}
                          {format(localFilters.dateRange.to, "dd.MM.yy")}
                        </>
                      ) : (
                        format(localFilters.dateRange.from, "dd.MM.yyyy")
                      )
                    ) : (
                      <span>Svi datumi</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={localFilters.dateRange?.from}
                    selected={{
                      from: localFilters.dateRange?.from,
                      to: localFilters.dateRange?.to,
                    }}
                    onSelect={(range) => {
                      setLocalFilters((prev) => ({
                        ...prev,
                        dateRange: {
                          from: range?.from,
                          to: range?.to || range?.from,
                        },
                      }));
                    }}
                    numberOfMonths={2}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Order Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tip naloga</label>
              <Select
                value={localFilters.orderType}
                onValueChange={(value) =>
                  setLocalFilters((prev) => ({ ...prev, orderType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Svi tipovi" />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={localFilters.status}
                onValueChange={(value) =>
                  setLocalFilters((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Svi statusi" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clients */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Klijent</label>
              <Popover open={clientsOpen} onOpenChange={setClientsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    {localFilters.clientIds.length > 0
                      ? `${localFilters.clientIds.length} izabrano`
                      : "Svi klijenti"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Pretraži klijente..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="p-4 space-y-2">
                      {filteredClients.map((client) => (
                        <div
                          key={client.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`client-${client.id}`}
                            checked={localFilters.clientIds.includes(client.id)}
                            onCheckedChange={() => toggleClient(client.id)}
                          />
                          <label
                            htmlFor={`client-${client.id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {client.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end gap-2">
              <Button onClick={handleApply} className="flex-1">
                Primeni
              </Button>
              <Button onClick={handleReset} variant="outline">
                Reset
              </Button>
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {localFilters.dateRange.from && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  {format(localFilters.dateRange.from, "dd.MM.yy")}
                  {localFilters.dateRange.to && ` - ${format(localFilters.dateRange.to, "dd.MM.yy")}`}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => {
                      const newFilters = { ...localFilters, dateRange: { from: undefined, to: undefined } };
                      setLocalFilters(newFilters);
                      onFiltersChange(newFilters);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {localFilters.orderType !== "all" && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  {ORDER_TYPE_OPTIONS.find((o) => o.value === localFilters.orderType)?.label}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => {
                      const newFilters = { ...localFilters, orderType: "all" };
                      setLocalFilters(newFilters);
                      onFiltersChange(newFilters);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {localFilters.status !== "all" && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  {STATUS_OPTIONS.find((o) => o.value === localFilters.status)?.label}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => {
                      const newFilters = { ...localFilters, status: "all" };
                      setLocalFilters(newFilters);
                      onFiltersChange(newFilters);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {localFilters.clientIds.map((clientId) => {
                const client = clients.find((c) => c.id === clientId);
                return client ? (
                  <Badge key={clientId} variant="secondary" className="gap-1 pr-1">
                    {client.name}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removeClient(clientId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
