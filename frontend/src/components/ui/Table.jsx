import React from 'react';

export function Table({ children, className = '', ...props }) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm shadow-sm">
      <table className={`w-full text-left text-xs border-collapse ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '', ...props }) {
  return (
    <thead className={`bg-slate-50/90 border-b border-slate-100 text-slate-500 uppercase text-[11px] font-semibold tracking-wider select-none ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '', ...props }) {
  return (
    <tbody className={`divide-y divide-slate-100 text-slate-700 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '', hover = true, ...props }) {
  return (
    <tr
      className={`transition-colors duration-100 ${
        hover ? 'hover:bg-cyan-50/40' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className = '', ...props }) {
  return (
    <th className={`py-3.5 px-4 font-semibold text-slate-600 ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = '', ...props }) {
  return (
    <td className={`py-3 px-4 align-middle text-slate-700 ${className}`} {...props}>
      {children}
    </td>
  );
}
