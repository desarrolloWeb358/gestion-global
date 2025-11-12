import { cn } from "@/shared/lib/cn";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outlined' | 'elevated';
}

export function Card({ children, className, variant = 'default' }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-brand-secondary/30 bg-white/60 p-4 md:p-5",
        variant === 'elevated' && "shadow-lg",
        variant === 'outlined' && "border-2",
        className
      )}
    >
      {children}
    </div>
  );
}