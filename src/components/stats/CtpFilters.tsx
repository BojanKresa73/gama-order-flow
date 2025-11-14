import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CtpFiltersState } from "@/pages/CtpStats";

interface CtpFiltersProps {
  filters: CtpFiltersState;
  onFiltersChange: (filters: CtpFiltersState) => void;
}

export function CtpFilters({ filters, onFiltersChange }: CtpFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [formatsOpen, setFormatsOpen] = useState(false);

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

  // Fetch plate formats
  const { data: plateFormats = [] } = useQuery({
    queryKey: ["plate-formats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plate_formats")
        .select("id, format_name")
        .order("format_name");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const handleApply = () => {
    onFiltersChange(localFilters);
  };

  const handleReset = () => {
    const resetFilters: CtpFiltersState = {
      dateRange: {
        from: subDays(new Date(), 30),
        to: new Date(),
      },
      clientIds: [],
      plateFormatIds: [],
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

  const togglePlateFormat = (formatId: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      plateFormatIds: prev.plateFormatIds.includes(formatId)
        ? prev.plateFormatIds.filter((id) => id !== formatId)
        : [...prev.plateFormatIds, formatId],
    }));
  };

  const removeClient = (clientId: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      clientIds: prev.clientIds.filter((id) => id !== clientId),
    }));
  };

  const removePlateFormat = (formatId: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      plateFormatIds: prev.plateFormatIds.filter((id) => id !== formatId),
    }));
  };

  return (
    <Card className="border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Period</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !localFilters.dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {localFilters.dateRange?.from ? (
                      localFilters.dateRange.to ? (
                        <>
                          {format(localFilters.dateRange.from, "dd.MM.yyyy")} -{" "}
                          {format(localFilters.dateRange.to, "dd.MM.yyyy")}
                        </>
                      ) : (
                        format(localFilters.dateRange.from, "dd.MM.yyyy")
                      )
                    ) : (
                      <span>Izaberi period</span>
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
                      if (range?.from) {
                        setLocalFilters((prev) => ({
                          ...prev,
                          dateRange: {
                            from: range.from!,
                            to: range.to || range.from!,
                          },
                        }));
                      }
                    }}
                    numberOfMonths={2}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
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
                  <ScrollArea className="h-[300px]">
                    <div className="p-4 space-y-2">
                      {clients.map((client) => (
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

            {/* Plate Formats */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Format ploče</label>
              <Popover open={formatsOpen} onOpenChange={setFormatsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    {localFilters.plateFormatIds.length > 0
                      ? `${localFilters.plateFormatIds.length} izabrano`
                      : "Svi formati"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <ScrollArea className="h-[300px]">
                    <div className="p-4 space-y-2">
                      {plateFormats.map((format) => (
                        <div
                          key={format.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`format-${format.id}`}
                            checked={localFilters.plateFormatIds.includes(
                              format.id
                            )}
                            onCheckedChange={() => togglePlateFormat(format.id)}
                          />
                          <label
                            htmlFor={`format-${format.id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {format.format_name}
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
          {(localFilters.clientIds.length > 0 ||
            localFilters.plateFormatIds.length > 0) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              {localFilters.clientIds.map((clientId) => {
                const client = clients.find((c) => c.id === clientId);
                return client ? (
                  <Badge
                    key={clientId}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
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
              {localFilters.plateFormatIds.map((formatId) => {
                const format = plateFormats.find((f) => f.id === formatId);
                return format ? (
                  <Badge
                    key={formatId}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {format.format_name}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removePlateFormat(formatId)}
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
