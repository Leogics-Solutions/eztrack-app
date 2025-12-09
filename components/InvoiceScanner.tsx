'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Plus, Check, ArrowLeft, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

interface InvoicePage {
  id: string;
  file: File;
  preview: string;
}

interface InvoiceSession {
  id: string;
  number: number;
  pages: InvoicePage[];
}

interface InvoiceScannerProps {
  onComplete: (session: InvoiceSession) => void;
  onCancel?: () => void;
}

export function InvoiceScanner({ onComplete, onCancel }: InvoiceScannerProps) {
  const { t } = useLanguage();
  const [currentSession, setCurrentSession] = useState<InvoiceSession | null>(null);
  const [currentPage, setCurrentPage] = useState<InvoicePage | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createNewSession = (sessionNumber: number): InvoiceSession => {
    return {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      number: sessionNumber,
      pages: [],
    };
  };

  const startScanSession = () => {
    const sessionNumber = 1; // In a real app, this would come from state/context
    const session = createNewSession(sessionNumber);
    setCurrentSession(session);
    setCurrentPage(null);
    setShowReview(false);
    triggerCamera();
  };

  const triggerCamera = () => {
    setTimeout(() => {
      cameraInputRef.current?.click();
    }, 100);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentSession) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const page: InvoicePage = {
        id: `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview: reader.result as string,
      };
      setCurrentPage(page);
    };
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleAddPage = () => {
    if (!currentPage || !currentSession) return;
    
    const updatedSession = {
      ...currentSession,
      pages: [...currentSession.pages, currentPage],
    };
    setCurrentSession(updatedSession);
    setCurrentPage(null);
    triggerCamera();
  };

  const handleRetake = () => {
    setCurrentPage(null);
    triggerCamera();
  };

  const handleReviewPages = () => {
    if (!currentPage || !currentSession) return;
    
    const updatedSession = {
      ...currentSession,
      pages: [...currentSession.pages, currentPage],
    };
    setCurrentSession(updatedSession);
    setCurrentPage(null);
    setShowReview(true);
  };

  const handleAddMorePages = () => {
    setShowReview(false);
    triggerCamera();
  };

  const handleDeletePage = (pageId: string) => {
    if (!currentSession) return;
    
    const updatedSession = {
      ...currentSession,
      pages: currentSession.pages.filter(p => p.id !== pageId),
    };
    setCurrentSession(updatedSession);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (!currentSession) return;
    
    const pages = [...currentSession.pages];
    const [removed] = pages.splice(fromIndex, 1);
    pages.splice(toIndex, 0, removed);
    
    setCurrentSession({
      ...currentSession,
      pages,
    });
  };

  const handleSubmit = async () => {
    if (!currentSession || currentSession.pages.length === 0) return;
    
    setIsSubmitting(true);
    
    try {
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Call the onComplete callback with the session
      onComplete(currentSession);
      
      setShowSuccess(true);
    } catch (error) {
      console.error('Error submitting invoice:', error);
      alert('Failed to submit invoice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScanNext = () => {
    // Reset for next invoice
    const nextNumber = (currentSession?.number || 0) + 1;
    const newSession = createNewSession(nextNumber);
    setCurrentSession(newSession);
    setCurrentPage(null);
    setShowReview(false);
    setShowSuccess(false);
    triggerCamera();
  };

  const handleUploadFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const sessionNumber = 1;
    const session = createNewSession(sessionNumber);
    
    const pages: InvoicePage[] = [];
    let loadedCount = 0;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        pages.push({
          id: `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview: reader.result as string,
        });
        loadedCount++;
        
        if (loadedCount === files.length) {
          session.pages = pages;
          setCurrentSession(session);
          setShowReview(true);
        }
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };

  // Entry Point
  if (!currentSession && !showSuccess) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleUploadFile}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            <Upload className="h-5 w-5" />
            <span className="text-base font-medium">Upload File</span>
          </button>
          <button
            type="button"
            onClick={startScanSession}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
          >
            <Camera className="h-5 w-5" />
            <span className="text-base font-medium">Scan with Camera</span>
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full px-6 py-3 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors text-sm"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Cancel
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  // Preview Screen (after taking a photo)
  if (currentPage && !showReview) {
    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Invoice #{currentSession?.number} — Capture Pages
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Page {currentSession ? currentSession.pages.length + 1 : 1}
          </p>
        </div>

        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '3/4' }}>
          <img
            src={currentPage.preview}
            alt="Preview"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRetake}
            className="flex-1 px-4 py-3 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            Retake
          </button>
          <button
            type="button"
            onClick={handleAddPage}
            className="flex-1 px-4 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
          >
            Add Next Page
          </button>
          <button
            type="button"
            onClick={handleReviewPages}
            className="flex-1 px-4 py-3 border border-[var(--primary)] rounded-lg hover:bg-[var(--primary)] hover:text-white transition-colors"
            style={{ color: 'var(--primary)' }}
          >
            Review Pages
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  // Review Screen
  if (showReview && currentSession) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              Invoice #{currentSession.number} — Review Pages
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {currentSession.pages.length} {currentSession.pages.length === 1 ? 'page' : 'pages'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddMorePages}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add Page</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {currentSession.pages.map((page, index) => (
            <div
              key={page.id}
              draggable
              onDragStart={() => setDraggedIndex(index)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== index) {
                  handleReorder(draggedIndex, index);
                  setDraggedIndex(index);
                }
              }}
              onDragEnd={() => setDraggedIndex(null)}
              className="relative group border border-[var(--border)] rounded-lg overflow-hidden bg-black"
              style={{ aspectRatio: '3/4' }}
            >
              <img
                src={page.preview}
                alt={`Page ${index + 1}`}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {index + 1}
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => handleReorder(index, index - 1)}
                    className="p-1 bg-black/70 text-white rounded hover:bg-black/90"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                )}
                {index < currentSession.pages.length - 1 && (
                  <button
                    type="button"
                    onClick={() => handleReorder(index, index + 1)}
                    className="p-1 bg-black/70 text-white rounded hover:bg-black/90"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeletePage(page.id)}
                  className="p-1 bg-red-600/70 text-white rounded hover:bg-red-600/90"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-4 border-t" style={{ borderTopColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={() => {
              setShowReview(false);
              triggerCamera();
            }}
            className="flex-1 px-4 py-3 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            Add More Pages
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || currentSession.pages.length === 0}
            className="flex-1 px-4 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : `Submit Invoice #${currentSession.number}`}
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  // Success Screen
  if (showSuccess && currentSession) {
    return (
      <div className="text-center space-y-6 py-8">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-[var(--success)] rounded-full flex items-center justify-center">
            <Check className="h-8 w-8 text-white" />
          </div>
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
            Invoice #{currentSession.number} uploaded
          </h3>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {currentSession.pages.length} {currentSession.pages.length === 1 ? 'page' : 'pages'}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleScanNext}
            className="w-full px-6 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
          >
            Scan Next Invoice
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full px-6 py-3 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
              style={{ color: 'var(--foreground)' }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

