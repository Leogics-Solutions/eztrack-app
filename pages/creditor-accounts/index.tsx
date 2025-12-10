'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Plus, Upload, Edit, Trash2, FileText, Loader2, Eye, X } from "lucide-react";
import {
    listCreditorAccounts,
    createCreditorAccount,
    updateCreditorAccount,
    deleteCreditorAccount,
    getCreditorAccountInvoices,
    type CreditorAccount,
    type CreditorAccountInvoice,
} from "@/services";
import { listVendors, type Vendor } from "@/services";

const CreditorAccounts = () => {
    const { t } = useLanguage();
    const toast = useToast();
    const router = useRouter();
    // State
    const [creditors, setCreditors] = useState<CreditorAccount[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        account_name: '',
        account_code: '',
        vendor_link: '',
        description: '',
    });
    // Invoice modal state
    const [isInvoicesModalOpen, setIsInvoicesModalOpen] = useState(false);
    const [selectedCreditorAccount, setSelectedCreditorAccount] = useState<CreditorAccount | null>(null);
    const [invoices, setInvoices] = useState<CreditorAccountInvoice[]>([]);
    const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

    // Load creditors data
    useEffect(() => {
        loadCreditors();
        loadVendors();
    }, []);

    const loadCreditors = async () => {
        try {
            setIsLoading(true);
            const response = await listCreditorAccounts({ active_only: true });
            setCreditors(response.data);
        } catch (error) {
            console.error('Failed to load creditor accounts:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to load creditor accounts');
        } finally {
            setIsLoading(false);
        }
    };

    const loadVendors = async () => {
        try {
            const response = await listVendors({ active_only: true });
            setVendors(response.data);
        } catch (error) {
            console.error('Failed to load vendors:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to load vendors');
        }
    };

    // Modal handlers
    const showAddCreditorModal = () => {
        setEditingId(null);
        setFormData({
            account_name: '',
            account_code: '',
            vendor_link: '',
            description: '',
        });
        setIsModalOpen(true);
    };

    const editCreditor = (creditor: CreditorAccount) => {
        setEditingId(creditor.id);
        setFormData({
            account_name: creditor.name,
            account_code: creditor.code || '',
            vendor_link: creditor.vendor_id?.toString() || '',
            description: creditor.description || '',
        });
        setIsModalOpen(true);
    };

    const closeCreditorModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const saveCreditor = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setIsSaving(true);
            const payload = {
                name: formData.account_name,
                code: formData.account_code || undefined,
                vendor_id: formData.vendor_link ? parseInt(formData.vendor_link) : undefined,
                description: formData.description || undefined,
            };

            if (editingId) {
                await updateCreditorAccount(editingId, payload);
                toast.success(t.creditors.accountUpdated || 'Creditor account updated successfully');
            } else {
                await createCreditorAccount(payload);
                toast.success(t.creditors.accountCreated || 'Creditor account created successfully');
            }

            closeCreditorModal();
            await loadCreditors();
        } catch (error) {
            console.error('Failed to save creditor account:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save creditor account');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteCreditor = async (id: number, name: string) => {
        if (!confirm(t.creditors.deleteConfirm.replace('{name}', name))) {
            return;
        }

        try {
            setIsLoading(true);
            await deleteCreditorAccount(id);
            toast.success(t.creditors.accountDeleted || 'Creditor account deleted successfully');
            await loadCreditors();
        } catch (error) {
            console.error('Failed to delete creditor account:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to delete creditor account');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportCSV = async () => {
        // TODO: Implement CSV import functionality
        alert(t.creditors.csvImportMessage);
    };

    const viewInvoices = async (creditor: CreditorAccount) => {
        setSelectedCreditorAccount(creditor);
        setIsInvoicesModalOpen(true);
        await loadInvoices(creditor.id);
    };

    const loadInvoices = async (accountId: number) => {
        try {
            setIsLoadingInvoices(true);
            const response = await getCreditorAccountInvoices(accountId);
            setInvoices(response.data);
        } catch (error) {
            console.error('Failed to load invoices:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to load invoices');
        } finally {
            setIsLoadingInvoices(false);
        }
    };

    const closeInvoicesModal = () => {
        setIsInvoicesModalOpen(false);
        setSelectedCreditorAccount(null);
        setInvoices([]);
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        } catch {
            return dateString;
        }
    };

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'MYR',
            minimumFractionDigits: 2,
        }).format(amount);
    };

    const handleInvoiceClick = (invoiceId: number) => {
        router.push(`/documents/${invoiceId}`);
    };

    return (
        <AppLayout pageName={t.creditors.title}>
            <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
                {/* Header */}
                <div className="p-4 md:p-6 border-b border-[var(--border)]">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                        <div className="flex-1 min-w-0 md:min-w-[300px]">
                            <h2 className="text-xl md:text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                                {t.creditors.title}
                            </h2>
                            <p className="text-sm break-words" style={{ color: 'var(--muted-foreground)' }}>
                                {t.creditors.description}
                            </p>
                        </div>
                        <div className="flex flex-col md:flex-row gap-2 md:gap-3 flex-shrink-0 w-full md:w-auto">
                            <button
                                onClick={handleImportCSV}
                                className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors flex items-center justify-center text-sm"
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                {t.creditors.importCSV}
                            </button>
                            <button
                                onClick={showAddCreditorModal}
                                className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors flex items-center justify-center text-sm"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {t.creditors.addCreditorAccount}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Creditor Accounts List */}
                <div className="p-6">
                    {isLoading && creditors.length === 0 ? (
                        <div className="py-12 px-4 text-center rounded-lg">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: 'var(--muted-foreground)' }} />
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading creditor accounts...</p>
                        </div>
                    ) : creditors.length > 0 ? (
                        <div className="space-y-4">
                            {creditors.map((creditor) => (
                                <div
                                    key={creditor.id}
                                    className="p-4 border border-[var(--border)] rounded-lg hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors group"
                                >
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2" >
                                            {creditor.name}
                                        </h3>
                                        {creditor.code && (
                                            <p className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>
                                                {t.creditors.accountCode}: {creditor.code}
                                            </p>
                                        )}
                                        <div className="space-y-1 mb-3">
                                            {creditor.vendor_name && (
                                                <p className="text-sm" >
                                                    {t.creditors.vendor} {creditor.vendor_name}
                                                </p>
                                            )}
                                            {creditor.description && (
                                                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                                    {creditor.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 text-sm">
                                                <FileText className="h-4 w-4" />
                                                {(creditor.invoice_count || 0) > 0 ? (
                                                    <button
                                                        onClick={() => viewInvoices(creditor)}
                                                        className="hover:underline cursor-pointer"
                                                        style={{ color: 'var(--primary)' }}
                                                    >
                                                        {creditor.invoice_count || 0} {creditor.invoice_count === 1 ? t.creditors.invoice : t.creditors.invoices}
                                                    </button>
                                                ) : (
                                                    <span>{creditor.invoice_count || 0} {creditor.invoice_count === 1 ? t.creditors.invoice : t.creditors.invoices}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="border-t pt-3 mt-5 group-hover:border-[var(--hover-border)]" style={{ borderTopColor: 'var(--border)' }}>
                                            <div className="flex flex-wrap gap-2">
                                                {(creditor.invoice_count || 0) > 0 && (
                                                    <button
                                                        onClick={() => viewInvoices(creditor)}
                                                        disabled={isLoading}
                                                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View Invoices
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => editCreditor(creditor)}
                                                    disabled={isLoading}
                                                    className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    {t.creditors.edit}
                                                </button>
                                                <button
                                                    onClick={() => deleteCreditor(creditor.id, creditor.name)}
                                                    disabled={isLoading}
                                                    className="px-4 py-2 bg-[var(--error)] text-white rounded-md hover:bg-[var(--error-dark)] transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    {t.creditors.delete}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div
                            className="py-12 px-4 text-center rounded-lg"
                            style={{
                                color: 'var(--muted-foreground)',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                            }}
                        >
                            <p className="text-sm italic">{t.creditors.noCreditorAccounts}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Creditor Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center md:items-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            closeCreditorModal();
                        }
                    }}
                >
                    <div
                        className="w-full h-full md:w-full md:max-w-2xl md:h-auto md:max-h-[90vh] overflow-y-auto md:rounded-xl shadow-2xl"
                        style={{
                            backgroundColor: 'var(--card)',
                            border: '1px solid var(--border)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div
                            className="flex justify-between items-center p-4 md:p-6 border-b sticky top-0 bg-[var(--card)] z-10"
                            style={{ borderBottomColor: 'var(--border)' }}
                        >
                            <h3 className="text-lg md:text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                                {editingId ? t.creditors.editCreditorAccount : t.creditors.addCreditorAccount}
                            </h3>
                            <button
                                onClick={closeCreditorModal}
                                className="w-8 h-8 flex items-center justify-center rounded-md text-2xl transition-colors hover:bg-white/10"
                                style={{ color: 'var(--muted-foreground)' }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={saveCreditor} className="p-4 md:p-6">
                            {/* Account Name */}
                            <div className="mb-4">
                                <label
                                    className="block mb-2 text-sm font-semibold"
                                    style={{ color: 'var(--foreground)' }}
                                >
                                    {t.creditors.accountName} *
                                </label>
                                <input
                                    type="text"
                                    value={formData.account_name}
                                    onChange={(e) => handleInputChange('account_name', e.target.value)}
                                    placeholder={t.creditors.accountNamePlaceholder}
                                    required
                                    className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                    style={{
                                        backgroundColor: 'var(--background)',
                                        borderColor: 'var(--border)',
                                        color: 'var(--foreground)',
                                    }}
                                />
                                <p
                                    className="mt-2 text-xs italic"
                                    style={{ color: 'var(--muted-foreground)' }}
                                >
                                    {t.creditors.accountNameComment}
                                </p>
                            </div>

                            {/* Account Code and Link to Vendor */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                {/* Account Code */}
                                <div>
                                    <label
                                        className="block mb-2 text-sm font-semibold"
                                        style={{ color: 'var(--foreground)' }}
                                    >
                                        {t.creditors.accountCode}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.account_code}
                                        onChange={(e) => handleInputChange('account_code', e.target.value)}
                                        placeholder={t.creditors.accountCodePlaceholder}
                                        className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                        style={{
                                            backgroundColor: 'var(--background)',
                                            borderColor: 'var(--border)',
                                            color: 'var(--foreground)',
                                        }}
                                    />
                                </div>

                                {/* Link to Vendor */}
                                <div>
                                    <label
                                        className="block mb-2 text-sm font-semibold"
                                        style={{ color: 'var(--foreground)' }}
                                    >
                                        {t.creditors.linkToVendor}
                                    </label>
                                    <select
                                        value={formData.vendor_link}
                                        onChange={(e) => handleInputChange('vendor_link', e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                        style={{
                                            backgroundColor: 'var(--background)',
                                            borderColor: 'var(--border)',
                                            color: 'var(--foreground)',
                                        }}
                                    >
                                        <option value="">{t.creditors.noVendorLink}</option>
                                        {vendors.map((vendor) => (
                                            <option key={vendor.id} value={vendor.id}>
                                                {vendor.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-4">
                                <label
                                    className="block mb-2 text-sm font-semibold"
                                    style={{ color: 'var(--foreground)' }}
                                >
                                    {t.creditors.descriptionLabel}
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    placeholder={t.creditors.descriptionPlaceholder}
                                    rows={3}
                                    className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                    style={{
                                        backgroundColor: 'var(--background)',
                                        borderColor: 'var(--border)',
                                        color: 'var(--foreground)',
                                    }}
                                />
                            </div>

                            {/* Modal Actions */}
                            <div
                                className="flex gap-3 pt-5 mt-5 border-t"
                                style={{ borderTopColor: 'var(--border)' }}
                            >
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            {editingId ? 'Updating...' : 'Creating...'}
                                        </>
                                    ) : (
                                        editingId ? t.creditors.updateAccount : t.creditors.createAccount
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeCreditorModal}
                                    className="flex-1 px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                                >
                                    {t.creditors.cancel}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Invoices Modal */}
            {isInvoicesModalOpen && selectedCreditorAccount && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center md:items-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            closeInvoicesModal();
                        }
                    }}
                >
                    <div
                        className="w-full h-full md:w-full md:max-w-4xl md:h-auto md:max-h-[90vh] overflow-y-auto md:rounded-xl shadow-2xl"
                        style={{
                            backgroundColor: 'var(--card)',
                            border: '1px solid var(--border)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div
                            className="flex justify-between items-center p-4 md:p-6 border-b sticky top-0 bg-[var(--card)] z-10"
                            style={{ borderBottomColor: 'var(--border)' }}
                        >
                            <div>
                                <h3 className="text-lg md:text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                                    Invoices - {selectedCreditorAccount.name}
                                </h3>
                                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                    {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
                                </p>
                            </div>
                            <button
                                onClick={closeInvoicesModal}
                                className="w-8 h-8 flex items-center justify-center rounded-md text-2xl transition-colors hover:bg-white/10"
                                style={{ color: 'var(--muted-foreground)' }}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Invoices Table */}
                        <div className="p-4 md:p-6">
                            {isLoadingInvoices ? (
                                <div className="py-12 px-4 text-center rounded-lg">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: 'var(--muted-foreground)' }} />
                                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading invoices...</p>
                                </div>
                            ) : invoices.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="border-b" style={{ borderBottomColor: 'var(--border)' }}>
                                                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                                                    Invoice No.
                                                </th>
                                                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                                                    Date
                                                </th>
                                                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                                                    Vendor
                                                </th>
                                                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                                                    Total
                                                </th>
                                                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                                                    Status
                                                </th>
                                                <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoices.map((invoice) => (
                                                <tr
                                                    key={invoice.id}
                                                    className="border-b hover:bg-[var(--hover-bg)] transition-colors"
                                                    style={{ borderBottomColor: 'var(--border)' }}
                                                >
                                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>
                                                        {invoice.invoice_no}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>
                                                        {formatDate(invoice.invoice_date)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--foreground)' }}>
                                                        {invoice.vendor_name}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right" style={{ color: 'var(--foreground)' }}>
                                                        {formatCurrency(invoice.total, invoice.currency)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span
                                                            className="px-2 py-1 rounded text-xs font-medium"
                                                            style={{
                                                                backgroundColor: invoice.status === 'VALIDATED' || invoice.status === 'POSTED' || invoice.status === 'PAID'
                                                                    ? 'rgba(34, 197, 94, 0.1)'
                                                                    : invoice.status === 'DRAFT'
                                                                    ? 'rgba(251, 191, 36, 0.1)'
                                                                    : 'rgba(107, 114, 128, 0.1)',
                                                                color: invoice.status === 'VALIDATED' || invoice.status === 'POSTED' || invoice.status === 'PAID'
                                                                    ? 'rgb(34, 197, 94)'
                                                                    : invoice.status === 'DRAFT'
                                                                    ? 'rgb(251, 191, 36)'
                                                                    : 'rgb(107, 114, 128)',
                                                            }}
                                                        >
                                                            {invoice.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleInvoiceClick(invoice.id)}
                                                            className="px-3 py-1 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                                                            style={{ color: 'var(--foreground)' }}
                                                        >
                                                            View
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div
                                    className="py-12 px-4 text-center rounded-lg"
                                    style={{
                                        color: 'var(--muted-foreground)',
                                        backgroundColor: 'rgba(255,255,255,0.03)',
                                    }}
                                >
                                    <p className="text-sm italic">No invoices found for this creditor account</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
};

export default CreditorAccounts;

