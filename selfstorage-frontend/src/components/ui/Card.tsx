import { cn } from "../../utils/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export default function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white/90 shadow-sm p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}