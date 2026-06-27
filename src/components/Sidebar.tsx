import { useMemo } from 'react';
import {
  LayoutDashboard, Target, Key, Search, TrendingUp,
  ShieldAlert, Gavel, MinusCircle, Clock, GitCompare,
  Settings, Upload, Download, Activity, DollarSign, CalendarDays,
  BarChart2, Link2, Stethoscope,
} from 'lucide-react';
import { NavLink } from '../lib/router';
import { useApp } from '../context/AppContext';
import { computeBidDecisions } from '../lib/decisionEngine/bidDecisions';
import { computeNegativeCandidates } from '../lib/decisionEngine/negativeCandidates';
import { computePolicyIssues } from '../lib/decisionEngine/policyIssues';
import { computeSyncHealth } from '../lib/syncHealth';
import type { FreshnessStatus } from '../lib/syncHealth';

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/campaigns', label: 'Campaigns', icon: Target },
  { to: '/keywords', label: 'Keywords', icon: Key },
  { to: '/search-terms', label: 'Search Terms', icon: Search },
  { to: '/auction-signals', label: 'Auction Signals', icon: TrendingUp },
  { to: '/policy', label: 'Policy Issues', icon: ShieldAlert, badge: 'policy' },
  { to: '/bid-decisions', label: 'Bid Decisions', icon: Gavel, badge: 'bids' },
  { to: '/negatives', label: 'Negatives', icon: MinusCircle, badge: 'negs' },
  { to: '/hour-device', label: 'Hour / Device', icon: Clock },
  { to: '/voluum-api', label: 'Voluum', icon: Activity },
  { to: '/voluum', label: 'Voluum Mismatch', icon: GitCompare },
  { to: '/profit', label: 'Profit Dashboard', icon: DollarSign },
  { to: '/reconciliation', label: 'TZ Reconciliation', icon: GitCompare },
  { to: '/cohort', label: 'Cohort Profit', icon: CalendarDays },
  { to: '/cross-platform', label: 'Cross-Platform', icon: GitCompare },
  { to: '/roi', label: 'ROI Analysis', icon: BarChart2 },
  { to: '/unmatched', label: 'Unmatched Records', icon: Link2 },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/import', label: 'Import Data', icon: Upload },
  { to: '/export', label: 'Export', icon: Download },
  { to: '/diagnostics', label: 'Diagnostics', icon: Stethoscope },
];

const FRESHNESS_DOT: Record<FreshnessStatus, { cls: string; title: string }> = {
  OK:      { cls: 'bg-emerald-400',  title: 'Script data is fresh' },
  STALE:   { cls: 'bg-amber-400',    title: 'Script data is stale (> 90m)' },
  ERROR:   { cls: 'bg-red-500',      title: 'Last script run failed' },
  UNKNOWN: { cls: 'bg-gray-500',     title: 'No script run log found' },
};

export function Sidebar() {
  const { data, settings, bidApprovals, negApprovals } = useApp();

  const policyCount = computePolicyIssues(data.policy).length;
  const bidPending = computeBidDecisions(
    data.keywords, data.auctionKeywords, data.auctionCampaigns, data.voluum, settings, bidApprovals
  ).filter((d) => d.action !== 'HOLD' && d.approval_status === 'PENDING_REVIEW').length;
  const negPending = computeNegativeCandidates(data.searchTerms, settings, negApprovals)
    .filter((n) => n.approval_status === 'PENDING_REVIEW').length;

  const badges: Record<string, number> = { policy: policyCount, bids: bidPending, negs: negPending };

  const freshnessStatus = useMemo(
    () => computeSyncHealth(data.syncLog).freshnessStatus,
    [data.syncLog]
  );
  const dot = FRESHNESS_DOT[freshnessStatus];

  return (
    <aside className="w-60 min-h-screen bg-gray-900 flex flex-col flex-shrink-0">
      <div className="px-5 py-5 border-b border-gray-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm leading-tight">BidMonitor</div>
            <div className="text-gray-400 text-xs flex items-center gap-1.5">
              Google Ads Dashboard
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot.cls}`}
                title={dot.title}
              />
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3">
        <ul className="space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, badge }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Icon size={16} className="flex-shrink-0" />
                  {label}
                </span>
                {badge && badges[badge] > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {badges[badge]}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-5 py-4 border-t border-gray-700/60">
        <p className="text-xs text-gray-600">Read-only monitoring. No bids are changed.</p>
      </div>
    </aside>
  );
}
