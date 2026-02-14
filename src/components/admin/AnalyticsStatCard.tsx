import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface AnalyticsStatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  colorClass?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export const AnalyticsStatCard: React.FC<AnalyticsStatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass = 'bg-blue-500',
  trend,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`${colorClass} p-3 rounded-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        {trend && (
          <span
            className={`text-sm font-medium ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};
