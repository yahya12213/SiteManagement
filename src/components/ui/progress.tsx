// @ts-nocheck
// Minimal Progress stub
import React from 'react';

export const Progress = ({ value = 0, max = 100, ...props }: any) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden" {...props}>
      <div
        className="h-full bg-blue-600 transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};
