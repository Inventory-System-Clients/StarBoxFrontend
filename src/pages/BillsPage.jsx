import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { billsAPI, categoriesAPI } from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Filter,
  Search,
} from "lucide-react";
import BillModal from "../components/BillModal";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

export default function BillsPage() {
  const { type } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const billType = type === "company" ? "company" : "personal";
  const pageTitle =
    type === "company" ? "Contas Empresariais" : "Contas Particulares";

  const [bills, setBills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    billId: null,
  });
  const [detailsModal, setDetailsModal] = useState({
    open: false,
    bill: null,
  });

  const [filters, setFilters] = useState({
    status: "",
    category: "",
    city: "",
    search: "",
  });

  useEffect(() => {
    fetchData();
  }, [billType]);

  const fetchData = async () => {
    try {
      const [billsData, categoriesData] = await Promise.all([
        billsAPI.getAll({ bill_type: billType }),
        categoriesAPI.getAll(),
      ]);
      console.log("Bills retornados da API:", billsData);
      setBills(billsData);
      setCategories(categoriesData);
    } catch (error) {
      toast.error("Erro ao carregar contas");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (billId, newStatus) => {
    try {
      await billsAPI.updateStatus(billId, newStatus);
      toast.success(
        `Conta marcada como ${newStatus === "paid" ? "paga" : "em aberto"}!`,
      );
      fetchData();
    } catch (error) {
      toast.error("Erro ao atualizar status da conta");
    }
  };

  const handleDelete = async () => {
    try {
      await billsAPI.delete(deleteDialog.billId);
      toast.success("Conta excluída com sucesso!");
      setDeleteDialog({ open: false, billId: null });
      fetchData();
    } catch (error) {
      toast.error("Erro ao excluir conta");
    }
  };

  const handleEdit = (bill) => {
    setEditingBill(bill);
    setShowModal(true);
  };

  const handleViewDetails = (bill) => {
    setDetailsModal({ open: true, bill });
  };

  const filteredBills = bills.filter((bill) => {
    if (filters.status && bill.status !== filters.status) return false;
    if (filters.category && bill.category !== filters.category) return false;
    if (
      filters.city &&
      !bill.city.toLowerCase().includes(filters.city.toLowerCase())
    )
      return false;
    if (
      filters.search &&
      !(bill.name || bill.account)
        ?.toLowerCase()
        .includes(filters.search.toLowerCase())
    )
      return false;
    return true;
  });

  const getDaysUntilDue = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (bill) => {
    if (bill.status === "paid") return "bg-green-100 text-green-700";
    const days = getDaysUntilDue(bill.due_date);
    if (days < 0) return "bg-red-100 text-red-700";
    if (days <= 1) return "bg-red-100 text-red-700";
    if (days <= 3) return "bg-yellow-100 text-yellow-700";
    return "bg-blue-100 text-blue-700";
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
    <div className="min-h-screen flex flex-col app-container">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 space-y-4 sm:space-y-0">
            <div>
              <h1
                className="text-4xl font-bold text-gray-800 mb-2"
                data-testid="page-title"
              >
                {pageTitle}
              </h1>
              <p className="text-gray-600">
                Gerencie suas contas{" "}
                {type === "company" ? "empresariais" : "particulares"}
              </p>
            </div>
            {isAdmin && (
              <Button
                onClick={() => {
                  setEditingBill(null);
                  setShowModal(true);
                }}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg btn-primary"
                data-testid="btn-add-bill"
              >
                <Plus size={20} className="mr-2" />
                Nova Conta
              </Button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-purple-100">
            <div className="flex items-center space-x-2 mb-4">
              <Filter size={20} className="text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-800">Filtros</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  Buscar
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <Input
                    placeholder="Nome da conta"
                    value={filters.search}
                    onChange={(e) =>
                      setFilters({ ...filters, search: e.target.value })
                    }
                    className="pl-10"
                    data-testid="filter-search"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  Status
                </label>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters({ ...filters, status: value })
                  }
                >
                  <SelectTrigger data-testid="filter-status">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="open">Em Aberto</SelectItem>
                    <SelectItem value="paid">Paga</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  Categoria
                </label>
                <Select
                  value={filters.category}
                  onValueChange={(value) =>
                    setFilters({ ...filters, category: value })
                  }
                >
                  <SelectTrigger data-testid="filter-category">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  Cidade
                </label>
                <Input
                  placeholder="Filtrar por cidade"
                  value={filters.city}
                  onChange={(e) =>
                    setFilters({ ...filters, city: e.target.value })
                  }
                  data-testid="filter-city"
                />
              </div>
            </div>
            {(filters.status ||
              filters.category ||
              filters.city ||
              filters.search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilters({ status: "", category: "", city: "", search: "" })
                }
                className="mt-3 text-purple-600 hover:text-purple-700"
                data-testid="btn-clear-filters"
              >
                Limpar Filtros
              </Button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md border border-purple-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="bills-table">
                <thead className="bg-gradient-to-r from-purple-50 to-blue-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Conta
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Beneficiário
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Vencimento
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Valor
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Categoria
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Cidade
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td
                        colSpan="8"
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        Nenhuma conta encontrada
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map((bill) => (
                      <tr
                        key={bill.id}
                        className="hover:bg-purple-50 transition-colors"
                        data-testid={`bill-row-${bill.id}`}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <button
                              onClick={() => handleViewDetails(bill)}
                              className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                              title="Clique para ver todos os detalhes"
                            >
                              {bill.name || bill.account}
                            </button>
                            {bill.recorrente && (
                              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold" title="Conta recorrente mensal">
                                🔁 Mensal
                              </span>
                            )}
                            {bill.observations && (
                              <p className="text-sm text-gray-500 mt-1">
                                {bill.observations}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {bill.beneficiario ? (
                            <span className="text-gray-700 font-medium" title={bill.beneficiario}>
                              👤 {bill.beneficiario}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {new Date(bill.due_date).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-800">
                            R$ {(bill.value !== undefined && bill.value !== null && !isNaN(Number(bill.value)) && isFinite(Number(bill.value)))
                              ? Number(bill.value).toFixed(2)
                              : "--"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                            {bill.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{bill.city}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(bill)}`}
                          >
                            {bill.status === "paid" ? "Paga" : "Em Aberto"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleStatusChange(
                                  bill.id,
                                  bill.status === "paid" ? "open" : "paid",
                                )
                              }
                              className={`${
                                bill.status === "paid"
                                  ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                  : "text-green-600 hover:text-green-700 hover:bg-green-50"
                              }`}
                              title={
                                bill.status === "paid"
                                  ? "Marcar como em aberto"
                                  : "Marcar como paga"
                              }
                              data-testid={`btn-toggle-status-${bill.id}`}
                            >
                              {bill.status === "paid" ? (
                                <XCircle size={18} />
                              ) : (
                                <CheckCircle size={18} />
                              )}
                            </Button>
                            {isAdmin && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(bill)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  data-testid={`btn-edit-${bill.id}`}
                                >
                                  <Edit size={18} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setDeleteDialog({
                                      open: true,
                                      billId: bill.id,
                                    })
                                  }
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  data-testid={`btn-delete-${bill.id}`}
                                >
                                  <Trash2 size={18} />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {showModal && (
        <BillModal
          open={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingBill(null);
          }}
          onSuccess={() => {
            fetchData();
            setShowModal(false);
            setEditingBill(null);
          }}
          categories={categories}
          bill={editingBill}
          defaultType={billType}
        />
      )}

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, billId: null })}
      >
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="btn-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Detalhes da Conta */}
      {detailsModal.open && detailsModal.bill && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
          onClick={() => setDetailsModal({ open: false, bill: null })}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 flex justify-between items-center rounded-t-xl">
              <h2 className="text-2xl font-bold flex items-center">
                📋 Detalhes da Conta
              </h2>
              <button
                onClick={() => setDetailsModal({ open: false, bill: null })}
                className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
                title="Fechar"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nome da Conta */}
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    Nome da Conta
                  </label>
                  <p className="text-xl font-bold text-gray-800 mt-1">
                    {detailsModal.bill.name || detailsModal.bill.account}
                  </p>
                </div>

                {/* Beneficiário */}
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    👤 Beneficiário
                  </label>
                  <p className="text-lg font-semibold text-blue-600 mt-1">
                    {detailsModal.bill.beneficiario || (
                      <span className="text-gray-400 italic">Não informado</span>
                    )}
                  </p>
                </div>

                {/* Valor */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    💰 Valor
                  </label>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    R$ {(detailsModal.bill.value !== undefined && detailsModal.bill.value !== null && !isNaN(Number(detailsModal.bill.value)) && isFinite(Number(detailsModal.bill.value)))
                      ? Number(detailsModal.bill.value).toFixed(2)
                      : (detailsModal.bill.amount !== undefined && detailsModal.bill.amount !== null && !isNaN(Number(detailsModal.bill.amount)) && isFinite(Number(detailsModal.bill.amount)))
                      ? Number(detailsModal.bill.amount).toFixed(2)
                      : "0.00"}
                  </p>
                </div>

                {/* Data de Vencimento */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    📅 Data de Vencimento
                  </label>
                  <p className="text-lg font-semibold text-gray-700 mt-1">
                    {new Date(detailsModal.bill.due_date).toLocaleDateString("pt-BR")}
                  </p>
                </div>

                {/* Recorrente */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    🔁 Recorrente
                  </label>
                  <div className="mt-1">
                    {detailsModal.bill.recorrente ? (
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                        ✅ Sim - Repete todo mês no dia {new Date(detailsModal.bill.due_date).getDate()}
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                        ❌ Não
                      </span>
                    )}
                  </div>
                </div>

                {/* Categoria */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    📂 Categoria
                  </label>
                  <p className="text-lg font-semibold text-gray-700 mt-1">
                    {detailsModal.bill.category || (
                      <span className="text-gray-400 italic">Sem categoria</span>
                    )}
                  </p>
                </div>

                {/* Cidade */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    🏙️ Cidade
                  </label>
                  <p className="text-lg font-semibold text-gray-700 mt-1">
                    {detailsModal.bill.city || (
                      <span className="text-gray-400 italic">Não informada</span>
                    )}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    📊 Status
                  </label>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        detailsModal.bill.status === "paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {detailsModal.bill.status === "paid" ? "✅ Pago" : "⏳ Pendente"}
                    </span>
                  </div>
                </div>

                {/* Tipo */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    🏢 Tipo
                  </label>
                  <p className="text-lg font-semibold text-gray-700 mt-1">
                    {detailsModal.bill.bill_type === "company"
                      ? "🏢 Empresarial"
                      : "👤 Pessoal"}
                  </p>
                </div>

                {/* Método de Pagamento */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    💳 Método de Pagamento
                  </label>
                  <p className="text-lg font-semibold text-gray-700 mt-1">
                    {detailsModal.bill.payment_method === "boleto" && "📄 Boleto"}
                    {detailsModal.bill.payment_method === "pix" && "💸 PIX"}
                    {detailsModal.bill.payment_method === "email" && "📧 Email"}
                    {!detailsModal.bill.payment_method && (
                      <span className="text-gray-400 italic">Não informado</span>
                    )}
                  </p>
                </div>

                {/* Detalhes de Pagamento */}
                {detailsModal.bill.payment_details && (
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      📝 Detalhes de Pagamento
                    </label>
                    <p className="text-lg font-semibold text-gray-700 mt-1">
                      {detailsModal.bill.payment_details}
                    </p>
                  </div>
                )}

                {/* Boleto em Mãos */}
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                    📋 Boleto em Mãos
                  </label>
                  <p className="text-lg font-semibold text-gray-700 mt-1">
                    {detailsModal.bill.boleto_em_maos ? "✅ Sim" : "❌ Não"}
                  </p>
                </div>

                {/* Conta (Número) */}
                {detailsModal.bill.account && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      🔢 Conta (Número)
                    </label>
                    <p className="text-lg font-semibold text-gray-700 mt-1">
                      {detailsModal.bill.account}
                    </p>
                  </div>
                )}

                {/* Observações */}
                {detailsModal.bill.observations && (
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
                      📝 Observações
                    </label>
                    <div className="mt-1 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {detailsModal.bill.observations}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end border-t rounded-b-xl">
              <Button
                onClick={() => setDetailsModal({ open: false, bill: null })}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
