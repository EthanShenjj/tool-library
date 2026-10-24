import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[10px] border border-[#d7ddd5] bg-white px-3 text-sm text-[#18212f] outline-none placeholder:text-[#8a9587] focus:border-[#3156d8] focus:ring-3 focus:ring-[#3156d8]/12 disabled:bg-[#eef1ec]",
        className,
      )}
      {...props}
    />
  );
}
