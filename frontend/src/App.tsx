import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CKSAnalyses from './pages/CKSAnalyses';
import RiskMap from './pages/RiskMap';
import AIOpportunities from './pages/AIOpportunities';
import CreditApplications from './pages/CreditApplications';
import MarketSettings from './pages/MarketSettings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="cks-analizleri" element={<CKSAnalyses />} />
          <Route path="risk-haritasi" element={<RiskMap />} />
          <Route path="ai-firsatlari" element={<AIOpportunities />} />
          <Route path="kredi-basvurulari" element={<CreditApplications />} />
          <Route path="piyasa-ayarlari" element={<MarketSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
