import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface KanbanColumnProps {
  title: string;
  count?: number;
  color?: "default" | "warning" | "success" | "destructive";
  children?: React.ReactNode;
}

const colorVariants = {
  default: "bg-muted text-muted-foreground",
  warning: "bg-warning/20 text-warning-foreground",
  success: "bg-success/20 text-success",
  destructive: "bg-destructive/20 text-destructive",
};

export function KanbanColumn({ title, count = 0, color = "default", children }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <Badge variant="secondary" className={colorVariants[color]}>
          {count}
        </Badge>
      </div>
      <div className="flex-1 space-y-3 min-h-[200px] p-3 rounded-lg bg-muted/50">
        {children || (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum item
          </p>
        )}
      </div>
    </div>
  );
}

interface KanbanCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: "default" | "warning" | "success" | "destructive";
}

export function KanbanCard({ title, subtitle, badge, badgeColor = "default" }: KanbanCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground text-sm">{title}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {badge && (
            <Badge variant="secondary" className={`text-xs ${colorVariants[badgeColor]}`}>
              {badge}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
