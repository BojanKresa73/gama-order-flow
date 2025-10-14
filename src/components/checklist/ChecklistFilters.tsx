import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface ChecklistFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedClient: string;
  onClientChange: (value: string) => void;
  selectedFormat: string;
  onFormatChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  clients: string[];
  formats: string[];
  onClearFilters: () => void;
  orderType: string;
}

const ChecklistFilters = ({
  searchTerm,
  onSearchChange,
  selectedClient,
  onClientChange,
  selectedFormat,
  onFormatChange,
  selectedStatus,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  clients,
  formats,
  onClearFilters,
  orderType,
}: ChecklistFiltersProps) => {
  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">
            Pretraga po broju naloga ili fajlu
          </label>
          <Input
            placeholder="Pretraži..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Klijent</label>
          <Select value={selectedClient} onValueChange={onClientChange}>
            <SelectTrigger>
              <SelectValue placeholder="Svi klijenti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi klijenti</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Status</label>
          <Select value={selectedStatus} onValueChange={onStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="Svi statusi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi statusi</SelectItem>
              <SelectItem value="open">Otvoreni</SelectItem>
              <SelectItem value="closed">Zatvoreni</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {orderType === "ctp" && (
          <div>
            <label className="text-sm font-medium mb-2 block">
              Format Ploča
            </label>
            <Select value={selectedFormat} onValueChange={onFormatChange}>
              <SelectTrigger>
                <SelectValue placeholder="Svi formati" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi formati</SelectItem>
                {formats.map((format) => (
                  <SelectItem key={format} value={format}>
                    {format}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">
            Datum Od
          </label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Datum Do
          </label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Obriši Filtere
        </Button>
      </div>
    </div>
  );
};

export default ChecklistFilters;
