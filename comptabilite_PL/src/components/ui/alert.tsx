// @ts-nocheck
// Minimal Alert stub
import React from 'react';

export const Alert = ({ children, variant = 'default', ...props }: any) => {
  const variantClasses = {
    default: 'bg-blue-50 border-blue-200 text-blue-800',
    destructive: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  };

  return (
    <div
      className={`p-4 border rounded-md ${variantClasses[variant] || variantClasses.default}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const AlertDescription = ({ children, ...props }: any) => (
  <div className="text-sm" {...props}>{children}</div>
);

export const AlertTitle = ({ children, ...props }: any) => (
  <h5 className="font-medium mb-1" {...props}>{children}</h5>
);
