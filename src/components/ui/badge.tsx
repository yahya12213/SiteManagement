// @ts-nocheck
import React from 'react';

export const Badge = ({ children, variant = 'default', className = '', ...props }: any) => {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-700 border border-gray-200',
    secondary: 'bg-surface-secondary text-gray-600 border border-gray-200',
    destructive: 'bg-danger-50 text-danger-600 border border-danger-200',
    success: 'bg-success-50 text-success-600 border border-success-200',
    warning: 'bg-warning-50 text-warning-600 border border-warning-200',
    info: 'bg-primary-50 text-primary-600 border border-primary-200',
    outline: 'bg-white text-gray-700 border border-gray-300',
    primary: 'bg-primary-50 text-primary-700 border border-primary-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-badge transition-all duration-fast hover:shadow-elevation-1 ${variantClasses[variant] || variantClasses.default} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
