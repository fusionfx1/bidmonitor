import { AppProvider } from './context/AppContext';
import { HashRouter, Routes, Route } from './lib/router';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { Campaigns } from './pages/Campaigns';
import { Keywords } from './pages/Keywords';
import { SearchTerms } from './pages/SearchTerms';
import { AuctionSignals } from './pages/AuctionSignals';
import { PolicyIssues } from './pages/PolicyIssues';
import { BidDecisions } from './pages/BidDecisions';
import { AutoBidFeed } from './pages/AutoBidFeed';
import { NegativeCandidates } from './pages/NegativeCandidates';
import { HourDevice } from './pages/HourDevice';
import { VoluumMismatch } from './pages/VoluumMismatch';
import { VoluumLive } from './pages/VoluumLive';
import { ProfitDashboard } from './pages/ProfitDashboard';
import { BudgetOptimization } from './pages/BudgetOptimization';
import { NetworkReconciliation } from './pages/NetworkReconciliation';
import { CohortProfit } from './pages/CohortProfit';
import { CrossPlatformReconciliation } from './pages/CrossPlatformReconciliation';
import { ROIAnalysis } from './pages/ROIAnalysis';
import { UnmatchedRecords } from './pages/UnmatchedRecords';
import { Trends } from './pages/Trends';
import { AdvancedViews } from './pages/AdvancedViews';
import { PromptLibrary } from './pages/PromptLibrary';
import { SettingsPage } from './pages/Settings';
import { ImportData } from './pages/ImportData';
import { ExportPage } from './pages/ExportPage';
import { Diagnostics } from './pages/Diagnostics';

function App() {
  return (
    <HashRouter>
      <AppProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Overview />} exact />
            <Route path="/campaigns" element={<Campaigns />} exact />
            <Route path="/keywords" element={<Keywords />} exact />
            <Route path="/search-terms" element={<SearchTerms />} exact />
            <Route path="/auction-signals" element={<AuctionSignals />} exact />
            <Route path="/policy" element={<PolicyIssues />} exact />
            <Route path="/bid-decisions" element={<BidDecisions />} exact />
            <Route path="/auto-bid-feed" element={<AutoBidFeed />} exact />
            <Route path="/negatives" element={<NegativeCandidates />} exact />
            <Route path="/hour-device" element={<HourDevice />} exact />
            <Route path="/voluum" element={<VoluumMismatch />} exact />
            <Route path="/voluum-api" element={<VoluumLive />} exact />
            <Route path="/profit" element={<ProfitDashboard />} exact />
            <Route path="/budget" element={<BudgetOptimization />} exact />
            <Route path="/reconciliation" element={<NetworkReconciliation />} exact />
            <Route path="/cohort" element={<CohortProfit />} exact />
            <Route path="/cross-platform" element={<CrossPlatformReconciliation />} exact />
            <Route path="/roi" element={<ROIAnalysis />} exact />
            <Route path="/trends" element={<Trends />} exact />
            <Route path="/advanced" element={<AdvancedViews />} exact />
            <Route path="/prompts" element={<PromptLibrary />} exact />
            <Route path="/unmatched" element={<UnmatchedRecords />} exact />
            <Route path="/settings" element={<SettingsPage />} exact />
            <Route path="/import" element={<ImportData />} exact />
            <Route path="/export" element={<ExportPage />} exact />
            <Route path="/diagnostics" element={<Diagnostics />} exact />
          </Routes>
        </Layout>
      </AppProvider>
    </HashRouter>
  );
}

export default App;
