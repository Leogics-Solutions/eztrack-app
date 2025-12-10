'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import {
    listChartOfAccounts,
    createChartOfAccount,
    updateChartOfAccount,
    deleteChartOfAccount,
    importDefaultChartOfAccounts,
    updateDefaultCoaKeywords,
    ChartOfAccount,
} from "@/services";

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

// Backend account type codes (mapped to human labels via translations)
const PREDEFINED_ACCOUNT_TYPES = [
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'INCOME',
    'EXPENSE',
    'COGS',
];

// Mapping of variations to standard account types (case-insensitive, flexible matching)
const ACCOUNT_TYPE_VARIATIONS: { [key: string]: string } = {
    // ASSET variations
    'asset': 'ASSET',
    'assets': 'ASSET',
    'Asset': 'ASSET',
    'Assets': 'ASSET',
    'ASSET': 'ASSET',
    'ASSETS': 'ASSET',
    
    // LIABILITY variations
    'liability': 'LIABILITY',
    'liabilities': 'LIABILITY',
    'Liability': 'LIABILITY',
    'Liabilities': 'LIABILITY',
    'LIABILITY': 'LIABILITY',
    'LIABILITIES': 'LIABILITY',
    
    // EQUITY variations
    'equity': 'EQUITY',
    'equities': 'EQUITY',
    'Equity': 'EQUITY',
    'Equities': 'EQUITY',
    'EQUITY': 'EQUITY',
    'EQUITIES': 'EQUITY',
    
    // INCOME variations
    'income': 'INCOME',
    'revenue': 'INCOME',
    'revenues': 'INCOME',
    'Income': 'INCOME',
    'Revenue': 'INCOME',
    'Revenues': 'INCOME',
    'INCOME': 'INCOME',
    'REVENUE': 'INCOME',
    'REVENUES': 'INCOME',
    
    // EXPENSE variations
    'expense': 'EXPENSE',
    'expenses': 'EXPENSE',
    'Expense': 'EXPENSE',
    'Expenses': 'EXPENSE',
    'EXPENSE': 'EXPENSE',
    'EXPENSES': 'EXPENSE',
    
    // COGS variations
    'cogs': 'COGS',
    'cost of goods sold': 'COGS',
    'cost of goods': 'COGS',
    'COGS': 'COGS',
    'Cost of Goods Sold': 'COGS',
    'Cost Of Goods Sold': 'COGS',
};

/**
 * Normalize an account type to a standard predefined type (case-insensitive, flexible matching)
 * Returns the normalized type if it matches a predefined type, otherwise returns the original type
 */
const normalizeAccountType = (accountType: string): string => {
    if (!accountType) return accountType;
    
    const normalized = accountType.trim();
    const lower = normalized.toLowerCase();
    
    // Check exact match first (fast path)
    if (PREDEFINED_ACCOUNT_TYPES.includes(normalized)) {
        return normalized;
    }
    
    // Check variations mapping
    if (ACCOUNT_TYPE_VARIATIONS[lower]) {
        return ACCOUNT_TYPE_VARIATIONS[lower];
    }
    
    // Check case-insensitive match with predefined types
    const matchedType = PREDEFINED_ACCOUNT_TYPES.find(
        type => type.toLowerCase() === lower
    );
    if (matchedType) {
        return matchedType;
    }
    
    // If no match found, return original (custom type)
    return normalized;
};

/**
 * Check if an account type matches any predefined type (flexible matching)
 */
const isPredefinedAccountType = (accountType: string): boolean => {
    const normalized = normalizeAccountType(accountType);
    return PREDEFINED_ACCOUNT_TYPES.includes(normalized);
};

const ChartOfAccounts = () => {
    const { t } = useLanguage();
    // State
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountTypes] = useState<string[]>(PREDEFINED_ACCOUNT_TYPES);
    const [accountGroups, setAccountGroups] = useState<AccountGroups>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCustomType, setIsCustomType] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

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
        try {
            setIsLoading(true);
            const response = await listChartOfAccounts({ active_only: true });
            const mapped: Account[] = response.data.map((item: ChartOfAccount) => ({
                id: item.id,
                account_name: item.account_name,
                account_type: item.account_type,
                description: item.description || '',
                example_items: item.examples || '',
            }));
            setAccounts(mapped);
        } catch (error: any) {
            console.error('Failed to load chart of accounts', error);
            alert(error?.message || 'Failed to load chart of accounts');
        } finally {
            setIsLoading(false);
        }
    };

    const groupAccountsByType = () => {
        const grouped: AccountGroups = {};

        // Initialize all account types with empty arrays
        accountTypes.forEach(type => {
            grouped[type] = [];
        });

        // Group accounts (normalize account types for flexible matching)
        accounts.forEach(account => {
            const normalizedType = normalizeAccountType(account.account_type);
            
            // If it matches a predefined type, group it there
            if (PREDEFINED_ACCOUNT_TYPES.includes(normalizedType)) {
                if (!grouped[normalizedType]) {
                    grouped[normalizedType] = [];
                }
                grouped[normalizedType].push(account);
            } else {
                // Custom type - group by original type (preserve original casing)
                const customType = account.account_type;
                if (!grouped[customType]) {
                    grouped[customType] = [];
                }
                grouped[customType].push(account);
            }
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

        // Check if it's a custom type (using flexible matching)
        const normalizedType = normalizeAccountType(account.account_type);
        const isCustom = !PREDEFINED_ACCOUNT_TYPES.includes(normalizedType);
        setIsCustomType(isCustom);

        setFormData({
            account_type: isCustom ? '__CUSTOM__' : normalizedType,
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

        try {
            const description = formData.description.trim() || undefined;
            const examples = formData.example_items.trim() || undefined;

            if (editingId) {
                await updateChartOfAccount(editingId, {
                    account_type: accountType,
                    account_name: formData.account_name.trim(),
                    description,
                    examples,
                });
                alert(t.accounts.accountUpdated);
            } else {
                await createChartOfAccount({
                    account_type: accountType,
                    account_name: formData.account_name.trim(),
                    description,
                    examples,
                    is_active: true,
                });
                alert(t.accounts.accountCreated);
            }
            closeAccountModal();
            await loadAccounts();
        } catch (error: any) {
            console.error('Failed to save account', error);
            alert(error?.message || 'Failed to save account');
        }
    };

    const deleteAccount = async (id: number, name: string) => {
        if (!confirm(t.accounts.deleteConfirm.replace('{name}', name))) {
            return;
        }

        try {
            await deleteChartOfAccount(id);
            alert(t.accounts.accountDeleted);
            await loadAccounts();
        } catch (error: any) {
            console.error('Failed to delete account', error);
            alert(error?.message || 'Failed to delete account');
        }
    };

    const importDefaultAccounts = async () => {
        if (!confirm(t.accounts.importDefaultsConfirm)) {
            return;
        }

        try {
            await importDefaultChartOfAccounts();
            alert(t.accounts.importDefaultsSuccess);
            await loadAccounts();
        } catch (error: any) {
            console.error('Failed to import default accounts', error);
            alert(error?.message || 'Failed to import default accounts');
        }
    };

    const importCustomAccounts = async () => {
        if (!confirm(t.accounts.importCustomCOAConfirm)) {
            return;
        }

        try {
            await updateDefaultCoaKeywords();
            alert(t.accounts.importCustomCOASuccess);
            await loadAccounts();
        } catch (error: any) {
            console.error('Failed to update default COA keywords', error);
            alert(error?.message || 'Failed to update default COA keywords');
        }
    };

    // Map backend account type codes to translations (with flexible matching)
    const getAccountTypeLabel = (type: string) => {
        // Normalize the type first for flexible matching
        const normalizedType = normalizeAccountType(type);
        
        const typeMap: { [key: string]: string } = {
            'ASSET': t.accounts.accountTypes.assets,
            'LIABILITY': t.accounts.accountTypes.liabilities,
            'EQUITY': t.accounts.accountTypes.equity,
            'INCOME': t.accounts.accountTypes.income,
            'EXPENSE': t.accounts.accountTypes.expenses,
            'COGS': t.accounts.accountTypes.costOfGoodsSold,
        };
        
        // Return translated label if it's a predefined type, otherwise return original
        return typeMap[normalizedType] || type;
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
                    {isLoading && (
                        <div
                            className="mb-4 text-sm italic"
                            style={{ color: 'var(--muted-foreground)' }}
                        >
                            {t.common?.loading || 'Loading accounts...'}
                        </div>
                    )}
                    {/* Predefined Account Types */}
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
                    
                    {/* Custom Account Types */}
                    {Object.keys(accountGroups)
                        .filter(type => !PREDEFINED_ACCOUNT_TYPES.includes(type))
                        .map(customType => (
                            <div
                                key={customType}
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
                                    {getAccountTypeLabel(customType)}
                                </h3>

                                {accountGroups[customType] && accountGroups[customType].length > 0 ? (
                                    <>
                                        {/* Mobile Card Layout */}
                                        <div className="md:hidden space-y-3">
                                            {accountGroups[customType].map(account => (
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
                                                    {accountGroups[customType].map(account => (
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
