import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "../../frontend/src/pages/DashboardPage.jsx";
import BillsPage from "../../frontend/src/pages/BillsPage.jsx";
import AlertsPage from "../../frontend/src/pages/AlertsPage.jsx";
import LoginPage from "../../frontend/src/pages/LoginPage.jsx";

export default function FinanceiroRoutes() {
  return (
    <Routes>
      <Route path="" element={<DashboardPage />} />
      <Route path="contas/:type" element={<BillsPage />} />
      <Route path="avisos" element={<AlertsPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/financeiro" />} />
    </Routes>
  );
}
