import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { billsAPI, categoriesAPI, reportsAPI } from "../services/api.js";
import { Button } from "../components/ui/button.jsx";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Download,
  RefreshCw,
} from "lucide-react";
import BillModal from "../components/BillModal.jsx";
import { toast } from "sonner";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import { useNavigate } from "react-router-dom";
import {
  buildRecurringBillOccurrences,
  buildRecurringNextOpenUpdatePayload,
  buildRecurringPaidCreatePayload,
  mergeAlertsWithRecurringBills,
  sumAlertValues,
} from "../lib/financeiroRecurringBills.js";

// Estilos para animação de pulsar
const pulseStyles = `
  @keyframes pulse-scale {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.2);
      opacity: 0.8;
    }
  }
  .animate-pulse-scale {
    animation: pulse-scale 1.5s ease-in-out infinite;
  }
`;

// Função auxiliar para formatar valores em reais
const formatCurrency = (value) => {
  if (value === null || value === undefined) return "R$ 0,00";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const formatDate = (value) => {
  if (!value) return "--";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "--";
  return parsedDate.toLocaleDateString("pt-BR");
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [bills, setBills] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [
        reportData,
        alertsData,
        categoriesData,
        personalBillsData,
        companyBillsData,
      ] = await Promise.all([
        reportsAPI.getDashboard(),
        reportsAPI.getAlerts(),
        categoriesAPI.getAll(),
        billsAPI.getAll({ bill_type: "personal" }),
        billsAPI.getAll({ bill_type: "company" }),
      ]);

      // Validar campos essenciais
      if (typeof reportData.bills_due_today === "undefined") {
        console.warn("Campo bills_due_today não encontrado na resposta");
      }

      setCategories(categoriesData);
      const nextBills = [
        ...(Array.isArray(personalBillsData) ? personalBillsData : []),
        ...(Array.isArray(companyBillsData) ? companyBillsData : []),
      ];
      const mergedFinanceAlerts = mergeAlertsWithRecurringBills(
        alertsData,
        nextBills,
      );

      setReport(reportData);
      setAlerts(mergedFinanceAlerts.alerts);
      setBills(mergedFinanceAlerts.bills);
      setLastUpdate(new Date());

      if (isRefresh) {
        toast.success("Dashboard atualizado!");
      }
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);

      if (error.response?.status === 403) {
        toast.error("Você não tem permissão para acessar esta funcionalidade");
        navigate("/");
      } else if (error.response?.status === 401) {
        toast.error("Sessão expirada. Faça login novamente.");
        navigate("/login");
      } else {
        toast.error("Erro ao carregar dados do dashboard");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchData(true);
  };

  const handleExport = async (format) => {
    try {
      const blob = await reportsAPI.export(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_contas.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Relatório ${format.toUpperCase()} exportado com sucesso!`);
    } catch (error) {
      toast.error("Erro ao exportar relatório");
    }
  };

  const handleRecurringStatusChange = async (bill) => {
    try {
      if (bill.isProjectedRecurring) {
        const createdBill = await billsAPI.create(
          buildRecurringPaidCreatePayload(bill),
        );

        if (createdBill?.id && createdBill.status !== "paid") {
          await billsAPI.updateStatus(createdBill.id, "paid");
        }
      } else {
        const paidBill = await billsAPI.create(
          buildRecurringPaidCreatePayload(bill),
        );

        if (paidBill?.id && paidBill.status !== "paid") {
          await billsAPI.updateStatus(paidBill.id, "paid");
        }

        await billsAPI.update(
          bill.id,
          buildRecurringNextOpenUpdatePayload(bill),
        );
        await billsAPI.updateStatus(bill.id, "open");
      }

      toast.success("Conta recorrente marcada como paga!");
      await fetchData(true);
    } catch (error) {
      toast.error("Erro ao marcar conta recorrente como paga");
    }
  };

  const urgentAlerts = alerts.filter(
    (a) => a.urgency === "red" || a.urgency === "yellow",
  );
  const redAlerts = alerts.filter((alert) => alert.urgency === "red");
  const yellowAlerts = alerts.filter((alert) => alert.urgency === "yellow");
  const greenAlerts = alerts.filter((alert) => alert.urgency === "green");
  const redAlertsTotal = sumAlertValues(redAlerts);
  const yellowAlertsTotal = sumAlertValues(yellowAlerts);
  const greenAlertsTotal = sumAlertValues(greenAlerts);
  const recurringBills = buildRecurringBillOccurrences(bills)
    .filter((bill) => bill.recorrente)
    .slice(0, 8);
  const recurringBillsSection = recurringBills.length > 0 && (
    <div
      className="bg-white rounded-xl shadow-md border border-purple-100 overflow-hidden mb-8"
      data-testid="dashboard-recurring-bills"
    >
      <div className="px-6 py-4 border-b border-purple-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Contas recorrentes
          </h2>
          <p className="text-sm text-gray-600">
            Pagas do mês atual e próximas em aberto
          </p>
        </div>
        <Button
          onClick={() => navigate("/financeiro/avisos")}
          variant="outline"
          className="border-green-300 text-green-700 hover:bg-green-50"
        >
          Ver nos avisos
        </Button>
      </div>
      <div className="divide-y divide-gray-100">
        {recurringBills.map((bill) => (
          <div
            key={bill.id}
            className="px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-gray-800 truncate">
                  {bill.name}
                </p>
                {bill.isProjectedRecurring && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                    Próximo mês
                  </span>
                )}
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    bill.status === "paid"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {bill.status === "paid" ? "Paga" : "Em aberto"}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {formatDate(bill.due_date)} ·{" "}
                {bill.bill_type === "company" ? "Empresarial" : "Particular"} ·{" "}
                {formatCurrency(Number(bill.value ?? bill.amount) || 0)}
              </p>
            </div>
            {bill.status !== "paid" && (
              <Button
                onClick={() => handleRecurringStatusChange(bill)}
                className="bg-green-600 hover:bg-green-700"
              >
                Marcar como paga
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

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
    <div className="min-h-screen flex flex-col app-container">
      <style>{pulseStyles}</style>
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
            <div>
              <h1
                className="text-4xl font-bold text-gray-800 mb-2"
                data-testid="page-title"
              >
                Dashboard
              </h1>
              <p className="text-gray-600">Visão geral das contas a pagar</p>
              <div className="flex items-center gap-4 mt-2">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2 transition-colors"
                  title="Atualizar dashboard"
                >
                  <RefreshCw
                    size={16}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  {refreshing ? "Atualizando..." : "Atualizar"}
                </button>
                <span className="text-xs text-gray-400">
                  Última atualização: {lastUpdate.toLocaleTimeString("pt-BR")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  onClick={() => navigate("/financeiro/contas/personal")}
                  variant="outline"
                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  Contas Particulares
                </Button>
                <Button
                  onClick={() => navigate("/financeiro/contas/company")}
                  variant="outline"
                  className="border-purple-300 text-purple-600 hover:bg-purple-50"
                >
                  Contas Empresariais
                </Button>
                <Button
                  onClick={() => navigate("/financeiro/avisos")}
                  variant="outline"
                  className="border-yellow-300 text-yellow-600 hover:bg-yellow-50"
                >
                  Avisos
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => setShowModal(true)}
                className="bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg btn-primary"
                data-testid="btn-add-bill"
              >
                <Plus size={20} className="mr-2" />
                Cadastrar Conta
              </Button>
              <Button
                onClick={() => handleExport("pdf")}
                variant="outline"
                className="border-purple-300 text-purple-600 hover:bg-purple-50"
                data-testid="btn-export-pdf"
              >
                <Download size={18} className="mr-2" />
                PDF
              </Button>
              <Button
                onClick={() => handleExport("excel")}
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
                data-testid="btn-export-excel"
              >
                <Download size={18} className="mr-2" />
                Excel
              </Button>
            </div>
          </div>

          {urgentAlerts.length > 0 && (
            <div
              className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg slide-in"
              data-testid="urgent-alerts-banner"
            >
              <div className="flex items-center">
                <AlertTriangle className="text-yellow-600 mr-3" size={24} />
                <div>
                  <p className="font-semibold text-yellow-800">
                    Atenção! Você tem {urgentAlerts.length} conta(s) próxima(s)
                    ao vencimento
                  </p>
                  <button
                    onClick={() => navigate("/financeiro/avisos")}
                    className="text-sm text-yellow-700 underline hover:text-yellow-900"
                    data-testid="link-view-alerts"
                  >
                    Ver todos os avisos
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div
              className="bg-white rounded-xl shadow-md p-6 border border-purple-100 card-hover"
              data-testid="card-total-paid"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="text-green-600" size={24} />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">
                Total Pago
              </h3>
              <p className="text-3xl font-bold text-gray-800">
                {formatCurrency(report?.total_paid)}
              </p>
            </div>

            <div
              className="bg-white rounded-xl shadow-md p-6 border border-purple-100 card-hover"
              data-testid="card-total-open"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <TrendingDown className="text-red-600" size={24} />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">
                Total em Aberto
              </h3>
              <p className="text-3xl font-bold text-gray-800">
                {formatCurrency(report?.total_open)}
              </p>
            </div>

            <div
              className="bg-white rounded-xl shadow-md p-6 border border-purple-100 card-hover"
              data-testid="card-upcoming"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Calendar className="text-yellow-600" size={24} />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">
                Próximos 7 Dias
              </h3>
              <p className="text-3xl font-bold text-gray-800">
                {report?.upcoming_bills}
              </p>
            </div>

            <div
              className="bg-white rounded-xl shadow-md p-6 border border-purple-100 card-hover"
              data-testid="card-overdue"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <AlertTriangle
                    className={`text-purple-600 ${report?.overdue_bills > 0 ? "animate-pulse-scale" : ""}`}
                    size={24}
                  />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">
                Atrasadas
              </h3>
              <p className="text-3xl font-bold text-gray-800">
                {report?.overdue_bills}
              </p>
            </div>
          </div>

          {/* Cards de Alertas de Contas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Contas urgentes */}
            <div
              className="bg-linear-to-br from-red-500 to-red-600 rounded-xl shadow-md p-6 text-white card-hover cursor-pointer"
              data-testid="card-due-today"
              title="Contas com status urgente"
              onClick={() => navigate("/financeiro/avisos")}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <AlertTriangle size={24} />
                </div>
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                  🔴 Urgente
                </span>
              </div>
              <h3 className="text-white text-sm font-medium mb-1 opacity-90">
                Contas Urgentes!
              </h3>
              <p className="text-4xl font-bold mb-2">
                {redAlerts.length} {redAlerts.length === 1 ? "conta" : "contas"}
              </p>
              <p className="text-sm opacity-80">
                Total: {formatCurrency(redAlertsTotal)}
              </p>
            </div>

            {/* Contas a pagar em 3 dias */}
            <div
              className="bg-linear-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-md p-6 text-white card-hover cursor-pointer"
              data-testid="card-due-3-days"
              title="Contas que vencem nos próximos 3 dias (status: Em Aberto)"
              onClick={() => navigate("/financeiro/avisos")}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <Calendar size={24} />
                </div>
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                  🟡 Atenção
                </span>
              </div>
              <h3 className="text-white text-sm font-medium mb-1 opacity-90">
                Contas a Pagar em 3 Dias!
              </h3>
              <p className="text-4xl font-bold mb-2">
                {yellowAlerts.length}{" "}
                {yellowAlerts.length === 1 ? "conta" : "contas"}
              </p>
              <p className="text-sm opacity-80">
                Total: {formatCurrency(yellowAlertsTotal)}
              </p>
            </div>

            {/* Contas em dia */}
            <div
              className="bg-linear-to-br from-green-500 to-green-600 rounded-xl shadow-md p-6 text-white card-hover"
              data-testid="card-up-to-date"
              title="Contas com vencimento futuro (após 3 dias, status: Em Aberto)"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <TrendingUp size={24} />
                </div>
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                  🟢 OK
                </span>
              </div>
              <h3 className="text-white text-sm font-medium mb-1 opacity-90">
                Contas em Dia
              </h3>
              <p className="text-4xl font-bold mb-2">
                {greenAlerts.length}{" "}
                {greenAlerts.length === 1 ? "conta" : "contas"}
              </p>
              <p className="text-sm opacity-80">
                Total: {formatCurrency(greenAlertsTotal)}
              </p>
            </div>
          </div>

          {recurringBillsSection}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div
              className="bg-white rounded-xl shadow-md p-6 border border-purple-100"
              data-testid="section-by-category"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Valor Pago por Categoria
              </h2>
              <div className="space-y-3">
                {report?.bills_by_category.length > 0 ? (
                  report.bills_by_category.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg"
                    >
                      <span className="font-medium text-gray-700">
                        {item.category}
                      </span>
                      <span className="text-purple-600 font-semibold">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    Nenhum pagamento realizado ainda
                  </p>
                )}
              </div>
            </div>

            <div
              className="bg-white rounded-xl shadow-md p-6 border border-purple-100"
              data-testid="section-by-date"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Datas com Mais Pagamentos
              </h2>
              <div className="space-y-3">
                {report?.bills_by_date.length > 0 ? (
                  report.bills_by_date.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                    >
                      <span className="font-medium text-gray-700">
                        {new Date(item.date).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="text-blue-600 font-semibold">
                        {item.count} pagamento(s)
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    Nenhum pagamento realizado ainda
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {showModal && (
        <BillModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            fetchData();
            setShowModal(false);
          }}
          categories={categories}
        />
      )}
    </div>
  );
}
