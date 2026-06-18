import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

type AccentColor = "green" | "blue" | "amber" | "purple" | "red" | "default";

const accentGradients: Record<AccentColor, string> = {
  green: "gradient-card-green",
  blue: "gradient-card-blue",
  amber: "gradient-card-amber",
  purple: "gradient-card-purple",
  red: "gradient-card-red",
  default: "",
};

const iconBgColors: Record<AccentColor, string> = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  default: "bg-muted text-muted-foreground",
};

interface TrendProps {
  value: number;
  isPositiveGood?: boolean;
}

function Trend({ value, isPositiveGood = true }: TrendProps) {
  const isUp = value > 0;
  const isDown = value < 0;
  const isGood = isPositiveGood ? isUp : isDown;
  const color = isGood ? "text-success" : isUp ? "text-destructive" : "text-success";

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", color)}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  accent?: AccentColor;
  trend?: number;
  trendPositiveGood?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  accent = "default",
  trend,
  trendPositiveGood,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-card p-6 transition-all duration-200 hover:shadow-card-hover",
        accentGradients[accent],
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          {trend !== undefined && (
            <Trend value={trend} isPositiveGood={trendPositiveGood} />
          )}
        </div>
        {Icon && (
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconBgColors[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export { Trend };
export type { AccentColor, StatCardProps };
