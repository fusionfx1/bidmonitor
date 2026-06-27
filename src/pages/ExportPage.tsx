import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardBody } from '../components/Layout';
import { useApp } from '../context/AppContext';
import { computeBidDecisions } from '../lib/decisionEngine/bidDecisions';
import { computeNegativeCandidates } from '../lib/decisionEngine/negativeCandidates';
import { computePolicyIssues } from '../lib/decisionEngine/policyIssues';
import { exportBidDecisionsCSV, exportNegativeCandidatesCSV, exportPolicyIssuesCSV, exportDashboardSummaryJSON } from '../lib/export';
import { sumField } from '../lib/metrics/calculations';

export function ExportPage() {
  const { data, settings, bidApprovals, negApprovals } = useApp();

  const bidDecisions = useMemo(
    () => computeBidDecisions(data.keywords, data.auctionKeywords, data.auctionCampaigns, data.voluum, settings, bidApprovals),
    [data, settings, bidApprovals]
  );

  const negCandidates = useMemo(
    () => computeNegativeCandidates(data.searchTerms, settings, negApprovals),
    [data.searchTerms, settings, negApprovals]
  );

  const policyIssues = useMemo(
    () => computePolicyIssues(data.policy),
    [data.policy]
  );

  const handleExportSummary = () => {
    const totalSpend = sumField(data.campaigns, 'cost');
    const googleConversions = sumField(data.campaigns, 'conversions');
    const revenue = data.voluum.length > 0
      ? sumField(data.voluum, 'revenue')
      : sumField(data.campaigns, 'conversion_value');

    exportDashboardSummaryJSON({
      exportedAt: new Date().toISOString(),
      settings,
      kpis: {
        totalSpend,
        googleConversions,
        revenue,
        profit: revenue - totalSpend,
        bidDecisionsCount: bidDecisions.length,
        negativeCandidatesCount: negCandidates.length,
        policyIssuesCount: policyIssues.length,
      },
      bidDecisions,
      negativeCandidates: negCandidates,
      policyIssues,
    });
  };

  const exports = [
    {
      title: 'Bid Decisions CSV',
      description: `${bidDecisions.length} decisions including recommended bids and actions`,
      count: bidDecisions.length,
      onClick: () => exportBidDecisionsCSV(bidDecisions),
      disabled: bidDecisions.length === 0,
    },
    {
      title: 'Negative Candidates CSV',
      description: `${negCandidates.length} search terms recommended for negative keywords`,
      count: negCandidates.length,
      onClick: () => exportNegativeCandidatesCSV(negCandidates),
      disabled: negCandidates.length === 0,
    },
    {
      title: 'Policy Issues CSV',
      description: `${policyIssues.length} policy and approval issues`,
      count: policyIssues.length,
      onClick: () => exportPolicyIssuesCSV(policyIssues),
      disabled: policyIssues.length === 0,
    },
    {
      title: 'Dashboard Summary JSON',
      description: 'Full summary including all recommendations and KPIs',
      count: null,
      onClick: handleExportSummary,
      disabled: data.campaigns.length === 0,
    },
  ];

  return (
    <PageContainer>
      <PageHeader title="Export" description="Download decision files for review and upload" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exports.map((exp) => (
          <Card key={exp.title}>
            <CardBody>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{exp.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{exp.description}</p>
                </div>
                {exp.count !== null && (
                  <span className="text-2xl font-bold text-gray-800">{exp.count}</span>
                )}
              </div>
              <button
                onClick={exp.onClick}
                disabled={exp.disabled}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Download size={14} />
                Download
              </button>
            </CardBody>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
