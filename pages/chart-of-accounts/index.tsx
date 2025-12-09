'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";

// Types
interface Account {
    id: number;
    account_name: string;
    account_type: string;
    description?: string;
    example_items?: string;
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
    const { t } = useLanguage();
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
        example_items: '',
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
            example_items: '',
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
            example_items: (account as any).example_items || '',
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
                alert(t.accounts.customTypeRequired);
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
        alert(editingId ? t.accounts.accountUpdated : t.accounts.accountCreated);
        closeAccountModal();
        // loadAccounts(); // Uncomment when API is ready
    };

    const deleteAccount = async (id: number, name: string) => {
        if (!confirm(t.accounts.deleteConfirm.replace('{name}', name))) {
            return;
        }

        // TODO: Replace with actual API call
        console.log('Deleting account:', id);
        alert(t.accounts.accountDeleted);
        // loadAccounts(); // Uncomment when API is ready
    };

    const importDefaultAccounts = async () => {
        if (!confirm(t.accounts.importDefaultsConfirm)) {
            return;
        }

        // TODO: Replace with actual API call
        console.log('Importing default accounts');
        alert(t.accounts.importDefaultsSuccess);
        // loadAccounts(); // Uncomment when API is ready
    };

    const importCustomAccounts = async () => {
        if (!confirm(t.accounts.importCustomCOAConfirm)) {
            return;
        }

        // TODO: Replace with actual API call
        console.log('Importing custom accounts');
        alert(t.accounts.importCustomCOASuccess);
        // loadAccounts(); // Uncomment when API is ready
    };

    // Map account types to translations
    const getAccountTypeLabel = (type: string) => {
        const typeMap: { [key: string]: string } = {
            'Assets': t.accounts.accountTypes.assets,
            'Liabilities': t.accounts.accountTypes.liabilities,
            'Equity': t.accounts.accountTypes.equity,
            'Income': t.accounts.accountTypes.income,
            'Expenses': t.accounts.accountTypes.expenses,
            'Cost of Goods Sold': t.accounts.accountTypes.costOfGoodsSold,
        };
        return typeMap[type] || type;
    };

    return (
        <AppLayout pageName={t.accounts.title}>
            <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
                {/* Header */}
                <div className="p-4 md:p-6 border-b border-[var(--border)]">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                                {t.accounts.title}
                            </h2>
                            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                {t.accounts.description}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                            <button
                                onClick={importDefaultAccounts}
                                className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors text-sm"
                                title={t.accounts.importDefaultsTitle}
                            >
                                <span className="mr-2">📥</span>
                                {t.accounts.importDefaults}
                            </button>
                            <button
                                onClick={importCustomAccounts}
                                className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors text-sm"
                                title={t.accounts.importCustomCOATitle}
                            >
                                <span className="mr-2">📋</span>
                                {t.accounts.importCustomCOA}
                            </button>
                            <button
                                onClick={() => showAddAccountModal()}
                                className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors flex items-center justify-center text-sm"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {t.accounts.newAccount}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Account Groups */}
                <div className="p-4 md:p-6">
                    {accountTypes.map(accountType => (
                        <div
                            key={accountType}
                            className="mb-6 md:mb-8 pb-4 md:pb-6 border-b border-[var(--border)] last:border-b-0"
                        >
                            <h3
                                className="text-sm md:text-base font-bold mb-3 md:mb-4 px-3 py-2 rounded border-l-4"
                                style={{
                                    color: 'var(--accent)',
                                    backgroundColor: 'rgba(106,166,255,0.1)',
                                    borderLeftColor: 'var(--primary)',
                                }}
                            >
                                {getAccountTypeLabel(accountType)}
                            </h3>

                            {accountGroups[accountType] && accountGroups[accountType].length > 0 ? (
                                <>
                                    {/* Mobile Card Layout */}
                                    <div className="md:hidden space-y-3">
                                        {accountGroups[accountType].map(account => (
                                            <div
                                                key={account.id}
                                                className="border border-[var(--border)] rounded-lg overflow-hidden"
                                                style={{ backgroundColor: 'var(--card)' }}
                                            >
                                                <div className="p-4">
                                                    <h4 className="font-semibold text-base mb-1" style={{ color: 'var(--foreground)' }}>
                                                        {account.account_name}
                                                    </h4>
                                                    {account.description && (
                                                        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                                            {account.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex w-full border-t" style={{ borderTopColor: 'var(--border)' }}>
                                                    <button
                                                        onClick={() => editAccount(account)}
                                                        className="flex-1 flex items-center justify-center py-3 border-r transition-colors"
                                                        style={{ 
                                                            borderRightColor: 'var(--border)',
                                                            color: 'var(--foreground)'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'var(--primary)';
                                                            e.currentTarget.style.color = 'var(--primary-foreground)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'transparent';
                                                            e.currentTarget.style.color = 'var(--foreground)';
                                                        }}
                                                        aria-label={t.accounts.edit}
                                                    >
                                                        <Edit className="h-5 w-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteAccount(account.id, account.account_name)}
                                                        className="flex-1 flex items-center justify-center py-3 transition-colors"
                                                        style={{ color: 'var(--error)' }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'var(--error)';
                                                            e.currentTarget.style.color = 'white';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'transparent';
                                                            e.currentTarget.style.color = 'var(--error)';
                                                        }}
                                                        aria-label={t.accounts.delete}
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop Table Layout */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full min-w-[600px]">
                                            <thead className="bg-[var(--muted)] border-b border-[var(--border)]">
                                                <tr>
                                                    <th
                                                        className="px-4 py-3 text-left text-sm font-semibold"
                                                        style={{ width: '30%', color: 'var(--foreground)' }}
                                                    >
                                                        {t.accounts.accountNameHeader}
                                                    </th>
                                                    <th
                                                        className="px-4 py-3 text-left text-sm font-semibold"
                                                        style={{ width: '50%', color: 'var(--foreground)' }}
                                                    >
                                                        {t.accounts.descriptionHeader}
                                                    </th>
                                                    <th
                                                        className="px-4 py-3 text-left text-sm font-semibold"
                                                        style={{ width: '20%', color: 'var(--foreground)' }}
                                                    >
                                                        {t.accounts.actionsHeader}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--border)]">
                                                {accountGroups[accountType].map(account => (
                                                    <tr
                                                        key={account.id}
                                                        className="hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <strong className="text-base">{account.account_name}</strong>
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
                                                                    className="px-3 py-1 text-sm border border-[var(--border)] rounded hover:bg-[var(--primary)] hover:text-white hover:border-[var(--primary)] transition-colors whitespace-nowrap"
                                                                >
                                                                    {t.accounts.edit}
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteAccount(account.id, account.account_name)}
                                                                    className="px-3 py-1 text-sm border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition-colors whitespace-nowrap"
                                                                >
                                                                    {t.accounts.delete}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div
                                    className="py-5 px-4 text-center text-sm italic rounded-lg"
                                    style={{
                                        color: 'var(--muted-foreground)',
                                        backgroundColor: 'rgba(255,255,255,0.03)',
                                    }}
                                >
                                    {t.accounts.noAccounts}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Add/Edit Account Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center md:items-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            closeAccountModal();
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
                                {editingId ? t.accounts.editAccount : t.accounts.addAccount}
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
                        <form onSubmit={saveAccount} className="p-4 md:p-6">
                            {/* Account Type */}
                            <div className="mb-4">
                                <label
                                    className="block mb-2 text-sm font-semibold"
                                    style={{ color: 'var(--foreground)' }}
                                >
                                    {t.accounts.accountType} *
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
                                    <option value="">{t.accounts.selectType}</option>
                                    {PREDEFINED_ACCOUNT_TYPES.map(type => (
                                        <option key={type} value={type}>{getAccountTypeLabel(type)}</option>
                                    ))}
                                    <option value="__CUSTOM__">{t.accounts.customType}</option>
                                </select>
                            </div>

                            {/* Custom Account Type */}
                            {isCustomType && (
                                <div className="mb-4">
                                    <label
                                        className="block mb-2 text-sm font-semibold"
                                        style={{ color: 'var(--foreground)' }}
                                    >
                                        {t.accounts.customAccountType} *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.custom_account_type}
                                        onChange={(e) => handleInputChange('custom_account_type', e.target.value)}
                                        placeholder={t.accounts.customAccountTypePlaceholder}
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
                                    {t.accounts.accountName} *
                                </label>
                                <input
                                    type="text"
                                    value={formData.account_name}
                                    onChange={(e) => handleInputChange('account_name', e.target.value)}
                                    placeholder={t.accounts.accountNamePlaceholder}
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
                                    {t.accounts.descriptionLabel}
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    placeholder={t.accounts.descriptionPlaceholder}
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
                                    {t.accounts.descriptionHelp}
                                </p>
                            </div>

                            {/* Example Items */}
                            <div className="mb-4">
                                <label
                                    className="block mb-2 text-sm font-semibold"
                                    style={{ color: 'var(--foreground)' }}
                                >
                                    {t.accounts.exampleItems}
                                </label>
                                <textarea
                                    value={formData.example_items}
                                    onChange={(e) => handleInputChange('example_items', e.target.value)}
                                    placeholder={t.accounts.exampleItemsPlaceholder}
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
                                    {t.accounts.exampleItemsHelp}
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
                                    {t.accounts.saveAccount}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeAccountModal}
                                    className="flex-1 px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                                >
                                    {t.accounts.cancel}
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
