// @ts-nocheck
import React from 'react';

export const Textarea = React.forwardRef(({ className, ...props }: any, ref: any) => (
  <textarea
    ref={ref}
    className={`w-full px-4 py-3 text-sm text-gray-900 border border-gray-200 rounded-xl transition-all duration-200 resize-y min-h-[100px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50 ${className || ''}`}
    {...props}
  />
));

Textarea.displayName = 'Textarea';
