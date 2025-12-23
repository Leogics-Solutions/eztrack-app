'use client';

import { useState, useEffect } from 'react';
import { Search, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  listBankStatements,
  matchInvoices,
  matchInvoicesAcrossStatements,
  type BankStatement,
  type TransactionMatchResult,
  type TransactionInvoiceMatch,
  type MatchInvoicesAcrossStatementsResponse,
  type StatementMatchSummary,
} from '@/services';
import { useToast } from '@/lib/toast';

interface InvoiceValidationProps {
  invoiceId: number;
  invoiceNo?: string;
  invoiceTotal?: number;
  invoiceDate?: string;
  vendorName?: string;
  onClose?: () => void;
}

export function InvoiceValidation({
  invoiceId,
  invoiceNo,
  invoiceTotal,
  invoiceDate,
  vendorName,
  onClose,
}: InvoiceValidationProps) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<number | null>(null);
  const [matchResults, setMatchResults] = useState<TransactionMatchResult[]>([]);
  const [crossStatementResults, setCrossStatementResults] = useState<MatchInvoicesAcrossStatementsResponse | null>(null);
  const [hasValidated, setHasValidated] = useState(false);
  const [searchAllStatements, setSearchAllStatements] = useState(false);

  // Matching options
  const [matchingOptions, setMatchingOptions] = useState({
    date_tolerance_days: 7,
    amount_tolerance_percentage: 2.0,
    currency_tolerance_percentage: 5.0,
    min_match_score: 60.0,
    exclude_linked: true,
  });

  useEffect(() => {
    loadBankStatements();
  }, []);

  const loadBankStatements = async () => {
    setIsLoading(true);
    try {
      const response = await listBankStatements({ page: 1, page_size: 100 });
      setStatements(response.data || []);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to load bank statements',
        { type: 'error' }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!searchAllStatements && !selectedStatementId) {
      showToast('Please select a bank statement or enable "Search All Statements"', { type: 'error' });
      return;
    }

    setIsValidating(true);
    setMatchResults([]);
    setCrossStatementResults(null);
    setHasValidated(false);

    try {
      if (searchAllStatements) {
        // Use the new cross-statement endpoint
        const response = await matchInvoicesAcrossStatements(
          [invoiceId],
          matchingOptions
        );

        setCrossStatementResults(response);
        setHasValidated(true);

        if (response.matched_invoices === 0) {
          showToast(
            `No matching transactions found across ${response.statements_searched} statement(s)`,
            { type: 'info' }
          );
        } else {
          showToast(
            `Found matches in ${response.statement_matches.length} statement(s) (${response.matched_invoices} matched, ${response.unmatched_invoices} unmatched)`,
            { type: 'success' }
          );
        }
      } else {
        // Use the original single-statement endpoint
        const response = await matchInvoices(
          selectedStatementId!,
          [invoiceId],
          matchingOptions
        );

        setMatchResults(response.transactions || []);
        setHasValidated(true);

        if (response.transactions.length === 0) {
          showToast('No matching transactions found for this invoice', { type: 'info' });
        } else {
          const totalMatches = response.transactions.reduce(
            (sum, t) => sum + t.matches.length,
            0
          );
          showToast(
            `Found ${totalMatches} match(es) across ${response.transactions.length} transaction(s)`,
            { type: 'success' }
          );
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to validate invoice';
      showToast(errorMessage, { type: 'error' });
    } finally {
      setIsValidating(false);
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
    return `MYR ${amount.toLocaleString('en-MY', {
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
            Validate Invoice Payment
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Check if this invoice matches any bank transactions
          </p>
        </div>
        <button
          onClick={() => {
            setMatchResults([]);
            setHasValidated(false);
            setSelectedStatementId(null);
            if (onClose) {
              onClose();
            }
          }}
          className="px-3 py-1 rounded text-sm border"
          style={{
            background: 'var(--background)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        >
          Close
        </button>
      </div>

      {/* Invoice Info Summary */}
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
              Invoice No
            </div>
            <div style={{ color: 'var(--foreground)' }}>{invoiceNo || '-'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Vendor
            </div>
            <div style={{ color: 'var(--foreground)' }}>{vendorName || '-'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Date
            </div>
            <div style={{ color: 'var(--foreground)' }}>{formatDate(invoiceDate)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Total
            </div>
            <div style={{ color: 'var(--foreground)' }}>{formatCurrency(invoiceTotal)}</div>
          </div>
        </div>
      </div>

      {/* Search Mode Selection */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={searchAllStatements}
            onChange={(e) => {
              setSearchAllStatements(e.target.checked);
              if (e.target.checked) {
                setSelectedStatementId(null);
              }
            }}
            className="rounded"
          />
          <span style={{ color: 'var(--foreground)' }}>
            Search All Bank Statements
          </span>
        </label>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {searchAllStatements
            ? 'Will automatically search all relevant bank statements based on invoice date'
            : 'Select a specific bank statement to search'}
        </p>
      </div>

      {/* Bank Statement Selection (only if not searching all) */}
      {!searchAllStatements && (
        <div className="space-y-2">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Select Bank Statement
          </label>
          {isLoading ? (
            <div className="flex items-center gap-2 p-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading bank statements...
            </div>
          ) : (
            <select
              value={selectedStatementId || ''}
              onChange={(e) => setSelectedStatementId(Number(e.target.value) || null)}
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              <option value="">-- Select a bank statement --</option>
              {statements.map((stmt) => (
                <option key={stmt.id} value={stmt.id}>
                  {stmt.bank_name || 'Bank'} - {stmt.account_number || 'N/A'} (
                  {formatDate(stmt.statement_date_from)} to {formatDate(stmt.statement_date_to)})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Matching Options */}
      <div
        className="rounded-lg p-4 border"
        style={{
          background: 'var(--background)',
          borderColor: 'var(--border)',
        }}
      >
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
          Matching Options
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Date Tolerance (days)
            </label>
            <input
              type="number"
              value={matchingOptions.date_tolerance_days}
              onChange={(e) =>
                setMatchingOptions({
                  ...matchingOptions,
                  date_tolerance_days: Number(e.target.value),
                })
              }
              className="w-full px-2 py-1 rounded border text-sm"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Amount Tolerance (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={matchingOptions.amount_tolerance_percentage}
              onChange={(e) =>
                setMatchingOptions({
                  ...matchingOptions,
                  amount_tolerance_percentage: Number(e.target.value),
                })
              }
              className="w-full px-2 py-1 rounded border text-sm"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Currency Tolerance (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={matchingOptions.currency_tolerance_percentage}
              onChange={(e) =>
                setMatchingOptions({
                  ...matchingOptions,
                  currency_tolerance_percentage: Number(e.target.value),
                })
              }
              className="w-full px-2 py-1 rounded border text-sm"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Min Match Score
            </label>
            <input
              type="number"
              step="0.1"
              value={matchingOptions.min_match_score}
              onChange={(e) =>
                setMatchingOptions({
                  ...matchingOptions,
                  min_match_score: Number(e.target.value),
                })
              }
              className="w-full px-2 py-1 rounded border text-sm"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={matchingOptions.exclude_linked}
              onChange={(e) =>
                setMatchingOptions({
                  ...matchingOptions,
                  exclude_linked: e.target.checked,
                })
              }
              className="rounded"
            />
            <span style={{ color: 'var(--foreground)' }}>
              Exclude already linked invoices
            </span>
          </label>
        </div>
      </div>

      {/* Validate Button */}
      <button
        onClick={handleValidate}
        disabled={(!searchAllStatements && !selectedStatementId) || isValidating}
        className="w-full px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
        }}
      >
        {isValidating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Validating...
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Validate Invoice
          </>
        )}
      </button>

      {/* Match Results */}
      {hasValidated && (
        <div className="space-y-4">
          {/* Cross-statement results */}
          {crossStatementResults && (
            <div className="space-y-4">
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
                      {crossStatementResults.statements_searched}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      With Matches
                    </div>
                    <div className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                      {crossStatementResults.statement_matches.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Matched
                    </div>
                    <div className="text-lg font-semibold" style={{ color: 'var(--success)' }}>
                      {crossStatementResults.matched_invoices}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Unmatched
                    </div>
                    <div className="text-lg font-semibold" style={{ color: 'var(--error)' }}>
                      {crossStatementResults.unmatched_invoices}
                    </div>
                  </div>
                </div>
              </div>

              {/* Results by Statement */}
              {crossStatementResults.results.length === 0 ? (
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
                    Matches by Statement ({crossStatementResults.results.length} statement(s))
                  </h4>
                  {crossStatementResults.results.map((statementResult) => (
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
                          {statementResult.bank_name || 'Bank'} - {statementResult.account_number || 'N/A'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {formatDate(statementResult.statement_date_from)} to {formatDate(statementResult.statement_date_to)}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                          {statementResult.transactions.length} matching transaction(s)
                        </div>
                      </div>
                      {statementResult.transactions.map((transaction) =>
                        transaction.matches.map((match, idx) => (
                          <div
                            key={`${transaction.transaction_id}-${match.invoice_id}-${idx}`}
                            className="mb-3 last:mb-0 p-3 rounded border"
                            style={{
                              background: 'var(--card)',
                              borderColor: 'var(--border)',
                            }}
                          >
                            <div className="flex items-start justify-between gap-4">
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
                                    {formatCurrency(transaction.amount)}
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
                                        {match.score_breakdown.amount_score.toFixed(1)}
                                      </span>
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--muted-foreground)' }}>Date: </span>
                                      <span style={{ color: 'var(--foreground)' }}>
                                        {match.score_breakdown.date_score.toFixed(1)}
                                      </span>
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--muted-foreground)' }}>Text: </span>
                                      <span style={{ color: 'var(--foreground)' }}>
                                        {match.score_breakdown.text_score.toFixed(1)}
                                      </span>
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--muted-foreground)' }}>Reference: </span>
                                      <span style={{ color: 'var(--foreground)' }}>
                                        {match.score_breakdown.reference_bonus.toFixed(1)}
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
                                    background: getConfidenceColor(match.confidence),
                                    color: 'white',
                                  }}
                                >
                                  {getConfidenceIcon(match.confidence)}
                                  {match.confidence}
                                </div>
                                <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                                  {match.match_score.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Single statement results */}
          {!crossStatementResults && matchResults.length === 0 ? (
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
                This invoice does not appear to have been paid based on the selected bank statement.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Match Results ({matchResults.reduce((sum, t) => sum + t.matches.length, 0)} match(es))
              </h4>
              {matchResults.map((transaction) =>
                transaction.matches.map((match, idx) => (
                  <div
                    key={`${transaction.transaction_id}-${match.invoice_id}-${idx}`}
                    className="rounded-lg p-4 border"
                    style={{
                      background: 'var(--background)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
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
                            {formatCurrency(transaction.amount)}
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
                                {match.score_breakdown.amount_score.toFixed(1)}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--muted-foreground)' }}>Date: </span>
                              <span style={{ color: 'var(--foreground)' }}>
                                {match.score_breakdown.date_score.toFixed(1)}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--muted-foreground)' }}>Text: </span>
                              <span style={{ color: 'var(--foreground)' }}>
                                {match.score_breakdown.text_score.toFixed(1)}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--muted-foreground)' }}>Reference: </span>
                              <span style={{ color: 'var(--foreground)' }}>
                                {match.score_breakdown.reference_bonus.toFixed(1)}
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
                            background: getConfidenceColor(match.confidence),
                            color: 'white',
                          }}
                        >
                          {getConfidenceIcon(match.confidence)}
                          {match.confidence}
                        </div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {match.match_score.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

