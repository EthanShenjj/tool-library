import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", {
  variants: {
    variant: {
      neutral: "bg-[#e8ebe6] text-[#596557]",
      blue: "bg-[#e7ebff] text-[#2949ba]",
      green: "bg-[#dff5e9] text-[#17623d]",
      amber: "bg-[#fff0c9] text-[#7a5710]",
      red: "bg-[#fbe5e5] text-[#943b3b]",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
