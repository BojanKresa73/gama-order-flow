import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PrioritySelectProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export const PrioritySelect = ({
  value,
  onChange,
  disabled = false,
  className,
}: PrioritySelectProps) => {
  const priorities = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const getPriorityColor = (p: number) => {
    if (p >= 8) return "text-red-600 font-bold";
    if (p >= 6) return "text-orange-600 font-semibold";
    if (p >= 4) return "text-yellow-600";
    return "text-green-600";
  };

  const getPriorityLabel = (p: number) => {
    if (p === 10) return "10 - Najhitnije";
    if (p === 9) return "9 - Kritično";
    if (p === 8) return "8 - Vrlo hitno";
    if (p === 7) return "7 - Hitno";
    if (p === 6) return "6 - Povišeno";
    if (p === 5) return "5 - Normalno";
    if (p === 4) return "4 - Sniženo";
    if (p === 3) return "3 - Nisko";
    if (p === 2) return "2 - Vrlo nisko";
    return "1 - Minimalno";
  };

  return (
    <Select
      value={value.toString()}
      onValueChange={(v) => onChange(parseInt(v, 10))}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-[160px]", className)}>
        <SelectValue>
          <span className={getPriorityColor(value)}>{value}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {priorities.map((p) => (
          <SelectItem key={p} value={p.toString()}>
            <span className={getPriorityColor(p)}>{getPriorityLabel(p)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
