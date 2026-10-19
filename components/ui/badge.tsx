import { cn } from "@/lib/utils";
export function Badge({ children, className }: { children: React.ReactNode; className?: string }) { return <span className={cn("inline-flex items-center rounded-full bg-ink/6 px-2.5 py-1 text-xs font-medium text-ink/65", className)}>{children}</span>; }
