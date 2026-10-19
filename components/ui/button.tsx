import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variants = cva("inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: { primary: "bg-ink px-5 py-2.5 text-white shadow-sm hover:bg-ink/88", coral: "bg-coral px-5 py-2.5 text-white shadow-sm hover:bg-coral/90", outline: "border border-ink/15 bg-white px-5 py-2.5 text-ink hover:bg-sand", ghost: "px-3 py-2 text-ink/70 hover:bg-ink/5 hover:text-ink", danger: "bg-red-600 px-4 py-2 text-white hover:bg-red-700" },
    size: { default: "h-11", sm: "h-9 text-xs", lg: "h-13 px-7 text-base", icon: "size-10 p-0" },
  }, defaultVariants: { variant: "primary", size: "default" },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => <button ref={ref} className={cn(variants({ variant, size }), className)} {...props} />);
Button.displayName = "Button";
export { variants as buttonVariants };
