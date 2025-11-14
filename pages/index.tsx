'use client';

import { AppLayout } from "@/components/layout";
import { useState } from "react";
import { Line, Pie, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Dummy Data
const DUMMY_VENDORS = [
  { id: 1, name: 'Acme Corporation' },
  { id: 2, name: 'TechSupply Co.' },
  { id: 3, name: 'Global Services Ltd.' },
  { id: 4, name: 'Digital Solutions Inc.' },
  { id: 5, name: 'Enterprise Systems' },
];

const DUMMY_CATEGORY_DATA = [
  { category: 'Office Supplies', total: 12500.50 },
  { category: 'Software Licenses', total: 45000.00 },
  { category: 'Hardware', total: 28750.75 },
  { category: 'Consulting', total: 65000.00 },
  { category: 'Marketing', total: 18900.25 },
];

const DUMMY_VENDOR_DATA = [
  { vendor_name: 'Acme Corporation', total: 85000.00 },
  { vendor_name: 'TechSupply Co.', total: 52000.00 },
  { vendor_name: 'Global Services Ltd.', total: 38500.00 },
  { vendor_name: 'Digital Solutions Inc.', total: 29750.50 },
  { vendor_name: 'Enterprise Systems', total: 15900.00 },
];

const DUMMY_MONTHLY_DATA = [
  { month: 'Jan 2025', total: 45000 },
  { month: 'Feb 2025', total: 52000 },
  { month: 'Mar 2025', total: 48500 },
  { month: 'Apr 2025', total: 61000 },
  { month: 'May 2025', total: 58500 },
  { month: 'Jun 2025', total: 72000 },
];

const DUMMY_STATUS_DATA = [
  { status: 'draft', count: 15 },
  { status: 'validated', count: 28 },
  { status: 'posted', count: 42 },
];

const DUMMY_RECENT_LOGS = [
  { created_at: '2025-11-14 10:30', entity: 'Invoice', entity_id: '1234', action: 'created', details: 'New invoice created for Acme Corporation' },
  { created_at: '2025-11-14 09:15', entity: 'Invoice', entity_id: '1233', action: 'validated', details: 'Invoice validated and ready for posting' },
  { created_at: '2025-11-14 08:45', entity: 'Vendor', entity_id: '567', action: 'updated', details: 'Vendor information updated' },
  { created_at: '2025-11-13 16:20', entity: 'Invoice', entity_id: '1232', action: 'posted', details: 'Invoice posted to accounting system' },
  { created_at: '2025-11-13 14:10', entity: 'Invoice', entity_id: '1231', action: 'created', details: 'New invoice created for TechSupply Co.' },
];

interface Filters {
  date_from: string;
  date_to: string;
  vendor_id: string;
  status: string[];
}

export default function Home() {
  const [filters, setFilters] = useState<Filters>({
    date_from: '',
    date_to: '',
    vendor_id: '',
    status: ['draft', 'validated', 'posted'],
  });

  const [kpis] = useState({
    total_value: 221150.50,
    invoices_total: 85,
    outstanding: 78450.25,
    invoices_pending: 15,
    avg_value: 2601.77,
  });

  // Chart color palette
  const chartColors = {
    primary: ['#6aa6ff', '#8a7bff', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'],
    background: [
      'rgba(106,166,255,0.2)',
      'rgba(138,123,255,0.2)',
      'rgba(34,197,94,0.2)',
      'rgba(245,158,11,0.2)',
      'rgba(239,68,68,0.2)',
      'rgba(139,92,246,0.2)',
      'rgba(236,72,153,0.2)',
      'rgba(20,184,166,0.2)',
      'rgba(249,115,22,0.2)',
      'rgba(6,182,212,0.2)',
    ],
  };

  const handleFilterChange = (name: string, value: any) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (status: string) => {
    setFilters(prev => {
      const currentStatus = prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status];
      return { ...prev, status: currentStatus };
    });
  };

  const setDatePreset = (preset: string) => {
    const today = new Date();
    let dateFrom: Date;
    const dateTo = today;

    switch (preset) {
      case 'today':
        dateFrom = today;
        break;
      case 'week':
        dateFrom = new Date(today);
        dateFrom.setDate(today.getDate() - 7);
        break;
      case 'month':
        dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        dateFrom = new Date(today.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        dateFrom = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        dateFrom = today;
    }

    setFilters(prev => ({
      ...prev,
      date_from: dateFrom.toISOString().split('T')[0],
      date_to: dateTo.toISOString().split('T')[0],
    }));
  };

  const resetFilters = () => {
    setFilters({
      date_from: '',
      date_to: '',
      vendor_id: '',
      status: ['draft', 'validated', 'posted'],
    });
  };

  // Chart Data
  const categoryChartData = {
    labels: DUMMY_CATEGORY_DATA.map(item => item.category),
    datasets: [{
      data: DUMMY_CATEGORY_DATA.map(item => item.total),
      backgroundColor: chartColors.background,
      borderColor: chartColors.primary,
      borderWidth: 2,
    }],
  };

  const vendorChartData = {
    labels: DUMMY_VENDOR_DATA.map(item => item.vendor_name),
    datasets: [{
      label: 'Total Spend (MYR)',
      data: DUMMY_VENDOR_DATA.map(item => item.total),
      backgroundColor: 'rgba(106,166,255,0.6)',
      borderColor: '#6aa6ff',
      borderWidth: 2,
      borderRadius: 6,
    }],
  };

  const monthlyChartData = {
    labels: DUMMY_MONTHLY_DATA.map(item => item.month),
    datasets: [{
      label: 'Invoice Total (MYR)',
      data: DUMMY_MONTHLY_DATA.map(item => item.total),
      borderColor: '#6aa6ff',
      backgroundColor: 'rgba(106,166,255,0.1)',
      fill: true,
      tension: 0.4,
      borderWidth: 3,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: '#6aa6ff',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
    }],
  };

  const statusChartData = {
    labels: DUMMY_STATUS_DATA.map(item => item.status.charAt(0).toUpperCase() + item.status.slice(1)),
    datasets: [{
      data: DUMMY_STATUS_DATA.map(item => item.count),
      backgroundColor: chartColors.background.slice(0, DUMMY_STATUS_DATA.length),
      borderColor: chartColors.primary.slice(0, DUMMY_STATUS_DATA.length),
      borderWidth: 2,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          font: { size: 11 },
          color: '#9aa4b2',
        },
      },
    },
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            Dashboard
          </h1>
          <p style={{ color: 'var(--muted-foreground)' }}>
            Track and analyze your invoice data with comprehensive insights
          </p>
        </div>

        {/* Filter Panel */}
        <div className="rounded-lg p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>📊 Dashboard Filters</h3>
            <button
              onClick={resetFilters}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all border"
              style={{
                background: 'var(--secondary)',
                color: 'var(--secondary-foreground)',
                borderColor: 'var(--border)',
              }}
            >
              ↻ Reset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Date From */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                📅 Date From
              </label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                📅 Date To
              </label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Vendor Filter */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                🏢 Vendor
              </label>
              <select
                value={filters.vendor_id}
                onChange={(e) => handleFilterChange('vendor_id', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                <option value="">All Vendors</option>
                {DUMMY_VENDORS.map(vendor => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                📋 Status
              </label>
              <div className="space-y-2">
                {['draft', 'validated', 'posted'].map(status => (
                  <label key={status} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.status.includes(status)}
                      onChange={() => handleStatusChange(status)}
                      className="rounded"
                    />
                    <span className="text-sm capitalize" style={{ color: 'var(--foreground)' }}>
                      {status}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap gap-2">
            {['today', 'week', 'month', 'quarter', 'year'].map(preset => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                }}
              >
                {preset === 'today' ? 'Today' : `This ${preset.charAt(0).toUpperCase() + preset.slice(1)}`}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Invoice Value */}
          <div
            className="rounded-lg p-6 border transition-all hover:shadow-lg"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-3xl mb-2">💰</div>
                <div className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                  MYR {kpis.total_value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Total Invoice Value
                </div>
              </div>
            </div>
          </div>

          {/* Total Invoices */}
          <div
            className="rounded-lg p-6 border transition-all hover:shadow-lg"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-3xl mb-2">📊</div>
                <div className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                  {kpis.invoices_total}
                </div>
                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Total Invoices
                </div>
              </div>
            </div>
          </div>

          {/* Outstanding Amount */}
          <div
            className="rounded-lg p-6 border transition-all hover:shadow-lg"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-3xl mb-2">⏳</div>
                <div className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                  MYR {kpis.outstanding.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Outstanding Amount
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {kpis.invoices_pending} invoices pending
                </div>
              </div>
            </div>
          </div>

          {/* Average Invoice Value */}
          <div
            className="rounded-lg p-6 border transition-all hover:shadow-lg"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-3xl mb-2">📈</div>
                <div className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                  MYR {kpis.avg_value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Average Invoice Value
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expense Breakdown Chart */}
          <div
            className="rounded-lg p-6 border"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              💸 Expense Breakdown by Category
            </h3>
            <div className="h-64">
              <Pie data={categoryChartData} options={chartOptions} />
            </div>
          </div>

          {/* Top Vendors Chart */}
          <div
            className="rounded-lg p-6 border"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              🏢 Top Vendors by Spend
            </h3>
            <div className="h-64">
              <Bar
                data={vendorChartData}
                options={{
                  ...chartOptions,
                  indexAxis: 'y' as const,
                  plugins: {
                    legend: { display: false },
                  },
                }}
              />
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <div
            className="rounded-lg p-6 border lg:col-span-1"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              📈 Monthly Invoice Trend
            </h3>
            <div className="h-64">
              <Line data={monthlyChartData} options={chartOptions} />
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-1"></div>

          {/* Status Distribution Chart */}
          <div
            className="rounded-lg p-6 border lg:col-span-1"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              📋 Invoice Status Distribution
            </h3>
            <div className="h-64">
              <Doughnut data={statusChartData} options={chartOptions} />
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-1"></div>
        </div>

        {/* Recent Activity */}
        <div
          className="rounded-lg p-6 border"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
            Recent Activity
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>Time</th>
                  <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>Entity</th>
                  <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>Action</th>
                  <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {DUMMY_RECENT_LOGS.map((log, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--foreground)' }}>
                      {log.created_at}
                    </td>
                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--foreground)' }}>
                      {log.entity}#{log.entity_id}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          background: log.action === 'created' ? 'var(--info)' :
                            log.action === 'validated' ? 'var(--warning)' :
                              log.action === 'posted' ? 'var(--success)' : 'var(--secondary)',
                          color: 'white',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm truncate max-w-md" style={{ color: 'var(--muted-foreground)' }}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
