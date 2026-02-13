import React from 'react';
import { CheckCircle } from 'lucide-react';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  showPercentage = true,
  size = 'md',
  color = 'blue',
}) => {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const isComplete = clampedProgress >= 100;

  // Size classes
  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  // Color classes
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    purple: 'bg-purple-600',
    orange: 'bg-orange-600',
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-sm font-medium text-gray-700">{label}</span>
          )}
          {showPercentage && (
            <div className="flex items-center gap-1.5">
              {isComplete && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              <span className={`text-sm font-semibold ${
                isComplete ? 'text-green-600' : 'text-gray-600'
              }`}>
                {Math.round(clampedProgress)}%
              </span>
            </div>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${heightClasses[size]}`}>
        <div
          className={`${heightClasses[size]} ${colorClasses[color]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

interface ProgressStatsProps {
  completed: number;
  total: number;
  label: string;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

export const ProgressStats: React.FC<ProgressStatsProps> = ({
  completed,
  total,
  label,
  color = 'blue',
}) => {
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium text-gray-900">
          {completed}/{total}
        </span>
      </div>
      <ProgressBar progress={progress} showPercentage={false} color={color} />
    </div>
  );
};
