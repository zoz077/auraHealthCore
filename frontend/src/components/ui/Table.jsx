import React from 'react';

export function Table({ children, className = '', ...props }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-800/80 bg-[#0b0f19]/60">
      <table className={`w-full text-left text-xs border-collapse ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '', ...props }) {
  return (
    <thead className={`bg-slate-900/80 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px] tracking-wider select-none ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '', ...props }) {
  return (
    <tbody className={`divide-y divide-slate-800/60 text-slate-300 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '', hover = true, ...props }) {
  return (
    <tr
      className={`transition-colors duration-100 ${
        hover ? 'hover:bg-slate-800/40' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className = '', ...props }) {
  return (
    <th className={`py-3 px-3.5 font-semibold ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = '', ...props }) {
  return (
    <td className={`py-3 px-3.5 align-middle ${className}`} {...props}>
      {children}
    </td>
  );
}
