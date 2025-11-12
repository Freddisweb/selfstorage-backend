import clsx from "clsx";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg" | "xl";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export default function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-full font-semibold transition-all " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants: Record<Variant, string> = {
    primary: "bg-brand-500 text-white hover:bg-brand-600 shadow-sm",
    outline: "border border-slate-300 text-slate-800 hover:bg-slate-50",
    ghost: "text-slate-700 hover:bg-slate-50",
  };

  const sizes: Record<Size, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    xl: "px-10 py-5 text-2xl sm:text-3xl", // für „Jetzt buchen!“
  };

  return (
    <button className={clsx(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}