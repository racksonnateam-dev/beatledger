import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white shadow-sm hover:bg-violet-500",
        secondary: "border border-white/10 bg-white/5 text-white hover:bg-white/10",
        ghost: "text-zinc-300 hover:bg-white/5 hover:text-white",
        danger: "border border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/20",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
