import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = 'default'
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'border-success/20 bg-gradient-to-br from-success/5 to-success/10';
      case 'warning':
        return 'border-warning/20 bg-gradient-to-br from-warning/5 to-warning/10';
      case 'danger':
        return 'border-danger/20 bg-gradient-to-br from-danger/5 to-danger/10';
      default:
        return 'border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10';
    }
  };

  const getIconStyles = () => {
    switch (variant) {
      case 'success':
        return 'text-success bg-success/10';
      case 'warning':
        return 'text-warning bg-warning/10';
      case 'danger':
        return 'text-danger bg-danger/10';
      default:
        return 'text-primary bg-primary/10';
    }
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-card ${getVariantStyles()}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${getIconStyles()}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="text-2xl font-bold">{value}</div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {trend && (
            <div className="flex items-center text-xs">
              <span className={trend.isPositive ? 'text-success' : 'text-danger'}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-muted-foreground ml-1">em relação ao mês anterior</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};