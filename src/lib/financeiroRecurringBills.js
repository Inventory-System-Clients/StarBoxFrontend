export const parseLocalDate = (dateValue) => {
  if (!dateValue) return null;
  const [year, month, day] = String(dateValue).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getMonthKey = (dateValue) => {
  const date = parseLocalDate(dateValue);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const addMonthsKeepingDay = (dateValue, monthsToAdd) => {
  const date = parseLocalDate(dateValue);
  if (!date) return dateValue;
  const originalDay = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + monthsToAdd, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(originalDay, lastDay));
  return formatDateInput(target);
};

export const getRecurringKey = (bill) =>
  [
    bill.bill_type,
    bill.name,
    bill.numero,
    bill.beneficiario,
    bill.category,
    bill.city,
    bill.value ?? bill.amount,
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");

export const buildRecurringBillOccurrences = (sourceBills) => {
  const bills = Array.isArray(sourceBills) ? sourceBills : [];
  return [...bills].sort((first, second) => {
    const firstDate = parseLocalDate(first.due_date);
    const secondDate = parseLocalDate(second.due_date);
    return firstDate - secondDate;
  });
};

export const buildRecurringNextOpenUpdatePayload = (bill) => {
  const projectedValue = bill.value ?? bill.amount ?? 0;
  return {
    name: bill.name,
    numero: bill.numero,
    due_date: addMonthsKeepingDay(bill.due_date, 1),
    city: bill.city,
    category: bill.category,
    observations: bill.observations,
    bill_type: bill.bill_type,
    value: Number(projectedValue) || 0,
    payment_method: bill.payment_method,
    payment_details: bill.payment_details,
    boleto_em_maos: bill.boleto_em_maos,
    recorrente: true,
    beneficiario: bill.beneficiario,
    status: "open",
  };
};

export const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

export const normalizeDate = (value) => {
  if (!value) return "";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value).split("T")[0];
  }
  return parsedDate.toISOString().split("T")[0];
};

export const getAlertIdCandidates = (alert) =>
  [alert?.bill_id, alert?.billId, alert?.id].filter(
    (value) => value !== undefined && value !== null && value !== "",
  );

export const isSameBill = (bill, alert) => {
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
  const alertName = (alert.account || alert.name || "").trim().toLowerCase();
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

export const getDaysUntilDue = (dueDate) => {
  const due = parseLocalDate(dueDate);
  if (!due) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
};

export const getUrgencyFromBill = (bill) => {
  if (bill.status === "paid") return "green";
  const days = getDaysUntilDue(bill.due_date);
  if (days <= 1) return "red";
  if (days <= 3) return "yellow";
  return "green";
};

export const buildAlertFromBill = (bill) => ({
  id: `recurring-${bill.id}`,
  bill_id: bill.id,
  account: bill.name,
  category: bill.category,
  city: bill.city,
  due_date: bill.due_date,
  value: bill.value ?? bill.amount,
  status: bill.status,
  bill_type: bill.bill_type,
  urgency: getUrgencyFromBill(bill),
  days_until_due: getDaysUntilDue(bill.due_date),
  recorrente: true,
});

export const mergeAlertsWithRecurringBills = (sourceAlerts, sourceBills) => {
  const alerts = Array.isArray(sourceAlerts) ? sourceAlerts : [];
  const billsWithRecurringOccurrences = buildRecurringBillOccurrences(sourceBills);
  const recurringAlerts = billsWithRecurringOccurrences
    .filter((bill) => bill.recorrente)
    .filter((bill) => !alerts.some((alert) => isSameBill(bill, alert)))
    .map(buildAlertFromBill);

  return {
    alerts: [...alerts, ...recurringAlerts],
    bills: billsWithRecurringOccurrences,
  };
};

export const sumAlertValues = (alerts) =>
  alerts.reduce((total, alert) => total + (Number(alert.value) || 0), 0);
