import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import Header from '../components/Header';
import Footer from '../components/Footer.jsx';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const data = await reportsAPI.getAlerts();
      setAlerts(data);
    } catch (error) {
      toast.error('Erro ao carregar avisos');
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyConfig = (urgency) => {
    switch (urgency) {
      case 'red':
        return {
          color: 'bg-red-50 border-red-200',
          iconBg: 'bg-red-100',
          icon: AlertCircle,
          iconColor: 'text-red-600',
          badge: 'bg-red-500 text-white',
          label: 'Urgente'
        };
      case 'yellow':
        return {
          color: 'bg-yellow-50 border-yellow-200',
          iconBg: 'bg-yellow-100',
          icon: Clock,
          iconColor: 'text-yellow-600',
          badge: 'bg-yellow-500 text-white',
          label: 'Atenção'
        };
      case 'green':
        return {
          color: 'bg-green-50 border-green-200',
          iconBg: 'bg-green-100',
          icon: CheckCircle2,
          iconColor: 'text-green-600',
          badge: 'bg-green-500 text-white',
          label: 'No Prazo'
        };
      default:
        return {
          color: 'bg-gray-50 border-gray-200',
          iconBg: 'bg-gray-100',
          icon: Clock,
          iconColor: 'text-gray-600',
          badge: 'bg-gray-500 text-white',
          label: 'Desconhecido'
        };
    }
  };

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

  return (
    <div>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Avisos</h1>
        <div className="grid gap-4">
          {alerts.map((alert) => {
            const config = getUrgencyConfig(alert.urgency);
            const Icon = config.icon;
            return (
              <div key={alert.id} className={`border rounded-lg p-4 flex items-center gap-4 ${config.color}`}>
                <div className={`rounded-full p-2 ${config.iconBg}`}>
                  <Icon className={`w-6 h-6 ${config.iconColor}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${config.badge}`}>{config.label}</span>
                    <span className="text-sm text-gray-500">{alert.date}</span>
                  </div>
                  <div className="mt-1 text-gray-800 font-medium">{alert.title}</div>
                  <div className="text-gray-600 text-sm">{alert.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
