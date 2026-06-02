import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.55),inset_0_-1px_0_0_hsl(220_15%_30%/0.18),0_1px_2px_-1px_hsl(220_20%_25%/0.25),0_2px_6px_-2px_hsl(220_20%_25%/0.20)]",
  {
    variants: {
      variant: {
        default: "border border-white/40 bg-gradient-to-b from-sky-400 to-sky-600 text-primary-foreground",
        secondary: "glass-surface-sm text-secondary-foreground",
        destructive: "border border-white/40 bg-gradient-to-b from-red-400 to-red-600 text-destructive-foreground",
        outline: "glass-surface-sm text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
