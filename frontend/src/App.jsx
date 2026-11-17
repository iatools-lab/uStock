import { Navigate, Route, Routes } from "react-router-dom";
import StockDashboard from "./pages/DataWorkspace.jsx";
import AnalysisAdmin from "./pages/AnalysisAdmin.jsx";
import SupplyWorkspace from "./pages/SupplyWorkspace.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AnalysisAdmin />} />
      <Route
        path="/area-manager/*"
        element={<SupplyWorkspace key="am" role="am" />}
      />
      <Route
        path="/commercial/*"
        element={<SupplyWorkspace key="commercial" role="commercial" />}
      />
      <Route
        path="/supply-chain/*"
        element={<SupplyWorkspace key="supply" role="supply" />}
      />
      <Route path="/" element={<Navigate to="/directeur" replace />} />
      <Route path="/directeur/*" element={<StockDashboard />} />
      <Route path="*" element={<Navigate to="/directeur" replace />} />
    </Routes>
  );
}
