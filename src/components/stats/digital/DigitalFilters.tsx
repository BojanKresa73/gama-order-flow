import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { CalendarIcon, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DigitalFiltersState } from "@/pages/DigitalStats";

interface DigitalFiltersProps {
  filters: DigitalFiltersState;
  onFiltersChange: (filters: DigitalFiltersState) => void;
}

const PRINT_SIDES_OPTIONS = ["4/0", "4/4", "4/1", "1/0", "1/1"];
const SHEET_FORMAT_OPTIONS = ["330x488", "330x760"];

export function DigitalFilters({ filters, onFiltersChange }: DigitalFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [printSidesOpen, setPrintSidesOpen] = useState(false);
  const [paperTypesOpen, setPaperTypesOpen] = useState(false);
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

  // Fetch paper types
  const { data: paperTypes = [] } = useQuery({
    queryKey: ["digital-paper-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_paper_types")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const handleApply = () => {
    onFiltersChange(localFilters);
  };

  const handleReset = () => {
    const resetFilters: DigitalFiltersState = {
      dateRange: {
        from: subDays(new Date(), 30),
        to: new Date(),
      },
      clientIds: [],
      printSides: [],
      paperTypes: [],
      sheetFormats: [],
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  const quickDateRanges = [
    { label: "7 dana", from: subDays(new Date(), 7), to: new Date() },
    { label: "30 dana", from: subDays(new Date(), 30), to: new Date() },
    { label: "Ovaj mesec", from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    { label: "Prošli mesec", from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) },
    { label: "Ova godina", from: startOfYear(new Date()), to: new Date() },
  ];

  const toggleArrayItem = (key: keyof DigitalFiltersState, item: string) => {
    setLocalFilters((prev) => {
      const arr = prev[key] as string[];
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item],
      };
    });
  };

  const removeArrayItem = (key: keyof DigitalFiltersState, item: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: (prev[key] as string[]).filter((i) => i !== item),
    }));
  };

  const activeFiltersCount = 
    localFilters.clientIds.length + 
    localFilters.printSides.length + 
    localFilters.paperTypes.length + 
    localFilters.sheetFormats.length;

  return (
    <Card className="border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-6 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-indigo-600" />
          <span className="font-medium text-sm">Filteri</span>
          {activeFiltersCount > 0 && (
            <Badge className="bg-indigo-600 text-white text-xs">
              {activeFiltersCount} aktivno
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Quick Date Range Buttons */}
          <div className="flex flex-wrap gap-2">
            {quickDateRanges.map((range) => (
              <Button
                key={range.label}
                variant="outline"
                size="sm"
                className={cn(
                  "text-xs",
                  localFilters.dateRange.from.getTime() === range.from.getTime() &&
                  localFilters.dateRange.to.getTime() === range.to.getTime() &&
                  "bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300"
                )}
                onClick={() => {
                  setLocalFilters((prev) => ({
                    ...prev,
                    dateRange: { from: range.from, to: range.to },
                  }));
                }}
              >
                {range.label}
              </Button>
            ))}
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
                        <span className="truncate">
                          {format(localFilters.dateRange.from, "dd.MM.yy")} -{" "}
                          {format(localFilters.dateRange.to, "dd.MM.yy")}
                        </span>
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
                        <div key={client.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`client-${client.id}`}
                            checked={localFilters.clientIds.includes(client.id)}
                            onCheckedChange={() => toggleArrayItem("clientIds", client.id)}
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

            {/* Print Sides */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Pokrivenost</label>
              <Popover open={printSidesOpen} onOpenChange={setPrintSidesOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    {localFilters.printSides.length > 0
                      ? localFilters.printSides.join(", ")
                      : "Sve"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <div className="p-4 space-y-2">
                    {PRINT_SIDES_OPTIONS.map((side) => (
                      <div key={side} className="flex items-center space-x-2">
                        <Checkbox
                          id={`side-${side}`}
                          checked={localFilters.printSides.includes(side)}
                          onCheckedChange={() => toggleArrayItem("printSides", side)}
                        />
                        <label
                          htmlFor={`side-${side}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {side}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Paper Types */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tip papira</label>
              <Popover open={paperTypesOpen} onOpenChange={setPaperTypesOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    {localFilters.paperTypes.length > 0
                      ? `${localFilters.paperTypes.length} izabrano`
                      : "Svi tipovi"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <ScrollArea className="h-[250px]">
                    <div className="p-4 space-y-2">
                      {paperTypes.map((paper) => (
                        <div key={paper.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`paper-${paper.id}`}
                            checked={localFilters.paperTypes.includes(paper.name)}
                            onCheckedChange={() => toggleArrayItem("paperTypes", paper.name)}
                          />
                          <label
                            htmlFor={`paper-${paper.id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {paper.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            {/* Sheet Formats */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Format tabaka</label>
              <Popover open={formatsOpen} onOpenChange={setFormatsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    {localFilters.sheetFormats.length > 0
                      ? localFilters.sheetFormats.join(", ")
                      : "Svi formati"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <div className="p-4 space-y-2">
                    {SHEET_FORMAT_OPTIONS.map((fmt) => (
                      <div key={fmt} className="flex items-center space-x-2">
                        <Checkbox
                          id={`format-${fmt}`}
                          checked={localFilters.sheetFormats.includes(fmt)}
                          onCheckedChange={() => toggleArrayItem("sheetFormats", fmt)}
                        />
                        <label
                          htmlFor={`format-${fmt}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {fmt}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end gap-2">
              <Button onClick={handleApply} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                Primeni
              </Button>
              <Button onClick={handleReset} variant="outline">
                Reset
              </Button>
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              {localFilters.clientIds.map((clientId) => {
                const client = clients.find((c) => c.id === clientId);
                return client ? (
                  <Badge key={clientId} variant="secondary" className="gap-1 pr-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    {client.name}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removeArrayItem("clientIds", clientId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ) : null;
              })}
              {localFilters.printSides.map((side) => (
                <Badge key={side} variant="secondary" className="gap-1 pr-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {side}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => removeArrayItem("printSides", side)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              {localFilters.paperTypes.map((paper) => (
                <Badge key={paper} variant="secondary" className="gap-1 pr-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {paper}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => removeArrayItem("paperTypes", paper)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              {localFilters.sheetFormats.map((fmt) => (
                <Badge key={fmt} variant="secondary" className="gap-1 pr-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {fmt}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => removeArrayItem("sheetFormats", fmt)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
