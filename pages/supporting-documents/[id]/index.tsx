'use client';

import { AppLayout } from "@/components/layout";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Link2, Search, Trash2, X } from "lucide-react";
import {
  createDocumentLink,
  deleteDocumentLink,
  getDocument,
  listInvoices,
  updateDocument,
  type Document,
  type Invoice as InvoiceRecord,
  type StructuredFields,
  type UpdateDocumentRequest,
} from "@/services";
import { useToast } from "@/lib/toast";

const DocumentDetail = () => {
  const router = useRouter();
  const { id } = router.query;

  // State
  const [document, setDocument] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceCandidates, setInvoiceCandidates] = useState<InvoiceRecord[]>([]);
  const [isSearchingInvoices, setIsSearchingInvoices] = useState(false);
  const [linkActionInvoiceId, setLinkActionInvoiceId] = useState<number | null>(null);
  const [replacementLinkId, setReplacementLinkId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    reference_number: '',
    document_date: '',
    amount_total: null as number | null,
    weight_kg: null as number | null,
    quantity: null as number | null,
    description: '',
    exchange_rate: null as number | null,
  });
  const { showToast } = useToast();

  // Load document data
  useEffect(() => {
    if (id) {
      loadDocumentData();
    }
  }, [id]);

  const loadDocumentData = async () => {
    if (!id || typeof id !== 'string') return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await getDocument(Number(id));
      if (!response.success) {
        throw new Error(response.message || 'Failed to load document');
      }
      const doc = response.data;
      setDocument(doc);
      
      // Extract exchange_rate from structured_fields if available
      const structuredFields = doc.structured_fields || doc.extracted_metadata?.structured_fields;
      const rate = structuredFields?.exchange_rate;
      
      // Initialize form data
      setFormData({
        reference_number: doc.reference_number || '',
        document_date: doc.document_date ? doc.document_date.split('T')[0] : '',
        amount_total: doc.amount_total ?? null,
        weight_kg: doc.weight_kg ?? null,
        quantity: doc.quantity ?? null,
        description: doc.description || '',
        exchange_rate: rate || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDocument = async () => {
    if (!document) return;

    try {
      const payload: UpdateDocumentRequest = {};
      
      // Update basic fields
      if (formData.reference_number !== document.reference_number) {
        payload.reference_number = formData.reference_number;
      }
      if (formData.document_date) {
        // Convert date to ISO string format
        const dateValue = `${formData.document_date}T00:00:00`;
        // Compare dates by extracting just the date part
        const currentDate = document.document_date ? document.document_date.split('T')[0] : '';
        if (dateValue && formData.document_date !== currentDate) {
          payload.document_date = dateValue;
        }
      }
      if (formData.amount_total !== document.amount_total) {
        payload.amount_total = formData.amount_total ?? undefined;
      }
      if (formData.weight_kg !== document.weight_kg) {
        payload.weight_kg = formData.weight_kg ?? undefined;
      }
      if (formData.quantity !== document.quantity) {
        payload.quantity = formData.quantity ?? undefined;
      }
      if (formData.description !== (document.description || '')) {
        payload.description = formData.description || undefined;
      }
      
      // Check if this is a custom form (has structured_fields with exchange_rate)
      const structuredFields = document.structured_fields || document.extracted_metadata?.structured_fields;
      const isCustomForm = structuredFields && 'exchange_rate' in structuredFields;

      if (isCustomForm && formData.exchange_rate !== null) {
        // For custom forms, update via extracted_metadata.structured_fields
        payload.extracted_metadata = {
          structured_fields: {
            ...structuredFields,
            exchange_rate: formData.exchange_rate,
          },
        };
      } else if (formData.exchange_rate !== null && formData.exchange_rate !== (structuredFields?.exchange_rate || null)) {
        // For other documents, update at top level
        payload.exchange_rate = formData.exchange_rate;
      }

      await updateDocument(document.id, payload);
      await loadDocumentData();
      setIsEditMode(false);
      showToast('Document updated successfully', { type: 'success' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update document', { type: 'error' });
    }
  };

  const searchInvoices = async (searchText = invoiceSearch) => {
    setIsSearchingInvoices(true);
    try {
      const response = await listInvoices({
        page: 1,
        page_size: 20,
        search: searchText.trim() || undefined,
        direction:
          document?.direction === 'AP' || document?.direction === 'AR'
            ? [document.direction]
            : undefined,
      });
      const rawData = response.data;
      const candidates = Array.isArray(rawData)
        ? rawData
        : rawData?.invoices || [];
      setInvoiceCandidates(candidates);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to search invoices', { type: 'error' });
      setInvoiceCandidates([]);
    } finally {
      setIsSearchingInvoices(false);
    }
  };

  const openLinkEditor = (linkIdToReplace?: number) => {
    setReplacementLinkId(linkIdToReplace ?? null);
    setIsLinkEditorOpen(true);
    void searchInvoices('');
  };

  const closeLinkEditor = () => {
    setIsLinkEditorOpen(false);
    setReplacementLinkId(null);
    setInvoiceSearch('');
    setInvoiceCandidates([]);
  };

  const handleUnlink = async (linkId: number, invoiceLabel: string) => {
    if (!window.confirm(`Unlink this document from ${invoiceLabel}? The document and invoice will not be deleted.`)) {
      return;
    }

    setLinkActionInvoiceId(linkId);
    try {
      await deleteDocumentLink(linkId);
      await loadDocumentData();
      showToast(`Unlinked from ${invoiceLabel}`, { type: 'success' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to unlink document', { type: 'error' });
    } finally {
      setLinkActionInvoiceId(null);
    }
  };

  const handleLinkToInvoice = async (invoice: InvoiceRecord) => {
    if (!document || !invoice.document_id) {
      showToast('This invoice is not ready for supporting-document links yet', { type: 'error' });
      return;
    }

    setLinkActionInvoiceId(invoice.id);
    try {
      await createDocumentLink({
        parent_document_id: invoice.document_id,
        child_document_id: document.id,
        link_type: 'SUPPORTING',
        direction:
          document.direction === 'AP' || document.direction === 'AR'
            ? document.direction
            : undefined,
        notes: replacementLinkId
          ? 'Manually relinked from supporting document detail'
          : 'Manually linked from supporting document detail',
      });

      if (replacementLinkId) {
        await deleteDocumentLink(replacementLinkId);
      }

      await loadDocumentData();
      closeLinkEditor();
      showToast(`Linked to ${invoice.invoice_no || `Invoice #${invoice.id}`}`, { type: 'success' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to link document', { type: 'error' });
    } finally {
      setLinkActionInvoiceId(null);
    }
  };

  // Helper to format structured fields for display
  const renderStructuredFields = (fields: StructuredFields | null | undefined) => {
    if (!fields) return null;

    return (
      <div className="space-y-4">
        {Object.entries(fields).map(([key, value]) => {
          // Skip null/undefined values
          if (value === null || value === undefined) return null;

          // Handle arrays
          if (Array.isArray(value)) {
            return (
              <div key={key} className="border-b border-[var(--border)] pb-3">
                <div className="text-sm font-semibold mb-2 capitalize" style={{ color: 'var(--foreground)' }}>
                  {key.replace(/_/g, ' ')}:
                </div>
                <div className="ml-4 space-y-2">
                  {value.map((item, idx) => (
                    <div key={idx} className="bg-[var(--muted)] p-3 rounded-md">
                      {typeof item === 'object' ? (
                        <div className="space-y-2">
                          {Object.entries(item).map(([k, v]) => (
                            <div key={k} className="text-sm">
                              <span className="font-medium capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
                              <span>{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm">{String(item)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          // Handle objects
          if (typeof value === 'object') {
            return (
              <div key={key} className="border-b border-[var(--border)] pb-3">
                <div className="text-sm font-semibold mb-2 capitalize" style={{ color: 'var(--foreground)' }}>
                  {key.replace(/_/g, ' ')}:
                </div>
                <div className="ml-4 space-y-1">
                  {Object.entries(value).map(([k, v]) => (
                    <div key={k} className="text-sm">
                      <span className="font-medium capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
                      <span>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          // Handle primitive values
          return (
            <div key={key} className="border-b border-[var(--border)] pb-3">
              <div className="text-sm">
                <span className="font-semibold capitalize" style={{ color: 'var(--foreground)' }}>
                  {key.replace(/_/g, ' ')}:
                </span>{' '}
                <span>{String(value)}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <AppLayout pageName="Document Detail">
        <div className="text-center py-12">
          <div className="text-lg" style={{ color: 'var(--muted-foreground)' }}>Loading document...</div>
        </div>
      </AppLayout>
    );
  }

  if (error || !document) {
    return (
      <AppLayout pageName="Document Detail">
        <div className="text-center py-12">
          <div className="text-lg text-red-500 mb-4">{error || 'Document not found'}</div>
          <button
            onClick={() => router.push('/supporting-documents')}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
          >
            Back to Documents
          </button>
        </div>
      </AppLayout>
    );
  }

  const previewUrl = document.preview_url;
  const contentType = previewUrl ? (previewUrl.includes('.pdf') ? 'application/pdf' : 'image/*') : null;
  const structuredFields = document.structured_fields || document.extracted_metadata?.structured_fields;
  const linkedInvoices = document.linked_invoices || [];

  const formatAmount = (amount?: number | null, currency?: string | null) => {
    if (amount === null || amount === undefined) return '-';

    return `${currency || 'MYR'} ${amount.toLocaleString('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <AppLayout pageName={`Document ${document.id}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Document Detail</h1>
            <button
              onClick={() => router.push('/supporting-documents')}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              ← Back to Documents
            </button>
          </div>
          <div className="flex items-center gap-2">
            {!isEditMode ? (
              <button
                onClick={() => setIsEditMode(true)}
                className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] transition-colors text-sm font-medium"
                style={{ color: 'var(--foreground)' }}
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsEditMode(false);
                    loadDocumentData(); // Reset to original values
                  }}
                  className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] transition-colors text-sm font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDocument}
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors text-sm font-medium"
                >
                  Save
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document Preview - Left Column */}
          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                📄 Document Preview
              </h2>
              {previewUrl && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setZoomLevel(Math.max(25, zoomLevel - 25))}
                    className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                    title="Zoom Out"
                  >
                    ➖
                  </button>
                  <span className="text-sm font-medium min-w-[60px] text-center" style={{ color: 'var(--foreground)' }}>
                    {zoomLevel}%
                  </span>
                  <button
                    onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
                    className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                    title="Zoom In"
                  >
                    ➕
                  </button>
                  <button
                    onClick={() => setZoomLevel(100)}
                    className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                    title="Reset Zoom"
                  >
                    🔄
                  </button>
                </div>
              )}
            </div>
            {previewUrl ? (
              <>
                <div className="overflow-auto border border-[var(--border)] rounded-md" style={{ maxHeight: '600px' }}>
                  {contentType === 'application/pdf' ? (
                    <div style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left', width: `${100 / (zoomLevel / 100)}%` }}>
                      <iframe
                        src={previewUrl}
                        className="w-full border-0"
                        style={{ height: '600px' }}
                        title="Document Preview"
                      />
                    </div>
                  ) : (
                    <div className="flex justify-center items-start" style={{ minHeight: '400px' }}>
                      <img
                        src={previewUrl}
                        alt="Document Preview"
                        className="border-0"
                        style={{
                          transform: `scale(${zoomLevel / 100})`,
                          transformOrigin: 'center',
                          maxWidth: '100%',
                          height: 'auto',
                        }}
                      />
                    </div>
                  )}
                </div>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-4 text-sm text-[var(--primary)] hover:underline"
                >
                  📥 Open in new tab
                </a>
              </>
            ) : (
              <div className="text-sm text-[var(--muted-foreground)] p-4 border border-[var(--border)] rounded-md">
                Preview not available for this document.
              </div>
            )}
          </div>

          {/* Document Data - Right Column */}
          <div className="space-y-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-auto lg:pr-2">
            {/* Document Information */}
            <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                📋 Document Information
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    Document Type
                  </div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {document.document_type?.label || '-'}
                  </div>
                  {document.document_type?.description && (
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">
                      {document.document_type.description}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    Reference Number
                  </div>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={formData.reference_number}
                      onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                      className="w-full px-2 py-1 border border-[var(--border)] rounded text-sm text-[var(--foreground)] bg-[var(--background)]"
                    />
                  ) : (
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {document.reference_number || '-'}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    Date
                  </div>
                  {isEditMode ? (
                    <input
                      type="date"
                      value={formData.document_date}
                      onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                      className="w-full px-2 py-1 border border-[var(--border)] rounded text-sm text-[var(--foreground)] bg-[var(--background)]"
                    />
                  ) : (
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {document.document_date ? new Date(document.document_date).toLocaleDateString() : '-'}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    Direction
                  </div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {document.direction ? (
                      <span className={`inline-block px-2 py-1 text-xs rounded-md ${
                        document.direction === 'AP' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                        document.direction === 'AR' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {document.direction}
                      </span>
                    ) : '-'}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    Category
                  </div>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {document.category || '-'}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    Amount Total
                  </div>
                  {isEditMode ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount_total ?? ''}
                      onChange={(e) => setFormData({ ...formData, amount_total: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-2 py-1 border border-[var(--border)] rounded text-sm text-[var(--foreground)] bg-[var(--background)]"
                      placeholder="Enter amount"
                    />
                  ) : (
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {document.amount_total ? document.amount_total.toLocaleString('en-MY', {
                        style: 'currency',
                        currency: 'MYR',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }) : '-'}
                    </div>
                  )}
                </div>

                {document.weight_kg !== null && document.weight_kg !== undefined && (
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Weight (kg)
                    </div>
                    {isEditMode ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.weight_kg ?? ''}
                        onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-2 py-1 border border-[var(--border)] rounded text-sm text-[var(--foreground)] bg-[var(--background)]"
                        placeholder="Enter weight"
                      />
                    ) : (
                      <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {document.weight_kg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                      </div>
                    )}
                  </div>
                )}

                {document.quantity !== null && document.quantity !== undefined && (
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Quantity
                    </div>
                    {isEditMode ? (
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={formData.quantity ?? ''}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-2 py-1 border border-[var(--border)] rounded text-sm text-[var(--foreground)] bg-[var(--background)]"
                        placeholder="Enter quantity"
                      />
                    ) : (
                      <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {document.quantity.toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Exchange Rate */}
                {(formData.exchange_rate !== null || isEditMode) && (
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Exchange Rate
                    </div>
                    {isEditMode ? (
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={formData.exchange_rate ?? ''}
                        onChange={(e) => setFormData({ ...formData, exchange_rate: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full px-2 py-1 border border-[var(--border)] rounded text-sm text-[var(--foreground)] bg-[var(--background)]"
                        placeholder="Enter exchange rate"
                      />
                    ) : (
                      <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {formData.exchange_rate?.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) || '-'}
                      </div>
                    )}
                  </div>
                )}

                {(document.description || isEditMode) && (
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Description
                    </div>
                    {isEditMode ? (
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-2 py-1 border border-[var(--border)] rounded text-sm text-[var(--foreground)] bg-[var(--background)]"
                        rows={3}
                        placeholder="Enter description"
                      />
                    ) : (
                      <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {document.description || '-'}
                      </div>
                    )}
                  </div>
                )}

                {document.upload_status && (
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Upload Status
                    </div>
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      <span className={`inline-block px-2 py-1 text-xs rounded-md ${
                        document.upload_status === 'completed' ? 'bg-[var(--success)] text-white' :
                        document.upload_status === 'processing' ? 'bg-[var(--info)] text-white' :
                        document.upload_status === 'failed' ? 'bg-[var(--error)] text-white' :
                        'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        {document.upload_status}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Extracted Data */}
            {structuredFields && (
              <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                  🔍 Extracted Data
                </h3>
                {renderStructuredFields(structuredFields)}
              </div>
            )}

            {/* Linked Invoices */}
            {(
              <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                      Linked Invoices
                    </h3>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Review AI-created links and correct them without deleting either document.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openLinkEditor()}
                    className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
                  >
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                    Link invoice
                  </button>
                </div>
                {linkedInvoices.length === 0 && (
                  <div className="rounded-md border border-dashed border-[var(--border)] p-5 text-center text-sm text-[var(--muted-foreground)]">
                    This supporting document is not linked to an invoice.
                  </div>
                )}
                <div className="space-y-3">
                  {linkedInvoices.map((invoice) => {
                    const invoiceLabel = invoice.invoice_no || `Invoice #${invoice.id}`;
                    const supportingLink = document.child_links?.find(
                      (link) =>
                        link.parent_document_id === invoice.document_id &&
                        link.link_type?.toUpperCase() === 'SUPPORTING'
                    );

                    return (
                      <div
                        key={invoice.id}
                        className="flex flex-col gap-4 p-4 border border-[var(--border)] rounded-md hover:bg-[var(--muted)] transition-colors sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => router.push(`/documents/${invoice.id}`)}
                            className="text-left text-sm font-medium hover:underline"
                            style={{ color: 'var(--primary)' }}
                          >
                            {invoiceLabel}
                          </button>
                          <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2" style={{ color: 'var(--muted-foreground)' }}>
                            <div>Invoice ID: {invoice.id}</div>
                            {invoice.document_id && <div>Document ID: {invoice.document_id}</div>}
                            {invoice.invoice_date && (
                              <div>Date: {new Date(invoice.invoice_date).toLocaleDateString()}</div>
                            )}
                            {invoice.po_number && <div>PO: {invoice.po_number}</div>}
                            {invoice.vendor_name && <div>Vendor: {invoice.vendor_name}</div>}
                            {invoice.customer_name && <div>Customer: {invoice.customer_name}</div>}
                            <div>Total: {formatAmount(invoice.total, invoice.currency)}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <button
                            type="button"
                            onClick={() => router.push(`/documents/${invoice.id}`)}
                            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--hover-bg-lighter)] dark:hover:bg-[var(--hover-bg)]"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => supportingLink && openLinkEditor(supportingLink.id)}
                            disabled={!supportingLink || linkActionInvoiceId === supportingLink.id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            title={supportingLink ? 'Replace this incorrect link with another invoice' : 'Link information is unavailable'}
                          >
                            <Link2 className="h-4 w-4" aria-hidden="true" />
                            Change link
                          </button>
                          <button
                            type="button"
                            onClick={() => supportingLink && handleUnlink(supportingLink.id, invoiceLabel)}
                            disabled={!supportingLink || linkActionInvoiceId === supportingLink.id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-red-600 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                            title={supportingLink ? 'Remove this link only' : 'Link information is unavailable'}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            {linkActionInvoiceId === supportingLink?.id ? 'Unlinking...' : 'Unlink'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isLinkEditorOpen && (
                  <div className="mt-5 rounded-lg border border-[var(--primary)] bg-[var(--muted)] p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-[var(--foreground)]">
                          {replacementLinkId ? 'Choose the correct invoice' : 'Link to an invoice'}
                        </h4>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          Search by invoice number or company name. The old link is removed only after the new link succeeds.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closeLinkEditor}
                        className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"
                        aria-label="Close invoice search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <form
                      className="flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void searchInvoices();
                      }}
                    >
                      <input
                        type="search"
                        value={invoiceSearch}
                        onChange={(event) => setInvoiceSearch(event.target.value)}
                        placeholder="Invoice number or company name"
                        className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] dark:bg-[var(--card)]"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={isSearchingInvoices}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-60"
                      >
                        <Search className="h-4 w-4" aria-hidden="true" />
                        {isSearchingInvoices ? 'Searching...' : 'Search'}
                      </button>
                    </form>

                    <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                      {!isSearchingInvoices && invoiceCandidates.length === 0 && (
                        <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">No invoices found.</p>
                      )}
                      {invoiceCandidates.map((candidate) => {
                        const isAlreadyLinked = linkedInvoices.some((invoice) => invoice.id === candidate.id);
                        return (
                          <div
                            key={candidate.id}
                            className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-white p-3 dark:bg-[var(--card)] sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 text-sm">
                              <div className="font-semibold text-[var(--foreground)]">
                                {candidate.invoice_no || `Invoice #${candidate.id}`}
                              </div>
                              <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                                {candidate.vendor_name || candidate.customer_name || 'Company not available'}
                                {' · '}
                                {formatAmount(candidate.total, candidate.currency)}
                                {candidate.invoice_date ? ` · ${new Date(candidate.invoice_date).toLocaleDateString()}` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleLinkToInvoice(candidate)}
                              disabled={!candidate.document_id || isAlreadyLinked || linkActionInvoiceId === candidate.id}
                              className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                              title={!candidate.document_id ? 'Invoice linking data is not ready' : undefined}
                            >
                              {isAlreadyLinked
                                ? 'Already linked'
                                : linkActionInvoiceId === candidate.id
                                ? 'Linking...'
                                : replacementLinkId
                                ? 'Use this invoice'
                                : 'Link'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Duplicate Information */}
            {document.duplicate_count && document.duplicate_count > 1 && (
              <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                  🔁 Duplicate Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Duplicate Count
                    </div>
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {document.duplicate_count} document(s) in this group
                    </div>
                  </div>
                  {document.duplicate_group_id && (
                    <div>
                      <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                        Group ID
                      </div>
                      <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {document.duplicate_group_id}
                      </div>
                    </div>
                  )}
                  {document.is_duplicate && (
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-md">
                      <div className="text-sm text-orange-700 dark:text-orange-400">
                        ⚠️ This is a duplicate document
                      </div>
                    </div>
                  )}
                  {document.duplicate_documents && document.duplicate_documents.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--muted-foreground)' }}>
                        Other Duplicates
                      </div>
                      <div className="space-y-2">
                        {document.duplicate_documents.map((dup) => (
                          <div key={dup.id} className="p-2 bg-[var(--muted)] rounded-md">
                            <div className="text-sm">
                              <span className="font-medium">ID {dup.id}</span> - {dup.reference_number} ({new Date(dup.document_date).toLocaleDateString()})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DocumentDetail;
