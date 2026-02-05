import { cn } from "@/lib/utils";

interface InProgressIndicatorProps {
  className?: string;
}

/**
 * Blinking red 3D dot indicator showing that a work order is currently in progress
 * (has at least one closed file while others remain open)
 */
export const InProgressIndicator = ({ className }: InProgressIndicatorProps) => {
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      {/* Outer glow ring - animated pulse */}
      <span className="absolute inline-flex h-4 w-4 rounded-full bg-red-400 opacity-75 animate-ping" />
      
      {/* Inner 3D dot */}
      <span 
        className="relative inline-flex h-3 w-3 rounded-full"
        style={{
          background: "radial-gradient(circle at 30% 30%, #ff6b6b, #dc2626 50%, #991b1b)",
          boxShadow: "0 2px 4px rgba(220, 38, 38, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
        }}
      />
    </div>
  );
};
