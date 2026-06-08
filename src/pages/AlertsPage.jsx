import React, { useState, useEffect, useRef } from "react";
import { billsAPI, reportsAPI } from "../services/api";
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Button } from "../components/ui/button";
import {
  buildRecurringPaidCreatePayload,
  mergeAlertsWithRecurringBills,
} from "../lib/financeiroRecurringBills";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAsPaid, setMarkingAsPaid] = useState(false);
  const [detailsModal, setDetailsModal] = useState({
    open: false,
    bill: null,
  });

  const redSectionRef = useRef(null);
  const yellowSectionRef = useRef(null);
  const greenSectionRef = useRef(null);

  const handleScrollToSection = (sectionRef) => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    fetchAlerts(true);
  }, []);

  const getAlertIdCandidates = (alert) =>
    [alert?.bill_id, alert?.billId, alert?.id].filter(
      (value) => value !== undefined && value !== null && value !== "",
    );

  const toNumber = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  };

  const normalizeDate = (value) => {
    if (!value) return "";
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return String(value).split("T")[0];
    }
    return parsedDate.toISOString().split("T")[0];
  };

  const isSameBill = (bill, alert) => {
    if (!bill || !alert) return false;

    const alertIds = getAlertIdCandidates(alert);
    if (
      bill.id !== undefined &&
      bill.id !== null &&
      alertIds.some((candidateId) => String(candidateId) === String(bill.id))
    ) {
      return true;
    }

    const billName = (bill.name || "").trim().toLowerCase();
    const alertName = (alert.account || "").trim().toLowerCase();
    if (!billName || !alertName || billName !== alertName) return false;

    const sameDate =
      normalizeDate(bill.due_date) === normalizeDate(alert.due_date);
    const billValue = toNumber(bill.value ?? bill.amount);
    const alertValue = toNumber(alert.value);
    const sameValue =
      billValue !== null && alertValue !== null
        ? Math.abs(billValue - alertValue) < 0.01
        : true;

    return sameDate && sameValue;
  };

  const formatMoney = (value) => {
    const numericValue = toNumber(value);
    return numericValue === null ? "--" : `R$ ${numericValue.toFixed(2)}`;
  };

  const formatDate = (value) => {
    if (!value) return "--";
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return "--";
    return parsedDate.toLocaleDateString("pt-BR");
  };

  const findBillForAlert = (alert, availableBills) => {
    const alertIds = getAlertIdCandidates(alert);
    const byId = availableBills.find((bill) =>
      alertIds.some((candidateId) => String(candidateId) === String(bill.id)),
    );

    if (byId) return byId;

    return availableBills.find((bill) => isSameBill(bill, alert)) || null;
  };

  const getAlertAccountName = (alert) => {
    const alertName = alert?.account || alert?.name;
    if (alertName) return alertName;

    const matchedBill = findBillForAlert(alert, bills);
    return matchedBill?.name || "Conta sem nome";
  };

  const buildFallbackBillFromAlert = (alert) => ({
    id: alert?.bill_id ?? alert?.billId ?? alert?.id ?? null,
    name: alert?.account || "Conta sem nome",
    category: alert?.category || "",
    city: alert?.city || "",
    due_date: alert?.due_date || null,
    value: alert?.value,
    status: alert?.status || "open",
    bill_type: alert?.bill_type || null,
  });

  const fetchAlerts = async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const [alertsResult, personalBillsResult, companyBillsResult] =
        await Promise.allSettled([
          reportsAPI.getAlerts(),
          billsAPI.getAll({ bill_type: "personal" }),
          billsAPI.getAll({ bill_type: "company" }),
        ]);

      if (alertsResult.status !== "fulfilled") {
        throw alertsResult.reason;
      }

      const alertData = Array.isArray(alertsResult.value)
        ? alertsResult.value
        : [];

      const nextBills = [];
      if (
        personalBillsResult.status === "fulfilled" &&
        Array.isArray(personalBillsResult.value)
      ) {
        nextBills.push(...personalBillsResult.value);
      }

      if (
        companyBillsResult.status === "fulfilled" &&
        Array.isArray(companyBillsResult.value)
      ) {
        nextBills.push(...companyBillsResult.value);
      }

      const mergedFinanceAlerts = mergeAlertsWithRecurringBills(
        alertData,
        nextBills,
      );

      setAlerts(mergedFinanceAlerts.alerts);
      setBills(mergedFinanceAlerts.bills);
    } catch (error) {
      toast.error("Erro ao carregar avisos");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const handleOpenBillDetails = (alert) => {
    const matchedBill = findBillForAlert(alert, bills);
    if (matchedBill) {
      setDetailsModal({ open: true, bill: matchedBill });
      return;
    }

    setDetailsModal({ open: true, bill: buildFallbackBillFromAlert(alert) });
    toast.info(
      "Exibindo dados do alerta. Alguns detalhes da conta podem não estar disponíveis.",
    );
  };

  const closeDetailsModal = () => {
    if (markingAsPaid) return;
    setDetailsModal({ open: false, bill: null });
  };

  const handleMarkAsPaid = async () => {
    const selectedBill = detailsModal.bill;
    const billId = selectedBill?.id;

    if (!billId || selectedBill?.status === "paid") {
      return;
    }

    try {
      setMarkingAsPaid(true);
      let updatedBill = { ...selectedBill, status: "paid" };

      if (selectedBill.isProjectedRecurring) {
        const createdBill = await billsAPI.create(
          buildRecurringPaidCreatePayload(selectedBill),
        );

        if (createdBill?.id && createdBill.status !== "paid") {
          await billsAPI.updateStatus(createdBill.id, "paid");
        }

        updatedBill = { ...selectedBill, ...createdBill, status: "paid" };
      } else {
        await billsAPI.updateStatus(billId, "paid");
      }

      setDetailsModal({ open: true, bill: updatedBill });

      setBills((currentBills) =>
        currentBills.map((bill) =>
          String(bill.id) === String(billId)
            ? { ...bill, status: "paid" }
            : bill,
        ),
      );

      setAlerts((currentAlerts) =>
        currentAlerts.map((alert) => {
          if (!isSameBill(updatedBill, alert)) {
            return alert;
          }

          return {
            ...alert,
            urgency: "green",
            days_until_due: Math.max(Number(alert.days_until_due) || 0, 0),
          };
        }),
      );

      toast.success("Conta marcada como paga!");
      await fetchAlerts();
    } catch (error) {
      toast.error("Erro ao marcar conta como paga");
    } finally {
      setMarkingAsPaid(false);
    }
  };

  const getUrgencyConfig = (urgency) => {
    switch (urgency) {
      case "red":
        return {
          color: "bg-red-50 border-red-200",
          iconBg: "bg-red-100",
          icon: AlertCircle,
          iconColor: "text-red-600",
          badge: "bg-red-500 text-white",
          label: "Urgente",
        };
      case "yellow":
        return {
          color: "bg-yellow-50 border-yellow-200",
          iconBg: "bg-yellow-100",
          icon: Clock,
          iconColor: "text-yellow-600",
          badge: "bg-yellow-500 text-white",
          label: "Atenção",
        };
      case "green":
        return {
          color: "bg-green-50 border-green-200",
          iconBg: "bg-green-100",
          icon: CheckCircle2,
          iconColor: "text-green-600",
          badge: "bg-green-500 text-white",
          label: "No Prazo",
        };
      default:
        return {
          color: "bg-gray-50 border-gray-200",
          iconBg: "bg-gray-100",
          icon: Clock,
          iconColor: "text-gray-600",
          badge: "bg-gray-500 text-white",
          label: "Normal",
        };
    }
  };

  const getDaysText = (days) => {
    if (days < 0) return `${Math.abs(days)} dia(s) atrasado`;
    if (days === 0) return "Vence hoje";
    if (days === 1) return "Vence amanhã";
    return `${days} dias para vencer`;
  };

  const getAlertStatusText = (alert) => {
    if (alert.status === "paid") return "Pago";
    return getDaysText(alert.days_until_due);
  };

  const redAlerts = alerts.filter((a) => a.urgency === "red");
  const yellowAlerts = alerts.filter((a) => a.urgency === "yellow");
  const greenAlerts = alerts.filter((a) => a.urgency === "green");

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
    <div className="min-h-screen flex flex-col app-container overflow-x-hidden">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 overflow-x-hidden">
        <div className="fade-in">
          <div className="mb-8">
            <h1
              className="text-4xl font-bold text-gray-800 mb-2"
              data-testid="page-title"
            >
              Avisos de Vencimento
            </h1>
            <p className="text-gray-600">
              Acompanhe as contas próximas ao vencimento
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div
              className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500 cursor-pointer"
              data-testid="summary-red"
              role="button"
              tabIndex={0}
              onClick={() => handleScrollToSection(redSectionRef)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleScrollToSection(redSectionRef);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Urgente (≤1 dia)</p>
                  <p className="text-3xl font-bold text-red-600">
                    {redAlerts.length}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertCircle className="text-red-600" size={28} />
                </div>
              </div>
            </div>

            <div
              className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500 cursor-pointer"
              data-testid="summary-yellow"
              role="button"
              tabIndex={0}
              onClick={() => handleScrollToSection(yellowSectionRef)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleScrollToSection(yellowSectionRef);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    Atenção (≤3 dias)
                  </p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {yellowAlerts.length}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock className="text-yellow-600" size={28} />
                </div>
              </div>
            </div>

            <div
              className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500 cursor-pointer"
              data-testid="summary-green"
              role="button"
              tabIndex={0}
              onClick={() => handleScrollToSection(greenSectionRef)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleScrollToSection(greenSectionRef);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    No Prazo (3 dias)
                  </p>
                  <p className="text-3xl font-bold text-green-600">
                    {greenAlerts.length}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle2 className="text-green-600" size={28} />
                </div>
              </div>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center border border-purple-100">
              <CheckCircle2 className="mx-auto text-green-500 mb-4" size={64} />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Nenhuma conta em aberto!
              </h2>
              <p className="text-gray-600">
                Todas as suas contas estão em dia.
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              <section ref={redSectionRef} className="space-y-4">
                <h2 className="text-xl font-semibold text-red-700">Urgente</h2>
                {redAlerts.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-md p-6 border border-red-100 text-gray-600">
                    Nenhuma conta urgente encontrada.
                  </div>
                ) : (
                  redAlerts.map((alert) => {
                    const config = getUrgencyConfig(alert.urgency);
                    const Icon = config.icon;
                    const accountName = getAlertAccountName(alert);

                    return (
                      <div
                        key={alert.id}
                        className={`bg-white rounded-xl shadow-md p-6 border-2 ${config.color} slide-in card-hover cursor-pointer`}
                        data-testid={`alert-${alert.urgency}-${alert.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenBillDetails(alert)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleOpenBillDetails(alert);
                          }
                        }}
                        title="Clique para ver informações da conta"
                      >
                        <div className="flex flex-wrap items-start gap-4">
                          <div
                            className={`p-3 rounded-lg ${config.iconBg} shrink-0`}
                          >
                            <Icon className={config.iconColor} size={24} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                              <div className="min-w-0">
                                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">
                                  Nome da Conta
                                </p>
                                <h3 className="text-lg font-bold text-blue-700 mb-1 wrap-break-word">
                                  {accountName}
                                </h3>
                              </div>
                              <span
                                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${config.badge}`}
                              >
                                {config.label}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-white/50 rounded-lg">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  Vencimento
                                </p>
                                <p className="font-semibold text-gray-800">
                                  {formatDate(alert.due_date)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  Valor
                                </p>
                                <p className="font-semibold text-gray-800">
                                  {formatMoney(alert.value)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  Status
                                </p>
                                <p
                                  className={`font-semibold ${config.iconColor}`}
                                >
                                  {getAlertStatusText(alert)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </section>

              <section ref={yellowSectionRef} className="space-y-4">
                <h2 className="text-xl font-semibold text-yellow-700">
                  Atenção
                </h2>
                {yellowAlerts.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-md p-6 border border-yellow-100 text-gray-600">
                    Nenhuma conta em atenção encontrada.
                  </div>
                ) : (
                  yellowAlerts.map((alert) => {
                    const config = getUrgencyConfig(alert.urgency);
                    const Icon = config.icon;
                    const accountName = getAlertAccountName(alert);

                    return (
                      <div
                        key={alert.id}
                        className={`bg-white rounded-xl shadow-md p-6 border-2 ${config.color} slide-in card-hover cursor-pointer`}
                        data-testid={`alert-${alert.urgency}-${alert.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenBillDetails(alert)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleOpenBillDetails(alert);
                          }
                        }}
                        title="Clique para ver informações da conta"
                      >
                        <div className="flex flex-wrap items-start gap-4">
                          <div
                            className={`p-3 rounded-lg ${config.iconBg} shrink-0`}
                          >
                            <Icon className={config.iconColor} size={24} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                              <div className="min-w-0">
                                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">
                                  Nome da Conta
                                </p>
                                <h3 className="text-lg font-bold text-blue-700 mb-1 wrap-break-word">
                                  {accountName}
                                </h3>
                              </div>
                              <span
                                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${config.badge}`}
                              >
                                {config.label}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-white/50 rounded-lg">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  Vencimento
                                </p>
                                <p className="font-semibold text-gray-800">
                                  {formatDate(alert.due_date)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  Valor
                                </p>
                                <p className="font-semibold text-gray-800">
                                  {formatMoney(alert.value)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  Status
                                </p>
                                <p
                                  className={`font-semibold ${config.iconColor}`}
                                >
                                  {getAlertStatusText(alert)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </section>

              <section ref={greenSectionRef} className="space-y-4">
                <h2 className="text-xl font-semibold text-green-700">
                  No Prazo
                </h2>
                {greenAlerts.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-md p-6 border border-green-100 text-gray-600">
                    Nenhuma conta no prazo encontrada.
                  </div>
                ) : (
                  greenAlerts.map((alert) => {
                    const config = getUrgencyConfig(alert.urgency);
                    const Icon = config.icon;
                    const accountName = getAlertAccountName(alert);

                    return (
                      <div
                        key={alert.id}
                        className={`bg-white rounded-xl shadow-md p-6 border-2 ${config.color} slide-in card-hover cursor-pointer`}
                        data-testid={`alert-${alert.urgency}-${alert.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenBillDetails(alert)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleOpenBillDetails(alert);
                          }
                        }}
                        title="Clique para ver informações da conta"
                      >
                        <div className="flex flex-wrap items-start gap-4">
                          <div
                            className={`p-3 rounded-lg ${config.iconBg} shrink-0`}
                          >
                            <Icon className={config.iconColor} size={24} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                              <div className="min-w-0">
                                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">
                                  Nome da Conta
                                </p>
                                <h3 className="text-lg font-bold text-blue-700 mb-1 wrap-break-word">
                                  {accountName}
                                </h3>
                              </div>
                              <span
                                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${config.badge}`}
                              >
                                {config.label}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-white/50 rounded-lg">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  Vencimento
                                </p>
                                <p className="font-semibold text-gray-800">
                                  {formatDate(alert.due_date)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  Valor
                                </p>
                                <p className="font-semibold text-gray-800">
                                  {formatMoney(alert.value)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  Status
                                </p>
                                <p
                                  className={`font-semibold ${config.iconColor}`}
                                >
                                  {getAlertStatusText(alert)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
            </div>
          )}

          {detailsModal.open && detailsModal.bill && (
            <div
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
              onClick={closeDetailsModal}
            >
              <div
                className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="sticky top-0 bg-linear-to-r from-purple-600 to-blue-600 text-white px-6 py-4 flex justify-between items-center rounded-t-xl">
                  <h2 className="text-2xl font-bold">Informações da Conta</h2>
                  <button
                    onClick={closeDetailsModal}
                    className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
                    title="Fechar"
                  >
                    ×
                  </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      Nome da Conta
                    </label>
                    <p className="text-xl font-bold text-gray-800 mt-1">
                      {detailsModal.bill.name || "--"}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      ID da Conta
                    </label>
                    <p className="text-sm font-mono text-gray-700 mt-1 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 inline-block break-all">
                      {detailsModal.bill.id || "--"}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      🔢 Número do Documento/Boleto
                    </label>
                    <p className="text-lg font-mono font-bold text-blue-600 mt-2 bg-blue-50 px-4 py-2 rounded-lg border-2 border-blue-200 inline-block">
                      {detailsModal.bill.numero || "--"}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      👤 Beneficiário
                    </label>
                    <p className="text-lg font-semibold text-blue-600 mt-1">
                      {detailsModal.bill.beneficiario || (
                        <span className="text-gray-400 italic">
                          Não informado
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      Valor
                    </label>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {formatMoney(
                        detailsModal.bill.value ?? detailsModal.bill.amount,
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      Vencimento
                    </label>
                    <p className="text-lg font-semibold text-gray-700 mt-1">
                      {formatDate(detailsModal.bill.due_date)}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      🔁 Recorrente
                    </label>
                    <div className="mt-1">
                      {detailsModal.bill.recorrente === true && (
                        <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                          ✅ Sim
                          {detailsModal.bill.due_date
                            ? ` - Repete todo mês no dia ${new Date(detailsModal.bill.due_date).getDate()}`
                            : ""}
                        </span>
                      )}

                      {detailsModal.bill.recorrente === false && (
                        <span className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                          ❌ Não
                        </span>
                      )}

                      {detailsModal.bill.recorrente !== true &&
                        detailsModal.bill.recorrente !== false && (
                          <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold">
                            Não informado
                          </span>
                        )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      Categoria
                    </label>
                    <p className="text-lg font-semibold text-gray-700 mt-1">
                      {detailsModal.bill.category || "--"}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      Cidade
                    </label>
                    <p className="text-lg font-semibold text-gray-700 mt-1">
                      {detailsModal.bill.city || "--"}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      Status
                    </label>
                    <div className="mt-1">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                          detailsModal.bill.status === "paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {detailsModal.bill.status === "paid"
                          ? "✅ Pago"
                          : "⏳ Pendente"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      🏢 Tipo
                    </label>
                    <p className="text-lg font-semibold text-gray-700 mt-1">
                      {detailsModal.bill.bill_type === "company" &&
                        "🏢 Empresarial"}
                      {detailsModal.bill.bill_type === "personal" &&
                        "👤 Pessoal"}
                      {detailsModal.bill.bill_type !== "company" &&
                        detailsModal.bill.bill_type !== "personal" && (
                          <span className="text-gray-400 italic">
                            Não informado
                          </span>
                        )}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      💳 Método de Pagamento
                    </label>
                    <p className="text-lg font-semibold text-gray-700 mt-1">
                      {detailsModal.bill.payment_method === "boleto" &&
                        "📄 Boleto"}
                      {detailsModal.bill.payment_method === "pix" && "💸 PIX"}
                      {detailsModal.bill.payment_method === "email" &&
                        "📧 Email"}
                      {detailsModal.bill.payment_method === "app" && "📱 App"}
                      {!detailsModal.bill.payment_method && (
                        <span className="text-gray-400 italic">
                          Não informado
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      📝 Detalhes de Pagamento
                    </label>
                    <p className="text-lg font-semibold text-gray-700 mt-1">
                      {detailsModal.bill.payment_details || (
                        <span className="text-gray-400 italic">
                          Não informado
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      📋 Boleto em Mãos
                    </label>
                    <p className="text-lg font-semibold text-gray-700 mt-1">
                      {detailsModal.bill.boleto_em_maos === true && "✅ Sim"}
                      {detailsModal.bill.boleto_em_maos === false && "❌ Não"}
                      {detailsModal.bill.boleto_em_maos !== true &&
                        detailsModal.bill.boleto_em_maos !== false && (
                          <span className="text-gray-400 italic">
                            Não informado
                          </span>
                        )}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      📝 Observações
                    </label>
                    <div className="mt-1 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {detailsModal.bill.observations || (
                          <span className="text-gray-400 italic">
                            Nenhuma observação registrada
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t rounded-b-xl flex flex-col sm:flex-row justify-end gap-3">
                  {detailsModal.bill.status !== "paid" && (
                    <Button
                      onClick={handleMarkAsPaid}
                      disabled={markingAsPaid || !detailsModal.bill.id}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {markingAsPaid ? "Marcando..." : "Marcar como pago"}
                    </Button>
                  )}

                  <Button
                    onClick={closeDetailsModal}
                    className="bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
