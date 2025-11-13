import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, X } from "lucide-react";

export interface ClientFilters {
  search: string;
  grad: string;
  pibFilter: "all" | "with" | "without";
  rokPlacanjaMin: number;
  rokPlacanjaMax: number;
  rabatMin: number;
  rabatMax: number;
  onlyVip: boolean;
  onlyBlocked: boolean;
  segment: "all" | "novi" | "redovan" | "premium";
}

interface ClientsFiltersProps {
  cities: string[];
  onFiltersChange: (filters: ClientFilters) => void;
}

export const ClientsFilters = ({ cities, onFiltersChange }: ClientsFiltersProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  // Initialize filters from URL
  const [filters, setFilters] = useState<ClientFilters>({
    search: searchParams.get("search") || "",
    grad: searchParams.get("grad") || "",
    pibFilter: (searchParams.get("pibFilter") as ClientFilters["pibFilter"]) || "all",
    rokPlacanjaMin: parseInt(searchParams.get("rokMin") || "0"),
    rokPlacanjaMax: parseInt(searchParams.get("rokMax") || "120"),
    rabatMin: parseInt(searchParams.get("rabatMin") || "0"),
    rabatMax: parseInt(searchParams.get("rabatMax") || "100"),
    onlyVip: searchParams.get("onlyVip") === "true",
    onlyBlocked: searchParams.get("onlyBlocked") === "true",
    segment: (searchParams.get("segment") as ClientFilters["segment"]) || "all",
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (filters.search) params.set("search", filters.search);
    if (filters.grad) params.set("grad", filters.grad);
    if (filters.pibFilter !== "all") params.set("pibFilter", filters.pibFilter);
    if (filters.rokPlacanjaMin > 0) params.set("rokMin", filters.rokPlacanjaMin.toString());
    if (filters.rokPlacanjaMax < 120) params.set("rokMax", filters.rokPlacanjaMax.toString());
    if (filters.rabatMin > 0) params.set("rabatMin", filters.rabatMin.toString());
    if (filters.rabatMax < 100) params.set("rabatMax", filters.rabatMax.toString());
    if (filters.onlyVip) params.set("onlyVip", "true");
    if (filters.onlyBlocked) params.set("onlyBlocked", "true");
    if (filters.segment !== "all") params.set("segment", filters.segment);

    setSearchParams(params, { replace: true });
    onFiltersChange(filters);
  }, [filters, setSearchParams, onFiltersChange]);

  const handleApply = () => {
    onFiltersChange(filters);
  };

  const handleReset = () => {
    const defaultFilters: ClientFilters = {
      search: "",
      grad: "",
      pibFilter: "all",
      rokPlacanjaMin: 0,
      rokPlacanjaMax: 120,
      rabatMin: 0,
      rabatMax: 100,
      onlyVip: false,
      onlyBlocked: false,
      segment: "all",
    };
    setSearchInput("");
    setFilters(defaultFilters);
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = 
    filters.search || 
    filters.grad || 
    filters.pibFilter !== "all" ||
    filters.rokPlacanjaMin > 0 ||
    filters.rokPlacanjaMax < 120 ||
    filters.rabatMin > 0 ||
    filters.rabatMax < 100 ||
    filters.onlyVip ||
    filters.onlyBlocked ||
    filters.segment !== "all";

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Filteri</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="ml-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Resetuj
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="search">Pretraga</Label>
              <Input
                id="search"
                placeholder="Naziv, PIB, Email, Grad, Telefon..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            {/* Grad */}
            <div className="space-y-2">
              <Label htmlFor="grad">Grad</Label>
              <Select
                value={filters.grad}
                onValueChange={(value) => setFilters({ ...filters, grad: value })}
              >
                <SelectTrigger id="grad">
                  <SelectValue placeholder="Svi gradovi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Svi</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* PIB Filter */}
            <div className="space-y-2">
              <Label htmlFor="pib-filter">Ima PIB</Label>
              <Select
                value={filters.pibFilter}
                onValueChange={(value: ClientFilters["pibFilter"]) =>
                  setFilters({ ...filters, pibFilter: value })
                }
              >
                <SelectTrigger id="pib-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi</SelectItem>
                  <SelectItem value="with">Samo sa PIB</SelectItem>
                  <SelectItem value="without">Samo bez PIB</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rok plaćanja range */}
            <div className="space-y-2">
              <Label>
                Rok plaćanja: {filters.rokPlacanjaMin}-{filters.rokPlacanjaMax} dana
              </Label>
              <div className="pt-2">
                <Slider
                  min={0}
                  max={120}
                  step={5}
                  value={[filters.rokPlacanjaMin, filters.rokPlacanjaMax]}
                  onValueChange={([min, max]) =>
                    setFilters({ ...filters, rokPlacanjaMin: min, rokPlacanjaMax: max })
                  }
                  className="w-full"
                />
              </div>
            </div>

            {/* Rabat range */}
            <div className="space-y-2">
              <Label>
                Rabat: {filters.rabatMin}-{filters.rabatMax}%
              </Label>
              <div className="pt-2">
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[filters.rabatMin, filters.rabatMax]}
                  onValueChange={([min, max]) =>
                    setFilters({ ...filters, rabatMin: min, rabatMax: max })
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* New row for status filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            {/* VIP Switch */}
            <div className="flex items-center space-x-2">
              <Switch
                id="only-vip"
                checked={filters.onlyVip}
                onCheckedChange={(checked) => setFilters({ ...filters, onlyVip: checked })}
              />
              <Label htmlFor="only-vip" className="cursor-pointer">Samo VIP</Label>
            </div>

            {/* Blocked Switch */}
            <div className="flex items-center space-x-2">
              <Switch
                id="only-blocked"
                checked={filters.onlyBlocked}
                onCheckedChange={(checked) => setFilters({ ...filters, onlyBlocked: checked })}
              />
              <Label htmlFor="only-blocked" className="cursor-pointer">Samo blokirani</Label>
            </div>

            {/* Segment Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="segment">Segment</Label>
              <Select
                value={filters.segment}
                onValueChange={(value: ClientFilters["segment"]) =>
                  setFilters({ ...filters, segment: value })
                }
              >
                <SelectTrigger id="segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Svi</SelectItem>
                  <SelectItem value="novi">Novi</SelectItem>
                  <SelectItem value="redovan">Redovan</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApply} size="sm">
              Primeni
            </Button>
            <Button onClick={handleReset} variant="outline" size="sm">
              Resetuj
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
