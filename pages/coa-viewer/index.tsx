'use client';

import { AppLayout } from "@/components/layout";
import { useState, useEffect } from "react";

// Types
interface Account {
    id: number;
    account_name: string;
    account_type: string;
    description?: string;
    total_amount: number;
    transaction_count: number;
    is_active: boolean;
}

interface SortConfig {
    column: string | null;
    direction: 'asc' | 'desc';
}

const COAViewerList = () => {
    // State
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [accountTypes, setAccountTypes] = useState<string[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [totalAmountAll, setTotalAmountAll] = useState(0);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: 'asc' });

    // Filter state
    const [filters, setFilters] = useState({
        account_type: '',
        search: '',
        status: '',
        date_from: '',
        date_to: '',
    });

    // Mock data loading - Replace with actual API calls
    useEffect(() => {
        loadData();
    }, [filters, sortConfig]);

    const loadData = async () => {
        // TODO: Replace with actual API calls
        // Mock data
        const mockAccounts: Account[] = [
            {
                id: 1,
                account_name: 'Cash',
                account_type: 'Asset',
                description: 'Cash on hand and in bank',
                total_amount: 50000.00,
                transaction_count: 125,
                is_active: true,
            },
            {
                id: 2,
                account_name: 'Accounts Receivable',
                account_type: 'Asset',
                description: 'Money owed by customers',
                total_amount: 25000.00,
                transaction_count: 68,
                is_active: true,
            },
            {
                id: 3,
                account_name: 'Office Supplies',
                account_type: 'Expense',
                description: 'Office supplies and stationery',
                total_amount: -5000.00,
                transaction_count: 42,
                is_active: true,
            },
            {
                id: 4,
                account_name: 'Revenue',
                account_type: 'Income',
                description: 'Sales and service revenue',
                total_amount: 150000.00,
                transaction_count: 89,
                is_active: true,
            },
            {
                id: 5,
                account_name: 'Accounts Payable',
                account_type: 'Liability',
                description: 'Money owed to suppliers',
                total_amount: -15000.00,
                transaction_count: 34,
                is_active: true,
            },
        ];

        setAccounts(mockAccounts);
        setAccountTypes(['Asset', 'Liability', 'Equity', 'Income', 'Expense']);
        setTotalCount(mockAccounts.length);
        setTotalAmountAll(mockAccounts.reduce((sum, acc) => sum + acc.total_amount, 0));
    };

    // Filter functions
    const handleFilterChange = (key: string, value: string) => {
        setFilters({ ...filters, [key]: value });
    };

    const clearFilters = () => {
        setFilters({
            account_type: '',
            search: '',
            status: '',
            date_from: '',
            date_to: '',
        });
    };

    // Sort functions
    const sortTable = (column: string) => {
        const currentColumn = sortConfig.column;
        const currentDirection = sortConfig.direction;

        if (currentColumn === column) {
            setSortConfig({ column, direction: currentDirection === 'asc' ? 'desc' : 'asc' });
        } else {
            setSortConfig({ column, direction: 'asc' });
        }
    };

    const getSortIcon = (column: string) => {
        if (sortConfig.column === column) {
            return sortConfig.direction === 'asc' ? '↑' : '↓';
        }
        return '↕️';
    };

    // Export function
    const exportAccounts = () => {
        // TODO: Implement export API call
        console.log('Exporting accounts with filters:', filters);
        alert('Export functionality will be implemented with API integration');
    };

    const getTypeBadgeClass = (type: string) => {
        // Default (unhovered) styles - colorful badges, hover shows muted gray
        const typeMap: Record<string, string> = {
            'Asset': 'bg-blue-100 text-blue-900 group-hover:bg-[var(--hover-bg-light)] group-hover:text-[var(--muted-foreground)] dark:group-hover:bg-[var(--hover-bg)] dark:group-hover:text-[var(--muted-foreground)]',
            'Liability': 'bg-orange-100 text-orange-700  group-hover:bg-[var(--hover-bg-light)] group-hover:text-[var(--muted-foreground)] dark:group-hover:bg-[var(--hover-bg)] dark:group-hover:text-[var(--muted-foreground)]',
            'Equity': 'bg-pink-100 text-pink-700  group-hover:bg-[var(--hover-bg-light)] group-hover:text-[var(--muted-foreground)] dark:group-hover:bg-[var(--hover-bg)] dark:group-hover:text-[var(--muted-foreground)]',
            'Income': 'bg-green-100 text-green-700  group-hover:bg-[var(--hover-bg-light)] group-hover:text-[var(--muted-foreground)] dark:group-hover:bg-[var(--hover-bg)] dark:group-hover:text-[var(--muted-foreground)]',
            'Expense': 'bg-red-100 text-red-700 group-hover:bg-[var(--hover-bg-light)] group-hover:text-[var(--muted-foreground)] dark:group-hover:bg-[var(--hover-bg)] dark:group-hover:text-[var(--muted-foreground)]',
        };
        return typeMap[type] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
    };

    return (
        <AppLayout pageName="Chart of Accounts">
            <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border)] flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold m-0">Chart of Accounts</h2>
                        {totalCount > 0 && (
                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                                Showing {accounts.length} of {totalCount} accounts
                            </p>
                        )}
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <button
                            onClick={() => window.location.href = '/chart-of-accounts'}
                            className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors"
                        >
                            <span className="mr-2">⚙️</span>
                            Manage Accounts
                        </button>
                        <button
                            onClick={exportAccounts}
                            className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
                        >
                            <span className="mr-2">📤</span>
                            Export
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-6 border-b border-[var(--border)] bg-[var(--muted)] dark:bg-[var(--card)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
                        {/* Account Type */}
                        <div>
                            <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase tracking-wide">
                                Account Type
                            </label>
                            <select
                                value={filters.account_type}
                                onChange={(e) => handleFilterChange('account_type', e.target.value)}
                                className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none text-sm"
                            >
                                <option value="">All Types</option>
                                {accountTypes.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Search */}
                        <div>
                            <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase tracking-wide">
                                Search
                            </label>
                            <input
                                type="text"
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                placeholder="Account name or description..."
                                className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none text-sm"
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase tracking-wide">
                                Status
                            </label>
                            <select
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none text-sm"
                            >
                                <option value="">All</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        {/* Date From */}
                        <div>
                            <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase tracking-wide">
                                Date From
                            </label>
                            <input
                                type="date"
                                value={filters.date_from}
                                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                                className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none text-sm"
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase tracking-wide">
                                Date To
                            </label>
                            <input
                                type="date"
                                value={filters.date_to}
                                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                                className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none text-sm"
                            />
                        </div>
                    </div>

                    {/* Clear Button */}
                    <div className="flex justify-end mt-4">
                        <button
                            onClick={clearFilters}
                            className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors text-sm"
                        >
                            <span className="mr-2">🗑️</span>
                            Clear
                        </button>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="p-6 border-b border-[var(--border)] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-[var(--muted)] dark:bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
                        <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                            Total Accounts
                        </div>
                        <div className="text-2xl font-bold text-[var(--accent)]">
                            {accounts.length}
                        </div>
                    </div>

                    <div className="bg-[var(--muted)] dark:bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
                        <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                            Total Amount
                        </div>
                        <div className="text-2xl font-bold text-[var(--accent)]">
                            RM {totalAmountAll.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    {(filters.date_from || filters.date_to) && (
                        <div className="bg-[var(--muted)] dark:bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
                            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                                Date Range
                            </div>
                            <div className="text-sm font-bold text-[var(--primary)]">
                                {filters.date_from || 'Start'} → {filters.date_to || 'End'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-[var(--muted)] border-b border-[var(--border)]">
                            <tr>
                                <th className="px-4 py-3 text-left" style={{ width: '25%' }}>
                                    <button
                                        onClick={() => sortTable('account_name')}
                                        className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                                    >
                                        Account Name
                                        <span className="text-xs opacity-60">{getSortIcon('account_name')}</span>
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left" style={{ width: '15%' }}>
                                    <button
                                        onClick={() => sortTable('account_type')}
                                        className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                                    >
                                        Type
                                        <span className="text-xs opacity-60">{getSortIcon('account_type')}</span>
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]" style={{ width: '30%' }}>
                                    Description
                                </th>
                                <th className="px-4 py-3 text-right" style={{ width: '12%' }}>
                                    <button
                                        onClick={() => sortTable('total_amount')}
                                        className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors ml-auto"
                                    >
                                        Amount
                                        <span className="text-xs opacity-60">{getSortIcon('total_amount')}</span>
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-[var(--foreground)]" style={{ width: '10%' }}>
                                    Transactions
                                </th>
                                <th className="px-4 py-3 text-left" style={{ width: '8%' }}>
                                    <button
                                        onClick={() => sortTable('is_active')}
                                        className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
                                    >
                                        Status
                                        <span className="text-xs opacity-60">{getSortIcon('is_active')}</span>
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {accounts.length > 0 ? (
                                accounts.map((account) => (
                                    <tr
                                        key={account.id}
                                        className="group hover:bg-[var(--hover-bg)] hover:text-[var(--hover-text)] dark:hover:bg-[var(--hover-bg)] transition-colors cursor-pointer"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="font-semibold">{account.account_name}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block px-2 py-1 text-xs rounded-md font-semibold uppercase tracking-wide transition-colors ${getTypeBadgeClass(account.account_type)}`}>
                                                {account.account_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">
                                            {account.description || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`font-mono text-sm font-semibold ${account.total_amount > 0
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : account.total_amount < 0
                                                        ? 'text-red-600 dark:text-red-400'
                                                        : ''
                                                }`}>
                                                RM {account.total_amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-block px-3 py-1 bg-[var(--primary)] text-white rounded-full text-xs font-semibold min-w-[30px]">
                                                {account.transaction_count}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {account.is_active ? (
                                                <span className="inline-block px-2 py-1 text-xs rounded-md font-semibold transition-colors bg-green-100 text-green-700 group-hover:bg-[var(--hover-bg-light)] group-hover:text-[var(--muted-foreground)] dark:group-hover:bg-[var(--hover-bg)] dark:group-hover:text-[var(--muted-foreground)]">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-block px-2 py-1 text-xs rounded-md font-semibold transition-colors bg-red-100 text-red-700 group-hover:bg-[var(--hover-bg-light)] group-hover:text-[var(--muted-foreground)] dark:group-hover:bg-[var(--hover-bg)] dark:group-hover:text-[var(--muted-foreground)]">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-4 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="text-6xl">📊</div>
                                            <h3 className="text-xl font-semibold m-0">No accounts found</h3>
                                            <p className="text-[var(--muted-foreground)] m-0">
                                                Try adjusting your filters or add some accounts first.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                {accounts.length > 0 && (
                    <div className="p-4 border-t border-[var(--border)] bg-[var(--muted)] dark:bg-[var(--card)]">
                        <div className="text-sm text-[var(--muted-foreground)]">
                            Showing {accounts.length} accounts
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

export default COAViewerList;
