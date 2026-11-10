import { Navigate, Route, Routes } from 'react-router-dom';
import StockDashboard from './pages/DataWorkspace.jsx';
import AnalysisAdmin from './pages/AnalysisAdmin.jsx';

export default function App() {
  return <Routes>
    <Route path="/admin" element={<AnalysisAdmin />} />
    <Route path="/" element={<Navigate to="/directeur" replace />} />
    <Route path="/directeur/*" element={<StockDashboard />} />
    <Route path="*" element={<Navigate to="/directeur" replace />} />
  </Routes>;
}
