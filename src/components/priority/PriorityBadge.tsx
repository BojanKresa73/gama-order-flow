import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export const PriorityBadge = ({
  priority,
  size = "md",
  showLabel = false,
  className,
}: PriorityBadgeProps) => {
  const getPriorityColor = () => {
    if (priority >= 8) return "bg-red-500 hover:bg-red-600 text-white";
    if (priority >= 6) return "bg-orange-500 hover:bg-orange-600 text-white";
    if (priority >= 4) return "bg-yellow-500 hover:bg-yellow-600 text-black";
    return "bg-green-500 hover:bg-green-600 text-white";
  };

  const getPriorityLabel = () => {
    if (priority >= 9) return "Kritično";
    if (priority >= 7) return "Hitno";
    if (priority >= 5) return "Normalno";
    if (priority >= 3) return "Nisko";
    return "Minimalno";
  };

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <Badge
      className={cn(
        getPriorityColor(),
        sizeClasses[size],
        "font-bold",
        className
      )}
    >
      {priority}
      {showLabel && <span className="ml-1 font-normal">({getPriorityLabel()})</span>}
    </Badge>
  );
};
