'use client';

import { useState } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, Loader2, Link2 } from 'lucide-react';
import { 
  MatchInvoicesAcrossStatementsResponse, 
  StatementMatchSummary, 
  StatementTransactionMatch, 
  MatchedInvoiceDetail,
  createLinksBulk 
} from '@/services';
import { useToast } from '@/lib/toast';

interface PaymentValidationResultProps {
  result: MatchInvoicesAcrossStatementsResponse;
  invoiceNo?: string;
  onClose: () => void;
  onLinksCreated?: () => void; // Callback when links are created
}

export function PaymentValidationResult({ result, invoiceNo, onClose, onLinksCreated }: PaymentValidationResultProps) {
  const { showToast } = useToast();
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  
  // Ensure statement_matches array exists
  const statementMatches = result?.statement_matches || [];
  
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount?: number | string) => {
    if (amount === undefined || amount === null) return '-';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '-';
    return `MYR ${numAmount.toLocaleString('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
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

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4" />;
      case 'low':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // Get all available matches for selection
  const getAllMatches = (): Array<{ transaction: StatementTransactionMatch; invoice: MatchedInvoiceDetail; key: string }> => {
    const matches: Array<{ transaction: StatementTransactionMatch; invoice: MatchedInvoiceDetail; key: string }> = [];
    statementMatches.forEach((statement: StatementMatchSummary) => {
      statement.matches
        .filter((t: StatementTransactionMatch) => t.matched && t.matched_invoices.length > 0)
        .forEach((transaction: StatementTransactionMatch) => {
          transaction.matched_invoices.forEach((invoice: MatchedInvoiceDetail) => {
            matches.push({
              transaction,
              invoice,
              key: `${transaction.transaction_id}-${invoice.invoice_id}`,
            });
          });
        });
    });
    return matches;
  };

  const allMatches = getAllMatches();

  const toggleMatchSelection = (key: string) => {
    const newSelection = new Set(selectedMatches);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    setSelectedMatches(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedMatches.size === allMatches.length) {
      setSelectedMatches(new Set());
    } else {
      setSelectedMatches(new Set(allMatches.map(m => m.key)));
    }
  };

  const handleSaveLinks = async () => {
    if (selectedMatches.size === 0) {
      showToast('Please select at least one match to link', { type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const linksToCreate = allMatches
        .filter(m => selectedMatches.has(m.key))
        .map(m => ({
          bank_transaction_id: m.transaction.transaction_id,
          invoice_id: m.invoice.invoice_id,
          match_type: (m.invoice.match_confidence === 'high' ? 'auto' : 'manual') as 'auto' | 'manual',
          match_score: parseFloat(m.invoice.match_score),
        }));

      const response = await createLinksBulk(linksToCreate);
      
      showToast(
        `Successfully created ${response.data?.created_count || linksToCreate.length} link(s)`,
        { type: 'success' }
      );
      
      // Clear selection
      setSelectedMatches(new Set());
      
      // Call callback to refresh data if provided
      if (onLinksCreated) {
        onLinksCreated();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create links';
      showToast(errorMessage, { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="rounded-lg border p-6 space-y-4"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Payment Validation Results
          </h3>
          {invoiceNo && (
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Invoice: {invoiceNo}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded hover:bg-[var(--muted)] transition-colors"
          style={{ color: 'var(--foreground)' }}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Summary */}
      <div
        className="rounded-lg p-4 border"
        style={{
          background: 'var(--background)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Statements Searched
            </div>
            <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {result?.statements_searched || 0}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
              With Matches
            </div>
            <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {statementMatches.length}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Matched
            </div>
            <div className="text-lg font-semibold" style={{ color: 'var(--success)' }}>
              {result?.matched_invoices || 0}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Unmatched
            </div>
            <div className="text-lg font-semibold" style={{ color: 'var(--error)' }}>
              {result?.unmatched_invoices || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      {allMatches.length > 0 && (
        <div className="flex items-center justify-between p-4 rounded-lg border" style={{ background: 'var(--background)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedMatches.size === allMatches.length && allMatches.length > 0}
                onChange={toggleSelectAll}
                className="rounded"
              />
              <span style={{ color: 'var(--foreground)' }}>
                Select All ({selectedMatches.size} of {allMatches.length} selected)
              </span>
            </label>
          </div>
          <button
            onClick={handleSaveLinks}
            disabled={selectedMatches.size === 0 || isSaving}
            className="px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{
              background: selectedMatches.size > 0 ? 'var(--primary)' : 'var(--muted)',
              color: selectedMatches.size > 0 ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            }}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" />
                Save Selected Links ({selectedMatches.size})
              </>
            )}
          </button>
        </div>
      )}

      {/* Results by Statement */}
      {statementMatches.length === 0 ? (
        <div
          className="rounded-lg p-6 text-center border"
          style={{
            background: 'var(--background)',
            borderColor: 'var(--border)',
          }}
        >
          <XCircle className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            No matching transactions found
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            This invoice does not appear to have been paid based on the searched bank statements.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Matches by Statement ({statementMatches.length} statement(s))
          </h4>
          {statementMatches.map((statementResult: StatementMatchSummary) => {
            // Filter to only show transactions with matches
            const matchedTransactions = statementResult.matches.filter(
              (t: StatementTransactionMatch) => t.matched && t.matched_invoices.length > 0
            );

            if (matchedTransactions.length === 0) return null;

            return (
              <div
                key={statementResult.statement_id}
                className="rounded-lg p-4 border"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="mb-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    Account: {statementResult.account_number || 'N/A'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {formatDate(statementResult.statement_date_from)} to {formatDate(statementResult.statement_date_to)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {statementResult.matched_transactions} matched transaction(s) out of {statementResult.total_transactions} total
                  </div>
                </div>
                {matchedTransactions.map((transaction: StatementTransactionMatch) =>
                  transaction.matched_invoices.map((invoice: MatchedInvoiceDetail, idx: number) => {
                    const matchKey = `${transaction.transaction_id}-${invoice.invoice_id}`;
                    const isSelected = selectedMatches.has(matchKey);
                    
                    return (
                      <div
                        key={matchKey}
                        className={`mb-3 last:mb-0 p-3 rounded border ${isSelected ? 'ring-2' : ''}`}
                        style={{
                          background: 'var(--card)',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                          ringColor: 'var(--primary)',
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {/* Selection Checkbox */}
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleMatchSelection(matchKey)}
                              className="rounded"
                              style={{ accentColor: 'var(--primary)' }}
                            />
                          </div>
                          
                          <div className="flex-1 flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              {/* Transaction Info */}
                              <div>
                                <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                                  Bank Transaction
                                </div>
                                <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                                  {formatDate(transaction.transaction_date)}
                                </div>
                                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  {transaction.description}
                                </div>
                                <div className="text-sm font-semibold mt-1" style={{ color: 'var(--foreground)' }}>
                                  {formatCurrency(transaction.transaction_amount)}
                                </div>
                              </div>

                              {/* Invoice Info */}
                              <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                                <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                                  Matched Invoice
                                </div>
                                <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                                  {invoice.invoice_no}
                                </div>
                                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  {invoice.vendor_name}
                                </div>
                                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  {formatDate(invoice.invoice_date)}
                                </div>
                                <div className="text-xs font-semibold mt-1" style={{ color: 'var(--foreground)' }}>
                                  {invoice.invoice_currency} {parseFloat(invoice.invoice_total).toLocaleString('en-MY', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                  {invoice.invoice_currency !== 'MYR' && (
                                    <span className="ml-1" style={{ color: 'var(--muted-foreground)' }}>
                                      (≈ MYR {parseFloat(invoice.converted_total).toLocaleString('en-MY', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })})
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Match Score Breakdown */}
                              <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                                <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--muted-foreground)' }}>
                                  Score Breakdown
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <span style={{ color: 'var(--muted-foreground)' }}>Amount: </span>
                                    <span style={{ color: 'var(--foreground)' }}>
                                      {parseFloat(invoice.score_breakdown.amount_score).toFixed(1)}
                                    </span>
                                  </div>
                                  <div>
                                    <span style={{ color: 'var(--muted-foreground)' }}>Date: </span>
                                    <span style={{ color: 'var(--foreground)' }}>
                                      {parseFloat(invoice.score_breakdown.date_score).toFixed(1)}
                                    </span>
                                  </div>
                                  <div>
                                    <span style={{ color: 'var(--muted-foreground)' }}>Text: </span>
                                    <span style={{ color: 'var(--foreground)' }}>
                                      {parseFloat(invoice.score_breakdown.text_score).toFixed(1)}
                                    </span>
                                  </div>
                                  <div>
                                    <span style={{ color: 'var(--muted-foreground)' }}>Reference: </span>
                                    <span style={{ color: 'var(--foreground)' }}>
                                      {parseFloat(invoice.score_breakdown.reference_bonus).toFixed(1)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Confidence Badge */}
                            <div className="flex flex-col items-end gap-2">
                              <div
                                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium capitalize"
                                style={{
                                  background: getConfidenceColor(invoice.match_confidence),
                                  color: 'white',
                                }}
                              >
                                {getConfidenceIcon(invoice.match_confidence)}
                                {invoice.match_confidence}
                              </div>
                              <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                                {parseFloat(invoice.match_score).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

