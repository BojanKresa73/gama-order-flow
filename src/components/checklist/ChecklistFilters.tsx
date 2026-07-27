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

interface Worker {
  id: string;
  name: string;
}

interface ChecklistFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  fileNameFilter?: string;
  onFileNameChange?: (value: string) => void;
  selectedClient: string;
  onClientChange: (value: string) => void;
  selectedFormat: string;
  onFormatChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  selectedInvoiceStatus: string;
  onInvoiceStatusChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  clients: string[];
  formats: string[];
  workers?: Worker[];
  selectedCreatedBy?: string;
  onCreatedByChange?: (value: string) => void;
  selectedClosedBy?: string;
  onClosedByChange?: (value: string) => void;
  onClearFilters: () => void;
  orderType: string;
}

const ChecklistFilters = ({
  searchTerm,
  onSearchChange,
  fileNameFilter = "",
  onFileNameChange,
  selectedClient,
  onClientChange,
  selectedFormat,
  onFormatChange,
  selectedStatus,
  onStatusChange,
  selectedInvoiceStatus,
  onInvoiceStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  clients,
  formats,
  workers = [],
  selectedCreatedBy = "all",
  onCreatedByChange,
  selectedClosedBy = "all",
  onClosedByChange,
  onClearFilters,
  orderType,
}: ChecklistFiltersProps) => {
  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

        <div>
          <label className="text-sm font-medium mb-2 block">Fakturisano</label>
          <Select value={selectedInvoiceStatus} onValueChange={onInvoiceStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="Sve" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Sve</SelectItem>
              <SelectItem value="invoiced">Fakturisano</SelectItem>
              <SelectItem value="not_invoiced">Nije fakturisano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

        {workers.length > 0 && onCreatedByChange && (
          <div>
            <label className="text-sm font-medium mb-2 block">Ko Otvorio</label>
            <Select value={selectedCreatedBy} onValueChange={onCreatedByChange}>
              <SelectTrigger>
                <SelectValue placeholder="Svi radnici" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi radnici</SelectItem>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {workers.length > 0 && onClosedByChange && (
          <div>
            <label className="text-sm font-medium mb-2 block">Ko Zatvorio</label>
            <Select value={selectedClosedBy} onValueChange={onClosedByChange}>
              <SelectTrigger>
                <SelectValue placeholder="Svi radnici" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi radnici</SelectItem>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.name}
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