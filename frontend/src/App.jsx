import { Navigate, Route, Routes } from 'react-router-dom';
import StockDashboard from './pages/DataWorkspace.jsx';
import AnalysisAdmin from './pages/AnalysisAdmin.jsx';

export default function App() {
  return <Routes>
    <Route path="/admin" element={<AnalysisAdmin />} />
    <Route path="/" element={<Navigate to="/directeur" replace />} />
    <Route path="/directeur/*" element={<StockDashboard key="dg" role="dg" />} />
    <Route path="/dc/*" element={<StockDashboard key="dc" role="dc" />} />
    <Route path="/supply-chain/*" element={<StockDashboard key="supply" role="supply" />} />
    <Route path="/am/*" element={<StockDashboard key="am" role="am" />} />
    <Route path="/it/*" element={<StockDashboard key="it" role="it" />} />
    <Route path="*" element={<Navigate to="/directeur" replace />} />
  </Routes>;
}
