import { TableHead } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export type SortField = 'order_number' | 'client' | 'order_type' | 'quantity' | 'status' | 'created_by' | 'closed_by' | 'created_at';
export type SortDirection = 'asc' | 'desc';

interface SortableHeadProps {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}

export const SortableHead = ({ field, label, sortField, sortDirection, onSort, className = '' }: SortableHeadProps) => {
  const isActive = sortField === field;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors w-full"
      >
        {label}
        {isActive ? (
          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </button>
    </TableHead>
  );
};
