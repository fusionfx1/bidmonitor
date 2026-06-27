import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple';
  size?: 'sm' | 'md';
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  green: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  red: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  amber: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  blue: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  gray: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
  purple: 'bg-violet-100 text-violet-800 ring-1 ring-violet-200',
};

export function Badge({ children, variant = 'gray', size = 'sm' }: BadgeProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}

export function ActionBadge({ action }: { action: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    INCREASE_BID: 'green',
    DECREASE_BID: 'amber',
    PAUSE_CANDIDATE: 'red',
    INCREASE_BUDGET_CANDIDATE: 'blue',
    HOLD: 'gray',
  };
  return <Badge variant={map[action] ?? 'gray'}>{action.replace(/_/g, ' ')}</Badge>;
}

export function ApprovalBadge({ status }: { status: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    APPROVED: 'green',
    REJECTED: 'red',
    WATCHLIST: 'amber',
    PENDING_REVIEW: 'blue',
  };
  return <Badge variant={map[status] ?? 'gray'}>{status.replace(/_/g, ' ')}</Badge>;
}

export function IssueLevelBadge({ level }: { level: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    CRITICAL: 'red',
    WARNING: 'amber',
    INFO: 'blue',
  };
  return <Badge variant={map[level] ?? 'gray'}>{level}</Badge>;
}

export function MismatchBadge({ flag }: { flag: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    TRACKING_MISMATCH: 'red',
    LOW_VISIT_CAPTURE: 'amber',
    CONVERSION_MISMATCH: 'amber',
    NO_VOLUUM_DATA: 'gray',
    OK: 'green',
  };
  return <Badge variant={map[flag] ?? 'gray'}>{flag.replace(/_/g, ' ')}</Badge>;
}

export function SignalBadge({ label }: { label: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    WINNER_RANK_LIMITED: 'amber',
    WINNER_BUDGET_LIMITED: 'blue',
    HIGH_POSITION_NO_CONV_REDUCE_BID_CANDIDATE: 'red',
    LOW_IS_RANK_LOST: 'amber',
    LOW_IS_BUDGET_LOST: 'blue',
    NO_CONV_RANK_LOST_DO_NOT_SCALE: 'red',
    HOLD_REVIEW: 'gray',
  };
  return <Badge variant={map[label] ?? 'gray'}>{label.replace(/_/g, ' ')}</Badge>;
}
