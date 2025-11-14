'use client';

import { AppLayout } from "@/components/layout";
import { useState, useEffect } from "react";

// Types
interface Account {
    id: number;
    account_name: string;
    account_type: string;
    description?: string;
}

interface AccountGroups {
    [key: string]: Account[];
}

const PREDEFINED_ACCOUNT_TYPES = [
    'Assets',
    'Liabilities',
    'Equity',
    'Income',
    'Expenses',
    'Cost of Goods Sold',
];

const ChartOfAccounts = () => {
    // State
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountTypes] = useState<string[]>(PREDEFINED_ACCOUNT_TYPES);
    const [accountGroups, setAccountGroups] = useState<AccountGroups>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCustomType, setIsCustomType] = useState(false);

    // Form state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        account_type: '',
        custom_account_type: '',
        account_name: '',
        description: '',
    });

    // Load accounts data
    useEffect(() => {
        loadAccounts();
    }, []);

    // Group accounts by type whenever accounts change
    useEffect(() => {
        groupAccountsByType();
    }, [accounts]);

    const loadAccounts = async () => {
        // TODO: Replace with actual API call
        // Mock data for testing
        const mockAccounts: Account[] = [
            // Assets
            {
                id: 1,
                account_name: 'Cash',
                account_type: 'Assets',
                description: 'Cash on hand and in bank accounts',
            },
            {
                id: 2,
                account_name: 'Accounts Receivable',
                account_type: 'Assets',
                description: 'Money owed by customers, invoices, AR',
            },
            {
                id: 3,
                account_name: 'Inventory',
                account_type: 'Assets',
                description: 'Products, goods, stock, merchandise',
            },
            {
                id: 4,
                account_name: 'Equipment',
                account_type: 'Assets',
                description: 'Computers, machinery, furniture, hardware',
            },
            {
                id: 5,
                account_name: 'Prepaid Expenses',
                account_type: 'Assets',
                description: 'Insurance, rent paid in advance',
            },

            // Liabilities
            {
                id: 6,
                account_name: 'Accounts Payable',
                account_type: 'Liabilities',
                description: 'Money owed to suppliers, vendors, AP',
            },
            {
                id: 7,
                account_name: 'Bank Loan',
                account_type: 'Liabilities',
                description: 'Loans, financing, debt, credit',
            },
            {
                id: 8,
                account_name: 'Credit Card',
                account_type: 'Liabilities',
                description: 'Corporate card, business credit card',
            },
            {
                id: 9,
                account_name: 'Accrued Expenses',
                account_type: 'Liabilities',
                description: 'Unpaid wages, utilities, accruals',
            },

            // Equity
            {
                id: 10,
                account_name: 'Owner\'s Equity',
                account_type: 'Equity',
                description: 'Owner capital, investment, equity',
            },
            {
                id: 11,
                account_name: 'Retained Earnings',
                account_type: 'Equity',
                description: 'Accumulated profits, retained income',
            },
            {
                id: 12,
                account_name: 'Share Capital',
                account_type: 'Equity',
                description: 'Common stock, shares, capital stock',
            },

            // Income
            {
                id: 13,
                account_name: 'Sales Revenue',
                account_type: 'Income',
                description: 'Product sales, revenue, income from sales',
            },
            {
                id: 14,
                account_name: 'Service Revenue',
                account_type: 'Income',
                description: 'Consulting, services, professional fees',
            },
            {
                id: 15,
                account_name: 'Interest Income',
                account_type: 'Income',
                description: 'Bank interest, investment income',
            },
            {
                id: 16,
                account_name: 'Other Income',
                account_type: 'Income',
                description: 'Miscellaneous income, gains, other revenue',
            },

            // Expenses
            {
                id: 17,
                account_name: 'Office Supplies',
                account_type: 'Expenses',
                description: 'Office supplies, stationery, printer ink, paper',
            },
            {
                id: 18,
                account_name: 'Rent Expense',
                account_type: 'Expenses',
                description: 'Office rent, lease, rental payments',
            },
            {
                id: 19,
                account_name: 'Utilities',
                account_type: 'Expenses',
                description: 'Electricity, water, internet, phone, utilities',
            },
            {
                id: 20,
                account_name: 'Salaries & Wages',
                account_type: 'Expenses',
                description: 'Employee salaries, wages, payroll',
            },
            {
                id: 21,
                account_name: 'Software Subscriptions',
                account_type: 'Expenses',
                description: 'SaaS, software licenses, cloud services, subscriptions',
            },
            {
                id: 22,
                account_name: 'Marketing & Advertising',
                account_type: 'Expenses',
                description: 'Ads, marketing campaigns, social media, promotion',
            },
            {
                id: 23,
                account_name: 'Travel Expenses',
                account_type: 'Expenses',
                description: 'Business travel, flights, hotels, accommodation',
            },
            {
                id: 24,
                account_name: 'Professional Fees',
                account_type: 'Expenses',
                description: 'Legal fees, accounting, consultants, professional services',
            },
            {
                id: 25,
                account_name: 'Insurance',
                account_type: 'Expenses',
                description: 'Business insurance, liability, coverage',
            },
            {
                id: 26,
                account_name: 'Depreciation',
                account_type: 'Expenses',
                description: 'Asset depreciation, amortization',
            },
            {
                id: 27,
                account_name: 'Bank Charges',
                account_type: 'Expenses',
                description: 'Bank fees, transaction charges, service fees',
            },
            {
                id: 28,
                account_name: 'Office Maintenance',
                account_type: 'Expenses',
                description: 'Repairs, maintenance, cleaning services',
            },

            // Cost of Goods Sold
            {
                id: 29,
                account_name: 'Product Costs',
                account_type: 'Cost of Goods Sold',
                description: 'Direct product costs, manufacturing, production',
            },
            {
                id: 30,
                account_name: 'Shipping & Freight',
                account_type: 'Cost of Goods Sold',
                description: 'Delivery costs, freight, shipping, logistics',
            },
            {
                id: 31,
                account_name: 'Raw Materials',
                account_type: 'Cost of Goods Sold',
                description: 'Materials, supplies, components, ingredients',
            },
            {
                id: 32,
                account_name: 'Labor Costs',
                account_type: 'Cost of Goods Sold',
                description: 'Direct labor, production wages, manufacturing labor',
            },
        ];
        setAccounts(mockAccounts);
    };

    const groupAccountsByType = () => {
        const grouped: AccountGroups = {};

        // Initialize all account types with empty arrays
        accountTypes.forEach(type => {
            grouped[type] = [];
        });

        // Group accounts
        accounts.forEach(account => {
            if (!grouped[account.account_type]) {
                grouped[account.account_type] = [];
            }
            grouped[account.account_type].push(account);
        });

        setAccountGroups(grouped);
    };

    // Modal handlers
    const showAddAccountModal = () => {
        setEditingId(null);
        setFormData({
            account_type: '',
            custom_account_type: '',
            account_name: '',
            description: '',
        });
        setIsCustomType(false);
        setIsModalOpen(true);
    };

    const editAccount = (account: Account) => {
        setEditingId(account.id);

        // Check if it's a custom type
        const isCustom = !PREDEFINED_ACCOUNT_TYPES.includes(account.account_type);
        setIsCustomType(isCustom);

        setFormData({
            account_type: isCustom ? '__CUSTOM__' : account.account_type,
            custom_account_type: isCustom ? account.account_type : '',
            account_name: account.account_name,
            description: account.description || '',
        });
        setIsModalOpen(true);
    };

    const closeAccountModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setIsCustomType(false);
    };

    const toggleCustomType = (value: string) => {
        setIsCustomType(value === '__CUSTOM__');
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const saveAccount = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate custom account type
        if (formData.account_type === '__CUSTOM__') {
            if (!formData.custom_account_type.trim()) {
                alert('Please enter a custom account type');
                return;
            }
        }

        const accountType = formData.account_type === '__CUSTOM__'
            ? formData.custom_account_type.trim()
            : formData.account_type;

        // TODO: Replace with actual API call
        // const url = editingId
        //     ? `/api/chart-of-accounts/${editingId}/update`
        //     : '/api/chart-of-accounts/add';

        console.log('Saving account:', { ...formData, account_type: accountType });

        // Mock success - in real implementation, make API call
        alert(editingId ? 'Account updated successfully!' : 'Account created successfully!');
        closeAccountModal();
        // loadAccounts(); // Uncomment when API is ready
    };

    const deleteAccount = async (id: number, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) {
            return;
        }

        // TODO: Replace with actual API call
        console.log('Deleting account:', id);
        alert('Account deleted successfully!');
        // loadAccounts(); // Uncomment when API is ready
    };

    const importDefaultAccounts = async () => {
        if (!confirm('This will import 40+ default accounts covering common business expenses, income, and assets.\n\nExisting accounts will not be affected.\n\nProceed?')) {
            return;
        }

        // TODO: Replace with actual API call
        console.log('Importing default accounts');
        alert('Default accounts imported successfully!');
        // loadAccounts(); // Uncomment when API is ready
    };

    const importCustomAccounts = async () => {
        if (!confirm('This will import a comprehensive chart of accounts including:\n\n• EQUITY accounts (Retained Earning, Share Capital, Profit/Loss)\n• CURRENT LIABILITIES (Accruals, Deposits, Loans, etc.)\n• CURRENT ASSETS (Bank Balance, Petty Cash, Debtors, etc.)\n• FIXED ASSETS (Fixed Asset, Accumulated Depreciation)\n• INCOME accounts (Revenue, Other Income)\n• COST OF SALES\n• ADMIN EXPENSES (30+ detailed expense accounts)\n• FINANCE COST (Bank charges, Interest, etc.)\n• OTHER EXPENSES (20+ miscellaneous expenses)\n• TAX EXPENSES\n\nExisting accounts will not be affected.\n\nProceed?')) {
            return;
        }

        // TODO: Replace with actual API call
        console.log('Importing custom accounts');
        alert('Custom accounts imported successfully!');
        // loadAccounts(); // Uncomment when API is ready
    };

    return (
        <AppLayout pageName="Chart of Accounts">
            <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border)]">
                    <div className="flex flex-wrap justify-between items-start gap-4">
                        <div>
                            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                                Chart of Accounts
                            </h2>
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                Define your custom accounts with descriptions for AI-powered classification
                            </p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            <button
                                onClick={importDefaultAccounts}
                                className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-gray-800 hover:text-white dark:hover:bg-gray-800 transition-colors"
                                title="Import 40+ pre-configured accounts"
                            >
                                <span className="mr-2">📥</span>
                                Import Defaults
                            </button>
                            <button
                                onClick={importCustomAccounts}
                                className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-gray-800 hover:text-white dark:hover:bg-gray-800 transition-colors"
                                title="Import custom chart of accounts"
                            >
                                <span className="mr-2">📋</span>
                                Import Custom COA
                            </button>
                            <button
                                onClick={showAddAccountModal}
                                className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
                            >
                                <span className="mr-2">➕</span>
                                Add Account
                            </button>
                        </div>
                    </div>
                </div>

                {/* Account Groups */}
                <div className="p-6">
                    {accountTypes.map(accountType => (
                        <div
                            key={accountType}
                            className="mb-8 pb-6 border-b border-[var(--border)] last:border-b-0"
                        >
                            <h3
                                className="text-base font-bold mb-4 px-3 py-2 rounded border-l-4"
                                style={{
                                    color: 'var(--accent)',
                                    backgroundColor: 'rgba(106,166,255,0.1)',
                                    borderLeftColor: 'var(--primary)',
                                }}
                            >
                                {accountType}
                            </h3>

                            {accountGroups[accountType] && accountGroups[accountType].length > 0 ? (
                                <table className="w-full">
                                    <thead className="bg-[var(--muted)] border-b border-[var(--border)]">
                                        <tr>
                                            <th
                                                className="px-4 py-3 text-left text-sm font-semibold"
                                                style={{ width: '30%', color: 'var(--foreground)' }}
                                            >
                                                Account Name
                                            </th>
                                            <th
                                                className="px-4 py-3 text-left text-sm font-semibold"
                                                style={{ width: '50%', color: 'var(--foreground)' }}
                                            >
                                                Description
                                            </th>
                                            <th
                                                className="px-4 py-3 text-left text-sm font-semibold"
                                                style={{ width: '20%', color: 'var(--foreground)' }}
                                            >
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border)]">
                                        {accountGroups[accountType].map(account => (
                                            <tr
                                                key={account.id}
                                                className="hover:bg-gray-800 hover:text-white dark:hover:bg-gray-900 transition-colors"
                                            >
                                                <td className="px-4 py-3">
                                                    <strong>{account.account_name}</strong>
                                                </td>
                                                <td
                                                    className="px-4 py-3 text-sm"
                                                    style={{ color: 'var(--muted-foreground)' }}
                                                >
                                                    {account.description || '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => editAccount(account)}
                                                            className="px-3 py-1 text-sm border border-[var(--border)] rounded hover:bg-[var(--primary)] hover:text-white hover:border-[var(--primary)] transition-colors"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => deleteAccount(account.id, account.account_name)}
                                                            className="px-3 py-1 text-sm border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition-colors"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div
                                    className="py-5 px-4 text-center text-sm italic rounded-lg"
                                    style={{
                                        color: 'var(--muted-foreground)',
                                        backgroundColor: 'rgba(255,255,255,0.03)',
                                    }}
                                >
                                    No accounts defined for this type yet.
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Add/Edit Account Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            closeAccountModal();
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
                                {editingId ? 'Edit Account' : 'Add Account'}
                            </h3>
                            <button
                                onClick={closeAccountModal}
                                className="w-8 h-8 flex items-center justify-center rounded-md text-2xl transition-colors hover:bg-white/10"
                                style={{ color: 'var(--muted-foreground)' }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={saveAccount} className="p-6">
                            {/* Account Type */}
                            <div className="mb-4">
                                <label
                                    className="block mb-2 text-sm font-semibold"
                                    style={{ color: 'var(--foreground)' }}
                                >
                                    Account Type *
                                </label>
                                <select
                                    value={formData.account_type}
                                    onChange={(e) => {
                                        handleInputChange('account_type', e.target.value);
                                        toggleCustomType(e.target.value);
                                    }}
                                    required
                                    className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                    style={{
                                        backgroundColor: 'var(--background)',
                                        borderColor: 'var(--border)',
                                        color: 'var(--foreground)',
                                    }}
                                >
                                    <option value="">-- Select Type --</option>
                                    {PREDEFINED_ACCOUNT_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                    <option value="__CUSTOM__">Other (Custom Type)</option>
                                </select>
                            </div>

                            {/* Custom Account Type */}
                            {isCustomType && (
                                <div className="mb-4">
                                    <label
                                        className="block mb-2 text-sm font-semibold"
                                        style={{ color: 'var(--foreground)' }}
                                    >
                                        Custom Account Type *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.custom_account_type}
                                        onChange={(e) => handleInputChange('custom_account_type', e.target.value)}
                                        placeholder="Enter custom account type"
                                        required={isCustomType}
                                        className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                        style={{
                                            backgroundColor: 'var(--background)',
                                            borderColor: 'var(--border)',
                                            color: 'var(--foreground)',
                                        }}
                                    />
                                </div>
                            )}

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
                                    placeholder="e.g., Software Subscriptions"
                                    required
                                    className="w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                    style={{
                                        backgroundColor: 'var(--background)',
                                        borderColor: 'var(--border)',
                                        color: 'var(--foreground)',
                                    }}
                                />
                            </div>

                            {/* Description */}
                            <div className="mb-4">
                                <label
                                    className="block mb-2 text-sm font-semibold"
                                    style={{ color: 'var(--foreground)' }}
                                >
                                    Description (for AI matching)
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    placeholder="Keywords: software, saas, subscription, license, cloud service"
                                    rows={3}
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
                                    Add keywords that commonly appear in invoice line descriptions. The AI will use these to classify expenses.
                                </p>
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
                                    Save Account
                                </button>
                                <button
                                    type="button"
                                    onClick={closeAccountModal}
                                    className="flex-1 px-4 py-2 border border-[var(--border)] rounded-md hover:bg-gray-800 hover:text-white dark:hover:bg-gray-800 transition-colors"
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

export default ChartOfAccounts;
