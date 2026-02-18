import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { reportsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Plus, TrendingUp, TrendingDown, AlertTriangle, Calendar, Download } from 'lucide-react';
import BillModal from '../components/BillModal';
import { categoriesAPI } from '../services/api';
import { toast } from 'sonner';
import Header from '../components/Header';
import Footer from '../components/Footer.jsx';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  // ...restante do código do DashboardPage.js...
  const [loading, setLoading] = useState(true);
  // ...
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }
  // ...restante do JSX...
  return (
    <div>
      <Header />
      {/* ...restante do dashboard... */}
      <Footer />
    </div>
  );
}
