import { useMemo, useState } from 'react';
import { Copy, Library, Search } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardBody, CardHeader } from '../components/Layout';
import { Badge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { buildPromptLibrary, type PromptCard, type PromptCategory } from '../lib/promptLibrary';

function categoryVariant(category: string): 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple' {
  const map: Record<string, 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple'> = {
    Strategy: 'purple',
    Optimization: 'green',
    Diagnostics: 'amber',
    Keywords: 'blue',
    Budget: 'green',
    Creative: 'gray',
  };
  return map[category] ?? 'gray';
}

export function PromptLibrary() {
  const { data, settings } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PromptCategory | 'All'>('All');
  const [selectedCardId, setSelectedCardId] = useState('smart_bidding');
  const [copied, setCopied] = useState(false);

  const model = useMemo(
    () => buildPromptLibrary(data, settings, selectedCardId, { query, category }),
    [category, data, query, selectedCardId, settings]
  );
  const selectedPrompt = model.generated?.prompt ?? '';

  const copyPrompt = async () => {
    if (!selectedPrompt) return;
    await navigator.clipboard.writeText(selectedPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Insights Prompt Library"
        description="Searchable prompt-card library for context-rich, metric-cited, safety-constrained AI drafts. Not a chat box; never applies actions."
        actions={(
          <button
            onClick={() => void copyPrompt()}
            disabled={!selectedPrompt}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Copy size={14} />
            {copied ? 'Copied' : 'Copy Prompt'}
          </button>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader title="Find prompt cards" actions={<Search size={16} className="text-gray-400" />} />
            <CardBody>
              <div className="space-y-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search prompt cards..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as PromptCategory | 'All')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {model.categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </CardBody>
          </Card>

          <div className="space-y-3">
            {model.cards.map((card) => (
              <PromptCardButton
                key={card.id}
                card={card}
                selected={card.id === model.generated?.card.id}
                onClick={() => setSelectedCardId(card.id)}
              />
            ))}
            {model.cards.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-400 text-center">
                No prompt cards match this filter.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Cards" value={String(model.cards.length)} />
            <Kpi label="Freshness" value={model.freshness} />
            <Kpi label="Mode" value={settings.action_mode} />
            <Kpi label="Safety" value="Draft only" />
          </div>

          {model.generated && (
            <Card>
              <CardHeader
                title={model.generated.card.title}
                actions={<Badge variant={categoryVariant(model.generated.card.category)}>{model.generated.card.category}</Badge>}
              />
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <InfoBlock label="Required sources" value={model.generated.card.requiredSources.join(', ')} />
                  <InfoBlock label="Answers" value={model.generated.card.answers} />
                  <InfoBlock label="Account context" value={model.accountContext} />
                  <InfoBlock label="Safety constraints" value={`${model.generated.safetyConstraints.length} injected`} />
                </div>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Metric citations</h3>
                  <div className="space-y-2">
                    {model.generated.metricCitations.map((citation) => (
                      <div key={citation} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600">
                        {citation}
                      </div>
                    ))}
                  </div>
                </div>
                <textarea
                  readOnly
                  value={selectedPrompt}
                  className="w-full min-h-[360px] border border-gray-200 rounded-xl p-4 text-xs font-mono text-gray-700 bg-gray-50"
                />
              </CardBody>
            </Card>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 flex gap-2">
            <Library size={16} className="flex-shrink-0" />
            Prompts can analyze and recommend only from supplied metrics. They must cite metric IDs and must not produce live apply instructions.
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function PromptCardButton({ card, selected, onClick }: { card: PromptCard; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border rounded-xl p-4 transition-colors ${
        selected ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-sm text-gray-900">{card.title}</div>
          <div className="text-xs text-gray-500 mt-1">{card.answers}</div>
        </div>
        <Badge variant={categoryVariant(card.category)}>{card.category}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {card.requiredSources.slice(0, 3).map((source) => <Badge key={source}>{source}</Badge>)}
      </div>
    </button>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold text-gray-900 truncate">{value}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-800">{value}</div>
    </div>
  );
}
