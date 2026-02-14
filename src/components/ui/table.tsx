// @ts-nocheck
import React from 'react';

export const Table = ({ children, ...props }: any) => (
  <div className="w-full overflow-auto rounded-card border border-gray-100 shadow-elevation-1">
    <table className="w-full border-collapse" {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader = ({ children, ...props }: any) => (
  <thead className="bg-surface-secondary border-b border-gray-100" {...props}>{children}</thead>
);

export const TableBody = ({ children, ...props }: any) => (
  <tbody className="divide-y divide-gray-50" {...props}>{children}</tbody>
);

export const TableRow = ({ children, ...props }: any) => (
  <tr className="bg-white transition-colors duration-fast hover:bg-primary-50/40" {...props}>
    {children}
  </tr>
);

export const TableHead = ({ children, ...props }: any) => (
  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider first:rounded-tl-card last:rounded-tr-card" {...props}>
    {children}
  </th>
);

export const TableCell = ({ children, ...props }: any) => (
  <td className="px-4 py-3.5 text-sm text-gray-700" {...props}>
    {children}
  </td>
);
