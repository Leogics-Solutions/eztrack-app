'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { ArrowLeft, CheckCircle2, XCircle, Link as LinkIcon, AlertCircle } from "lucide-react";
import {
  getBankStatement,
  listInvoices,
  matchInvoices,
  createLinksBulk,
  createLink,
  getStatementLinks,
  deleteLink,
  type BankStatement,
  type TransactionMatchResult,
  type TransactionInvoiceMatch,
  type TransactionInvoiceLink,
  type Invoice,
} from "@/services";
import { useToast } from "@/lib/toast";

const BankReconciliation = () => {
  const router = useRouter();
  const { id } = router.query;
  const { t } = useLanguage();
  const { showToast } = useToast();

  // State
  const [statement, setStatement] = useState<BankStatement | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());
  const [matchResults, setMatchResults] = useState<TransactionMatchResult[]>([]);
  const [links, setLinks] = useState<TransactionInvoiceLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMatching, setIsMatching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Matching options
  const [matchingOptions, setMatchingOptions] = useState({
    date_tolerance_days: 7,
    amount_tolerance_percentage: 2.0,
    currency_tolerance_percentage: 5.0,
    min_match_score: 60.0,
    exclude_linked: true,
  });

  // Invoice filters
  const [invoiceFilters, setInvoiceFilters] = useState({
    status: ['draft', 'validated', 'posted'] as string[],
    vendor_id: '',
    search: '',
  });

  useEffect(() => {
    if (id) {
      loadStatement();
      loadLinks();
    }
  }, [id]);

  useEffect(() => {
    loadInvoices();
  }, [invoiceFilters]);

  const loadStatement = async () => {
    if (!id || typeof id !== 'string') return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getBankStatement(Number(id));
      setStatement(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bank statement');
      showToast(err instanceof Error ? err.message : 'Failed to load bank statement', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const response = await listInvoices({
        page: 1,
        page_size: 1000, // Get all for selection
        status: invoiceFilters.status as any,
        vendor_id: invoiceFilters.vendor_id ? Number(invoiceFilters.vendor_id) : undefined,
        search: invoiceFilters.search || undefined,
      });

      const invoiceData = response.data?.invoices || [];
      setInvoices(invoiceData);

      // Filter out already linked invoices if exclude_linked is true
      if (matchingOptions.exclude_linked && links.length > 0) {
        const linkedInvoiceIds = new Set(links.map(link => link.invoice_id));
        const filtered = invoiceData.filter(inv => !linkedInvoiceIds.has(inv.id));
        setInvoices(filtered);
      }
    } catch (err) {
      console.error('Failed to load invoices', err);
    }
  };

  const loadLinks = async () => {
    if (!id || typeof id !== 'string') return;

    try {
      const response = await getStatementLinks(Number(id));
      setLinks(response.data || []);
    } catch (err) {
      console.error('Failed to load links', err);
    }
  };

  const handleMatch = async () => {
    if (!id || typeof id !== 'string') return;

    if (selectedInvoiceIds.size === 0) {
      showToast(t.bankStatements.reconcile.selectInvoices || 'Please select at least one invoice', 'error');
      return;
    }

    setIsMatching(true);
    setMatchResults([]);

    try {
      const response = await matchInvoices(
        Number(id),
        Array.from(selectedInvoiceIds),
        matchingOptions
      );

      setMatchResults(response.transactions || []);
      
      if (response.transactions.length === 0) {
        showToast(t.bankStatements.reconcile.noMatches || 'No matching transactions found', 'info');
      } else {
        showToast(
          t.bankStatements.reconcile.matchesFound || `Found matches for ${response.transactions.length} transaction(s)`,
          'success'
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to match invoices';
      showToast(errorMessage, 'error');
    } finally {
      setIsMatching(false);
    }
  };

  const handleCreateLinks = async () => {
    if (!id || typeof id !== 'string') return;

    // Collect all matches that should be linked
    const linksToCreate: Array<{
      bank_transaction_id: number;
      invoice_id: number;
      match_type: 'auto' | 'manual';
      match_score?: number;
    }> = [];

    matchResults.forEach(transaction => {
      transaction.matches.forEach(match => {
        // Only create links for high/medium confidence matches
        if (match.confidence === 'high' || match.confidence === 'medium') {
          linksToCreate.push({
            bank_transaction_id: transaction.transaction_id,
            invoice_id: match.invoice_id,
            match_type: match.confidence === 'high' ? 'auto' : 'manual',
            match_score: match.match_score,
          });
        }
      });
    });

    if (linksToCreate.length === 0) {
      showToast(t.bankStatements.reconcile.noLinksToCreate || 'No links to create. Select high or medium confidence matches.', 'info');
      return;
    }

    setIsLinking(true);
    try {
      await createLinksBulk(linksToCreate);
      showToast(
        t.bankStatements.reconcile.linksCreated || `Created ${linksToCreate.length} link(s) successfully`,
        'success'
      );
      await loadLinks();
      setMatchResults([]);
      setSelectedInvoiceIds(new Set());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create links';
      showToast(errorMessage, 'error');
    } finally {
      setIsLinking(false);
    }
  };

  const handleCreateSingleLink = async (transactionId: number, invoiceId: number, matchScore?: number) => {
    if (!id || typeof id !== 'string') return;

    try {
      await createLink(transactionId, invoiceId, {
        match_type: 'manual',
        match_score: matchScore,
      });
      showToast(t.bankStatements.reconcile.linkCreated || 'Link created successfully', 'success');
      await loadLinks();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create link';
      showToast(errorMessage, 'error');
    }
  };

  const handleDeleteLink = async (linkId: number) => {
    try {
      await deleteLink(linkId);
      showToast(t.bankStatements.reconcile.linkDeleted || 'Link deleted successfully', 'success');
      await loadLinks();
      await loadInvoices(); // Reload to show previously linked invoices
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete link';
      showToast(errorMessage, 'error');
    }
  };

  const toggleInvoiceSelection = (invoiceId: number) => {
    const newSelection = new Set(selectedInvoiceIds);
    if (newSelection.has(invoiceId)) {
      newSelection.delete(invoiceId);
    } else {
      newSelection.add(invoiceId);
    }
    setSelectedInvoiceIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedInvoiceIds.size === invoices.length) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(invoices.map(inv => inv.id)));
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '-';
    return `MYR ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'var(--success)';
      case 'medium':
        return 'var(--warning)';
      case 'low':
        return 'var(--error)';
      default:
        return 'var(--muted-foreground)';
    }
  };

  const isInvoiceLinked = (invoiceId: number) => {
    return links.some(link => link.invoice_id === invoiceId);
  };

  if (isLoading) {
    return (
      <AppLayout pageName={t.bankStatements.reconcile.title || 'Bank Reconciliation'}>
        <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
          {t.common.loading || 'Loading...'}
        </div>
      </AppLayout>
    );
  }

  if (error || !statement) {
    return (
      <AppLayout pageName={t.bankStatements.reconcile.title || 'Bank Reconciliation'}>
        <div className="p-8 text-center">
          <p style={{ color: 'var(--error)' }}>{error || 'Bank statement not found'}</p>
          <button
            onClick={() => router.push(`/bank-statements/${id}`)}
            className="mt-4 px-4 py-2 rounded-lg border"
            style={{
              background: 'var(--background)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          >
            {t.bankStatements.reconcile.back || 'Back'}
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageName={t.bankStatements.reconcile.title || 'Bank Reconciliation'}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/bank-statements/${id}`)}
            className="p-2 rounded hover:bg-[var(--muted)]"
            style={{ color: 'var(--foreground)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
              {t.bankStatements.reconcile.title || 'Bank Reconciliation'}
            </h1>
            <p style={{ color: 'var(--muted-foreground)' }}>
              {statement.bank_name || 'Bank Statement'} - {statement.account_number || 'N/A'}
            </p>
          </div>
        </div>

        {/* Matching Options */}
        <div className="rounded-lg p-6 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            {t.bankStatements.reconcile.matchingOptions || 'Matching Options'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.reconcile.dateTolerance || 'Date Tolerance (days)'}
              </label>
              <input
                type="number"
                value={matchingOptions.date_tolerance_days}
                onChange={(e) => setMatchingOptions({ ...matchingOptions, date_tolerance_days: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.reconcile.amountTolerance || 'Amount Tolerance (%)'}
              </label>
              <input
                type="number"
                step="0.1"
                value={matchingOptions.amount_tolerance_percentage}
                onChange={(e) => setMatchingOptions({ ...matchingOptions, amount_tolerance_percentage: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.reconcile.currencyTolerance || 'Currency Tolerance (%)'}
              </label>
              <input
                type="number"
                step="0.1"
                value={matchingOptions.currency_tolerance_percentage}
                onChange={(e) => setMatchingOptions({ ...matchingOptions, currency_tolerance_percentage: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.reconcile.minMatchScore || 'Min Match Score'}
              </label>
              <input
                type="number"
                step="0.1"
                value={matchingOptions.min_match_score}
                onChange={(e) => setMatchingOptions({ ...matchingOptions, min_match_score: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={matchingOptions.exclude_linked}
                onChange={(e) => setMatchingOptions({ ...matchingOptions, exclude_linked: e.target.checked })}
                className="rounded"
              />
              <span style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.reconcile.excludeLinked || 'Exclude already linked invoices'}
              </span>
            </label>
          </div>
        </div>

        {/* Invoice Selection */}
        <div className="rounded-lg border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.reconcile.selectInvoices || 'Select Invoices to Match'}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="px-4 py-2 rounded-lg border text-sm"
                  style={{
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                >
                  {selectedInvoiceIds.size === invoices.length ? t.bankStatements.reconcile.deselectAll || 'Deselect All' : t.bankStatements.reconcile.selectAll || 'Select All'}
                </button>
                <button
                  onClick={handleMatch}
                  disabled={selectedInvoiceIds.size === 0 || isMatching}
                  className="px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  {isMatching ? (t.common.loading || 'Loading...') : (t.bankStatements.reconcile.match || 'Match Invoices')}
                </button>
              </div>
            </div>
          </div>

          {/* Invoice Filters */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <input
                  type="text"
                  placeholder={t.bankStatements.reconcile.searchInvoices || 'Search invoices...'}
                  value={invoiceFilters.search}
                  onChange={(e) => setInvoiceFilters({ ...invoiceFilters, search: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Invoice List */}
          <div className="max-h-96 overflow-y-auto">
            {invoices.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
                {t.bankStatements.reconcile.noInvoices || 'No invoices found'}
              </div>
            ) : (
              <table className="w-full">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--card)', zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.size === invoices.length && invoices.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.invoiceNo || 'Invoice No'}
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.vendor || 'Vendor'}
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.date || 'Date'}
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.total || 'Total'}
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.status || 'Status'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const isSelected = selectedInvoiceIds.has(invoice.id);
                    const isLinked = isInvoiceLinked(invoice.id);
                    return (
                      <tr
                        key={invoice.id}
                        style={{ borderBottom: '1px solid var(--border)' }}
                        className={isLinked ? 'bg-green-500/10' : ''}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleInvoiceSelection(invoice.id)}
                            disabled={isLinked}
                            className="rounded"
                          />
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {invoice.invoice_no || '-'}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {invoice.vendor_name || '-'}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatDate(invoice.invoice_date)}
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          {formatCurrency(invoice.total)}
                        </td>
                        <td className="py-3 px-4">
                          {isLinked ? (
                            <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--success)', color: 'white' }}>
                              {t.bankStatements.reconcile.linked || 'Linked'}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded capitalize" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                              {invoice.status || 'draft'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Match Results */}
        {matchResults.length > 0 && (
          <div className="rounded-lg border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  {t.bankStatements.reconcile.matchResults || 'Match Results'}
                </h3>
                <button
                  onClick={handleCreateLinks}
                  disabled={isLinking}
                  className="px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  {isLinking ? (t.common.loading || 'Loading...') : (t.bankStatements.reconcile.createLinks || 'Create Links (High/Medium)')}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.transaction || 'Transaction'}
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.invoice || 'Invoice'}
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.matchScore || 'Match Score'}
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.confidence || 'Confidence'}
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.actions || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matchResults.map((transaction) =>
                    transaction.matches.map((match, idx) => (
                      <tr key={`${transaction.transaction_id}-${match.invoice_id}-${idx}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          <div className="text-sm font-medium">{formatDate(transaction.transaction_date)}</div>
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {transaction.description}
                          </div>
                          <div className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                            {formatCurrency(transaction.amount)}
                          </div>
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          <div className="text-sm font-medium">{match.invoice_no}</div>
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {match.vendor_name}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {formatDate(match.invoice_date)}
                          </div>
                          <div className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                            {formatCurrency(match.invoice_total)}
                          </div>
                        </td>
                        <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                          <div className="text-sm font-semibold">{match.match_score.toFixed(1)}</div>
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            Amount: {match.score_breakdown.amount_score.toFixed(1)}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            Date: {match.score_breakdown.date_score.toFixed(1)}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            Text: {match.score_breakdown.text_score.toFixed(1)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className="px-2 py-1 rounded text-xs font-medium capitalize"
                            style={{
                              background: getConfidenceColor(match.confidence),
                              color: 'white',
                            }}
                          >
                            {match.confidence}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleCreateSingleLink(transaction.transaction_id, match.invoice_id, match.match_score)}
                            className="px-3 py-1 rounded text-sm border"
                            style={{
                              background: 'var(--background)',
                              borderColor: 'var(--border)',
                              color: 'var(--foreground)',
                            }}
                          >
                            {t.bankStatements.reconcile.createLink || 'Create Link'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Existing Links */}
        {links.length > 0 && (
          <div className="rounded-lg border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {t.bankStatements.reconcile.existingLinks || 'Existing Links'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.transaction || 'Transaction'}
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.invoice || 'Invoice'}
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.matchType || 'Match Type'}
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-foreground)' }}>
                      {t.bankStatements.reconcile.actions || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                        {link.transaction?.description || `Transaction #${link.bank_transaction_id}`}
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--foreground)' }}>
                        {link.invoice?.invoice_no || `Invoice #${link.invoice_id}`}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2 py-1 rounded capitalize" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                          {link.match_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleDeleteLink(link.id)}
                          className="px-3 py-1 rounded text-sm border"
                          style={{
                            background: 'var(--error)',
                            color: 'white',
                          }}
                        >
                          {t.common.delete || 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BankReconciliation;

