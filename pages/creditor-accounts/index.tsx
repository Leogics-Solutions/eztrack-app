'use client';

import { AppLayout } from "@/components/layout";
import { useState, useEffect } from "react";
import { Plus, Upload, Edit, Trash2, FileText } from "lucide-react";

// Types
interface Vendor {
    id: number;
    name: string;
}

interface CreditorAccount {
    id: number;
    name: string;
    account_code?: string;
    vendor_link?: number;
    description?: string;
    vendor_name: string;
    invoice_count: number;
}

const CreditorAccounts = () => {
    // State
    const [creditors, setCreditors] = useState<CreditorAccount[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        account_name: '',
        account_code: '',
        vendor_link: '',
        description: '',
    });

    // Load creditors data
    useEffect(() => {
        loadCreditors();
        loadVendors();
    }, []);

    const loadCreditors = async () => {
        // TODO: Replace with actual API call
        // Mock data for testing
        const mockCreditors: CreditorAccount[] = [
            {
                id: 1,
                name: '650 Industries, Inc. (Expo)',
                account_code: 'CR001',
                vendor_link: 1,
                description: '',
                vendor_name: '650 Industries, Inc. (Expo)',
                invoice_count: 2,
            },
            {
                id: 2,
                name: 'Amazon Web Services, Inc.',
                account_code: 'CR002',
                vendor_link: 2,
                description: '',
                vendor_name: 'Amazon Web Services, Inc.',
                invoice_count: 1,
            },
        ];
        setCreditors(mockCreditors);
    };

    const loadVendors = async () => {
        // TODO: Replace with actual API call
        setVendors([
            { id: 1, name: '650 Industries, Inc. (Expo)' },
            { id: 2, name: 'Amazon Web Services, Inc.' },
            { id: 3, name: 'Sample Vendor Ltd' },
            { id: 4, name: 'Another Vendor Co' },
        ]);
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
            account_code: creditor.account_code || '',
            vendor_link: creditor.vendor_link?.toString() || '',
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

        // TODO: Replace with actual API call
        console.log('Saving creditor:', formData);

        // Mock success
        alert(editingId ? 'Creditor account updated successfully!' : 'Creditor account created successfully!');
        closeCreditorModal();
        // loadCreditors(); // Uncomment when API is ready
    };

    const deleteCreditor = async (id: number, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) {
            return;
        }

        // TODO: Replace with actual API call
        console.log('Deleting creditor:', id);
        alert('Creditor account deleted successfully!');
        // loadCreditors(); // Uncomment when API is ready
    };

    const handleImportCSV = async () => {
        // TODO: Implement CSV import functionality
        alert('CSV import functionality will be implemented here');
    };

    return (
        <AppLayout pageName="Creditor Accounts">
            <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border)]">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <div className="flex-1 min-w-0 md:min-w-[300px]">
                            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                                Creditor Accounts
                            </h2>
                            <p className="text-sm break-words" style={{ color: 'var(--muted-foreground)' }}>
                                Manage creditor accounts for invoice tracking. Each invoice is automatically assigned to a creditor account based on the vendor name.
                            </p>
                        </div>
                        <div className="flex gap-3 flex-wrap flex-shrink-0">
                            <button
                                onClick={handleImportCSV}
                                className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors flex items-center"
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                Import CSV
                            </button>
                            <button
                                onClick={showAddCreditorModal}
                                className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors flex items-center"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Creditor Account
                            </button>
                        </div>
                    </div>
                </div>

                {/* Creditor Accounts List */}
                <div className="p-6">
                    {creditors.length > 0 ? (
                        <div className="space-y-4">
                            {creditors.map((creditor) => (
                                <div
                                    key={creditor.id}
                                    className="p-4 border border-[var(--border)] rounded-lg hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors group"
                                >
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2 group-hover:text-white" >
                                            {creditor.name}
                                        </h3>
                                        <div className="space-y-1 mb-3">
                                            <p className="text-sm group-hover:text-white" >
                                                Vendor: {creditor.vendor_name}
                                            </p>
                                            <div className="flex items-center gap-2 text-sm group-hover:text-white">
                                                <FileText className="h-4 w-4" />
                                                <span>{creditor.invoice_count} {creditor.invoice_count === 1 ? 'Invoice' : 'Invoices'}</span>
                                            </div>
                                        </div>
                                        <div className="border-t pt-3 mt-5 group-hover:border-[var(--hover-border)]" style={{ borderTopColor: 'var(--border)' }}>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => editCreditor(creditor)}
                                                    className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors flex items-center"
                                                >
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteCreditor(creditor.id, creditor.name)}
                                                    className="px-4 py-2 bg-[var(--error)] text-white rounded-md hover:bg-[var(--error-dark)] transition-colors flex items-center"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
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
                            <p className="text-sm italic">No creditor accounts found. Click "Add Creditor Account" to create one.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Creditor Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            closeCreditorModal();
                        }
                    }}
                >
                    <div
                        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
                        style={{
                            backgroundColor: 'var(--card)',
                            border: '1px solid var(--border)',
                        }}
                    >
                        {/* Modal Header */}
                        <div
                            className="flex justify-between items-center p-6 border-b"
                            style={{ borderBottomColor: 'var(--border)' }}
                        >
                            <h3 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                                {editingId ? 'Edit Creditor Account' : 'Add Creditor Account'}
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
                        <form onSubmit={saveCreditor} className="p-6">
                            {/* Account Name */}
                            <div className="mb-4">
                                <label
                                    className="block mb-2 text-sm font-semibold"
                                    style={{ color: 'var(--foreground)' }}
                                >
                                    Account Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.account_name}
                                    onChange={(e) => handleInputChange('account_name', e.target.value)}
                                    placeholder="ABC Sdn Bhd"
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
                                    This should match the vendor company name
                                </p>
                            </div>

                            {/* Account Code and Link to Vendor */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                {/* Account Code */}
                                <div>
                                    <label
                                        className="block mb-2 text-sm font-semibold"
                                        style={{ color: 'var(--foreground)' }}
                                    >
                                        Account Code
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.account_code}
                                        onChange={(e) => handleInputChange('account_code', e.target.value)}
                                        placeholder="CR001"
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
                                        Link to Vendor
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
                                        <option value="">--No Vendor link--</option>
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
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    placeholder="Optional Description or notes"
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
                                    className="flex-1 px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors font-medium"
                                >
                                    {editingId ? 'Update Account' : 'Create Account'}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeCreditorModal}
                                    className="flex-1 px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
};

export default CreditorAccounts;

