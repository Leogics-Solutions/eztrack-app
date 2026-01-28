'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getDocument, updateDocument, type Document, type StructuredFields, type UpdateDocumentRequest } from "@/services";
import { useToast } from "@/lib/toast";

const DocumentDetail = () => {
  const router = useRouter();
  const { id } = router.query;
  const { t } = useLanguage();

  // State
  const [document, setDocument] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isEditMode, setIsEditMode] = useState(false);
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

