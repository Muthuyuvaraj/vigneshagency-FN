import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  variant?: "default" | "primary" | "warning" | "info";
}

const variantStyles = {
  default: "bg-card",
  primary: "bg-accent",
  warning: "bg-warning/10",
  info: "bg-info/10",
};

const iconStyles = {
  default: "text-muted-foreground bg-muted",
  primary: "text-primary bg-primary/10",
  warning: "text-warning bg-warning/10",
  info: "text-info bg-info/10",
};

const StatsCard = ({ icon: Icon, label, value, variant = "default" }: StatsCardProps) => {
  return (
    <div className={`rounded-xl p-4 border ${variantStyles[variant]}`}>
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${iconStyles[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
