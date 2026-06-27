interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'default' | 'green' | 'red' | 'amber' | 'blue';
  icon?: React.ReactNode;
}

import type { ReactNode } from 'react';

const colorClasses: Record<NonNullable<KPICardProps['color']>, string> = {
  default: 'text-gray-900',
  green: 'text-emerald-600',
  red: 'text-red-600',
  amber: 'text-amber-600',
  blue: 'text-blue-600',
};

export function KPICard({ label, value, sub, color = 'default', icon }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <span className={`text-2xl font-bold leading-tight ${colorClasses[color]}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

interface ReactNodeKPICardProps extends Omit<KPICardProps, 'icon'> {
  icon?: ReactNode;
}

export type { ReactNodeKPICardProps };
