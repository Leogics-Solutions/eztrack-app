'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Plus, Check, ArrowLeft, ArrowUp, ArrowDown, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { 
  uploadToGroup, 
  completeGroup, 
  cancelGroup, 
  getGroupStatus, 
  type GroupStatusData,
  isAsyncCompleteResponse,
  getBatchJobStatus
} from '@/services/InvoiceService';

interface InvoicePage {
  id: string;
  file: File;
  preview: string;
  pageNumber: number;
  uploaded?: boolean;
}

interface InvoiceSession {
  id: string;
  number: number;
  pages: InvoicePage[];
  groupId?: string;
}

interface InvoiceScannerProps {
  onComplete: (session: InvoiceSession) => void;
  onCancel?: () => void;
  autoClassify?: boolean;
}

export function InvoiceScanner({ onComplete, onCancel, autoClassify = false }: InvoiceScannerProps) {
  const { t } = useLanguage();
  const [currentSession, setCurrentSession] = useState<InvoiceSession | null>(null);
  const [currentPage, setCurrentPage] = useState<InvoicePage | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [groupStatus, setGroupStatus] = useState<GroupStatusData | null>(null);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileSelectRef = useRef<((e: React.ChangeEvent<HTMLInputElement>) => void) | undefined>(undefined);
  const sessionRef = useRef<InvoiceSession | null>(null);

  // Ensure camera input is properly set up and accessible
  useEffect(() => {
    const input = cameraInputRef.current;
    if (input) {
      // Make sure input is accessible (not completely hidden) - mobile browsers need this
      input.style.position = 'absolute';
      input.style.width = '1px';
      input.style.height = '1px';
      input.style.opacity = '0';
      input.style.overflow = 'hidden';
      input.style.clip = 'rect(0, 0, 0, 0)';
      input.style.whiteSpace = 'nowrap';
      input.style.border = '0';
      if (input.classList.contains('hidden')) {
        input.classList.remove('hidden');
      }
      
      // Add direct event listener as backup (some mobile browsers need this)
      const handleChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        console.log('Direct event listener fired, files:', target.files?.length);
        if (target.files && target.files.length > 0 && handleFileSelectRef.current) {
          const changeEvent = e as unknown as React.ChangeEvent<HTMLInputElement>;
          handleFileSelectRef.current(changeEvent);
        }
      };
      
      input.addEventListener('change', handleChange, { capture: true });
      return () => {
        input.removeEventListener('change', handleChange, { capture: true });
      };
    }
  }, []);

  const createNewSession = (sessionNumber: number): InvoiceSession => {
    return {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      number: sessionNumber,
      pages: [],
    };
  };

  // Helper to deduplicate pages by file reference
  const deduplicatePages = (pages: InvoicePage[]): InvoicePage[] => {
    const seen = new Set<string>();
    return pages.filter(page => {
      const key = `${page.file.name}-${page.file.size}-${page.file.lastModified}`;
      if (seen.has(key)) {
        console.warn('Removing duplicate page:', page.file.name);
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  // Helper to update both session state and ref together
  const updateSession = (session: InvoiceSession | null) => {
    if (session && session.pages) {
      // Deduplicate pages before updating
      const deduplicatedPages = deduplicatePages(session.pages);
      if (deduplicatedPages.length !== session.pages.length) {
        console.log(`Deduplicated pages: ${session.pages.length} -> ${deduplicatedPages.length}`);
        session = { ...session, pages: deduplicatedPages };
      }
    }
    sessionRef.current = session;
    setCurrentSession(session);
  };

  const startScanSession = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    const sessionNumber = 1; // In a real app, this would come from state/context
    const session = createNewSession(sessionNumber);
    
    // Reset all states first
    setCurrentPage(null);
    setShowReview(false);
    setUploadError(null);
    setIsUploading(false);
    
    // Set session in both state and ref - ref ensures it's always available
    updateSession(session);
    
    // Reset camera input and trigger camera
    // Must be synchronous with user interaction for mobile browsers
    if (cameraInputRef.current) {
      // Reset input value to ensure onChange fires
      cameraInputRef.current.value = '';
      
      try {
        // Trigger camera immediately (synchronous with user interaction for mobile)
        cameraInputRef.current.focus();
        cameraInputRef.current.click();
      } catch (error) {
        console.error('Error triggering camera:', error);
        setUploadError('Failed to open camera. Please check browser permissions and try again.');
      }
    } else {
      console.error('Camera input ref is not available');
      setUploadError('Camera input not available. Please refresh the page.');
    }
  };

  const triggerCamera = () => {
    // For subsequent camera triggers (retake, add more pages)
    // Use requestAnimationFrame to ensure DOM is ready
    if (cameraInputRef.current) {
      requestAnimationFrame(() => {
        if (cameraInputRef.current) {
          try {
            cameraInputRef.current.click();
          } catch (error) {
            console.error('Error triggering camera:', error);
            setUploadError('Failed to open camera. Please try again.');
          }
        }
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('=== handleFileSelect called ===', {
      filesLength: e.target.files?.length,
      hasFiles: !!e.target.files,
      target: e.target
    });
    
    const file = e.target.files?.[0];
    
    if (!file) {
      console.log('No file selected in handleFileSelect');
      return;
    }

    console.log('File selected:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });

    // Set uploading state immediately and clear review mode
    setIsUploading(true);
    setShowReview(false);
    setUploadError(null);

    // Get session from ref first (most reliable), then from state, or create new one
    const existingSession = sessionRef.current;
    setCurrentSession((prevSession) => {
      // Use ref session if available (most reliable), otherwise use state, or create new
      const session = existingSession || prevSession || createNewSession(1);
      
      // Update ref to ensure it's always in sync (don't call updateSession here to avoid recursion)
      sessionRef.current = session;
      
      console.log('Session state:', session.id, 'Pages:', session.pages.length, 'Has session:', !!session);
      
      // Read file and create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          // Use session from ref to ensure it's always available and up-to-date
          const latestSession = sessionRef.current || session;
          const pageNumber = latestSession.pages.length + 1;
          const preview = reader.result as string;
          console.log('Preview created, length:', preview?.length, 'Session ID:', latestSession.id);
          
          if (!preview) {
            console.error('Preview is empty');
            setUploadError('Failed to create image preview. Please try again.');
            setIsUploading(false);
            return;
          }
          
          const page: InvoicePage = {
            id: `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            preview,
            pageNumber,
            uploaded: false,
          };
          
          console.log('Setting current page:', page.id, 'Preview exists:', !!page.preview);
          console.log('Current session:', latestSession.id, 'Current pages:', latestSession.pages.length);
          
          // Check if page already exists by file object reference (more reliable than ID)
          const pageExists = latestSession.pages.some(p => 
            p.file === file || 
            (p.file.name === file.name && p.file.size === file.size && p.file.lastModified === file.lastModified)
          );
          if (pageExists) {
            console.warn('Page already exists in session, skipping add. File:', file.name);
            // Find existing page and set it as current
            const existingPage = latestSession.pages.find(p => 
              p.file === file || 
              (p.file.name === file.name && p.file.size === file.size && p.file.lastModified === file.lastModified)
            );
            if (existingPage) {
              setCurrentPage(existingPage);
            }
            setIsUploading(false);
            setShowReview(false);
            return;
          }
          
          // Add page to session immediately so it's available when reviewing
          const updatedSession: InvoiceSession = {
            ...latestSession,
            pages: [
              ...latestSession.pages,
              page
            ],
          };
          
          // Update ref and state with session that includes the new page
          sessionRef.current = updatedSession;
          
          // Set all state updates together - React will batch them
          // Ensure session is set first, then page, so preview screen condition is met
          updateSession(updatedSession);
          setCurrentPage(page);
          setIsUploading(false);
          setShowReview(false);
          
          console.log('State updates queued - session:', updatedSession.id, 'page:', page.id, 'total pages:', updatedSession.pages.length);
        } catch (error) {
          console.error('Error processing file preview:', error);
          setUploadError('Failed to process image. Please try again.');
          setIsUploading(false);
        }
      };
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        setUploadError('Failed to read image. Please try again.');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
      
      return session;
    });
    
    // Reset input so same file can be selected again
    // Don't reset immediately on mobile - wait a bit
    setTimeout(() => {
      if (e.target) {
        e.target.value = '';
      }
    }, 100);
  };

  // Update the ref after handleFileSelect is defined
  // Using useLayoutEffect to ensure it runs synchronously after render
  useEffect(() => {
    handleFileSelectRef.current = handleFileSelect;
  }, [handleFileSelect]);

  const handleAddPage = async () => {
    if (!currentPage) return;
    
    // Get latest session from ref to avoid stale state
    const latestSession = sessionRef.current;
    if (!latestSession) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      // Upload to group
      const response = await uploadToGroup(
        currentPage.file,
        currentPage.pageNumber,
        latestSession.groupId ? { group_id: latestSession.groupId } : undefined
      );

      // Update session with group ID if this is the first page
      const groupId = response.data.group_id;
      
      // Update the page in the session to mark it as uploaded (page should already be in session from handleFileSelect)
      // Use latest session from ref to avoid duplicates
      const pageExists = latestSession.pages.some(p => p.id === currentPage.id);
      const updatedPages = pageExists
        ? latestSession.pages.map(p => 
            p.id === currentPage.id ? { ...p, uploaded: true } : p
          )
        : [...latestSession.pages, { ...currentPage, uploaded: true }];
      
      const updatedSession: InvoiceSession = {
        ...latestSession,
        groupId,
        pages: updatedPages,
      };
      
      sessionRef.current = updatedSession;
      updateSession(updatedSession);

      // Fetch updated group status
      const statusResponse = await getGroupStatus(groupId);
      setGroupStatus(statusResponse.data);

      // Clear current page and trigger camera
      // Use a small delay to ensure state updates before triggering camera
      setCurrentPage(null);
      
      // Trigger camera immediately (synchronous for mobile)
      if (cameraInputRef.current) {
        try {
          cameraInputRef.current.click();
        } catch (error) {
          console.error('Error triggering camera:', error);
          setUploadError('Failed to open camera. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Error uploading page:', error);
      setUploadError(error.message || 'Failed to upload page');
      setIsUploading(false);
    }
    // Note: Don't set isUploading to false here - let it stay true until new photo is taken
  };

  const handleRetake = () => {
    setCurrentPage(null);
    // Small delay to ensure state is updated before triggering camera
    requestAnimationFrame(() => {
      triggerCamera();
    });
  };

  const handleReviewPages = async () => {
    // Get latest session from ref to avoid stale state
    const latestSession = sessionRef.current;
    if (!latestSession) return;

    // If there's a current page, upload it first
    if (currentPage) {
      setIsUploading(true);
      setUploadError(null);
      
      try {
        const response = await uploadToGroup(
          currentPage.file,
          currentPage.pageNumber,
          latestSession.groupId ? { group_id: latestSession.groupId } : undefined
        );

        const groupId = response.data.group_id;
        
        // Update the page in the session to mark it as uploaded (page should already be in session from handleFileSelect)
        // Use latest session from ref to avoid duplicates
        const pageExists = latestSession.pages.some(p => p.id === currentPage.id);
        const updatedPages = pageExists
          ? latestSession.pages.map(p => 
              p.id === currentPage.id ? { ...p, uploaded: true } : p
            )
          : [...latestSession.pages, { ...currentPage, uploaded: true }];
        
        const updatedSession: InvoiceSession = {
          ...latestSession,
          groupId,
          pages: updatedPages,
        };
        
        sessionRef.current = updatedSession;
        updateSession(updatedSession);

        // Fetch updated group status
        const statusResponse = await getGroupStatus(groupId);
        setGroupStatus(statusResponse.data);

        setCurrentPage(null);
      } catch (error: any) {
        console.error('Error uploading page:', error);
        setUploadError(error.message || 'Failed to upload page');
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    // Refresh group status if we have a group (use latest session from ref)
    const finalSession = sessionRef.current || latestSession;
    if (finalSession?.groupId) {
      try {
        const statusResponse = await getGroupStatus(finalSession.groupId);
        setGroupStatus(statusResponse.data);
      } catch (error) {
        console.error('Error fetching group status:', error);
      }
    }

    setShowReview(true);
  };

  const handleAddMorePages = () => {
    setShowReview(false);
    setUploadError(null);
    // Small delay to ensure state is updated before triggering camera
    requestAnimationFrame(() => {
      triggerCamera();
    });
  };

  const handleDeletePage = (pageId: string) => {
    if (!currentSession) return;
    
    // Note: The API doesn't support deleting individual pages from a group
    // So we'll just remove it from the UI, but it will still be in the group
    // The user would need to cancel the entire group and start over
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

  const handleSubmit = async (overrideAutoClassify?: boolean) => {
    const shouldAutoClassify = overrideAutoClassify !== undefined ? overrideAutoClassify : autoClassify;
    if (!currentSession || !currentSession.groupId || currentSession.pages.length === 0) {
      alert('No pages to submit. Please add at least one page.');
      return;
    }
    
    setIsSubmitting(true);
    setUploadError(null);
    
    try {
      // Complete the group asynchronously - returns immediately with job_id
      const response = await completeGroup(currentSession.groupId, {
        auto_classify: shouldAutoClassify,
        async_process: true, // Enable async processing so user can start next group immediately
      });
      
      // Check if response is async (returns job_id) or sync (returns invoice)
      if (isAsyncCompleteResponse(response)) {
        // Async mode: processing started in background
        const jobId = response.data.job_id;
        console.log('Invoice processing started in background. Job ID:', jobId);
        
        // Create a session object compatible with onComplete
        const completedSession: InvoiceSession = {
          ...currentSession,
          pages: currentSession.pages.map((page, index) => ({
            ...page,
            pageNumber: index + 1,
          })),
        };
        
        // Call the onComplete callback with the session
        // The invoice will be created in the background
        onComplete(completedSession);
        
        // Show success message
        alert('OK created task');
        
        // Reload page to reset everything to clean state
        window.location.reload();
        
        // Optionally poll for job completion in the background (non-blocking)
        // This is just for logging/debugging - UI doesn't wait
        pollJobStatus(jobId).catch(err => {
          console.error('Error polling job status:', err);
          // Don't show error to user - processing continues in background
        });
      } else {
        // Sync mode (shouldn't happen with async_process: true, but handle it)
        const completedSession: InvoiceSession = {
          ...currentSession,
          pages: currentSession.pages.map((page, index) => ({
            ...page,
            pageNumber: index + 1,
          })),
        };
        
        onComplete(completedSession);
        alert('OK created task');
        
        // Reload page to reset everything to clean state
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error completing invoice:', error);
      setUploadError(error.message || 'Failed to complete invoice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset scanner to initial state
  const resetScanner = () => {
    // Set to null to show initial screen with "Scan with Camera" button
    updateSession(null);
    setCurrentPage(null);
    setShowReview(false);
    setShowSuccess(false);
    setGroupStatus(null);
    setUploadError(null);
    setIsSubmitting(false);
    setIsUploading(false);
    
    // Reset camera input so it can be triggered again
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  // Helper function to poll job status in the background (non-blocking)
  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 60; // Poll for up to 5 minutes (5s intervals)
    let attempts = 0;
    
    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        console.log('Job status polling timeout. Job may still be processing.');
        return;
      }
      
      attempts++;
      
      try {
        const statusResponse = await getBatchJobStatus(jobId);
        const status = statusResponse.data.status;
        
        if (status === 'SUCCESS') {
          console.log('Invoice processing completed successfully. Invoice ID:', statusResponse.data.invoice_id);
          return;
        } else if (status === 'FAILED') {
          console.error('Invoice processing failed:', statusResponse.data.error_message);
          return;
        } else {
          // Still processing, poll again after 5 seconds
          setTimeout(poll, 5000);
        }
      } catch (error) {
        console.error('Error checking job status:', error);
        // Continue polling despite errors
        setTimeout(poll, 5000);
      }
    };
    
    // Start polling after a short delay
    setTimeout(poll, 2000);
  };

  const handleScanNext = () => {
    // Reset for next invoice
    const nextNumber = (currentSession?.number || 0) + 1;
    const newSession = createNewSession(nextNumber);
    setCurrentSession(newSession);
    setCurrentPage(null);
    setShowReview(false);
    setShowSuccess(false);
    setGroupStatus(null);
    setUploadError(null);
    triggerCamera();
  };

  const handleCancelGroup = async () => {
    if (!currentSession?.groupId) {
      // Just reset if no group exists
      setCurrentSession(null);
      setCurrentPage(null);
      setShowReview(false);
      setGroupStatus(null);
      setUploadError(null);
      if (onCancel) onCancel();
      return;
    }

    try {
      await cancelGroup(currentSession.groupId);
      setCurrentSession(null);
      setCurrentPage(null);
      setShowReview(false);
      setGroupStatus(null);
      setUploadError(null);
      if (onCancel) onCancel();
    } catch (error: any) {
      console.error('Error canceling group:', error);
      setUploadError(error.message || 'Failed to cancel upload. Please try again.');
    }
  };

  const refreshGroupStatus = async () => {
    if (!currentSession?.groupId) return;

    try {
      const statusResponse = await getGroupStatus(currentSession.groupId);
      setGroupStatus(statusResponse.data);
    } catch (error: any) {
      console.error('Error refreshing group status:', error);
      setUploadError(error.message || 'Failed to refresh status');
    }
  };

  const handleUploadFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const sessionNumber = 1;
    const session = createNewSession(sessionNumber);
    setCurrentSession(session);
    
    setIsUploading(true);
    setUploadError(null);

    try {
      // Upload all files sequentially to the group
      let groupId: string | undefined;
      const pages: InvoicePage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const pageNumber = i + 1;

        const reader = new FileReader();
        const preview = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        // Upload to group
        const response = await uploadToGroup(
          file,
          pageNumber,
          groupId ? { group_id: groupId } : undefined
        );

        groupId = response.data.group_id;

        pages.push({
          id: `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview,
          pageNumber,
          uploaded: true,
        });
      }

      // Update session with all pages and group ID
      const updatedSession: InvoiceSession = {
        ...session,
        groupId,
        pages,
      };
      setCurrentSession(updatedSession);

      // Fetch group status
      if (groupId) {
        const statusResponse = await getGroupStatus(groupId);
        setGroupStatus(statusResponse.data);
      }

      setShowReview(true);
    } catch (error: any) {
      console.error('Error uploading files:', error);
      setUploadError(error.message || 'Failed to upload files');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
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
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] active:bg-[var(--primary-hover)] transition-colors touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
          >
            <Camera className="h-5 w-5" />
            <span className="text-base font-medium">Scan with Camera</span>
          </button>
          {uploadError && (
            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
              <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                Tip: Make sure you've granted camera permissions and are using HTTPS.
              </p>
            </div>
          )}
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
          style={{ 
            position: 'absolute',
            width: '1px',
            height: '1px',
            opacity: 0,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0
          }}
          aria-label="Camera input"
        />
      </div>
    );
  }

  // Preview Screen (after taking a photo)
  // Also show if we're uploading (waiting for next photo)
  if ((currentPage || isUploading) && !showReview && currentSession) {
    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Invoice #{currentSession.number} — Capture Pages
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {currentPage 
              ? `Page ${currentSession.pages.length + 1}`
              : `Uploading page ${currentSession.pages.length}...`
            }
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Pages process in parallel (max 3 at a time by default), then combine into one invoice.
          </p>
        </div>

        {currentPage ? (
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '3/4' }}>
            {currentPage.preview ? (
              <img
                src={currentPage.preview}
                alt="Preview"
                className="w-full h-full object-contain"
                onError={(e) => {
                  console.error('Image failed to load:', currentPage.preview);
                  setUploadError('Failed to load image preview. Please try again.');
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <p>Loading preview...</p>
              </div>
            )}
          </div>
        ) : isUploading ? (
          <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden" style={{ aspectRatio: '3/4' }}>
            <div className="w-full h-full flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin mb-4" style={{ color: 'var(--primary)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Uploading page... Please wait for camera to open.
              </p>
            </div>
          </div>
        ) : null}

        {uploadError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
          </div>
        )}

        {currentPage ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleRetake}
              disabled={isUploading}
              className="flex-1 px-4 py-3 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: 'var(--foreground)' }}
            >
              Retake
            </button>
            <button
              type="button"
              onClick={handleAddPage}
              disabled={isUploading}
              className="flex-1 px-4 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Add Next Page'
              )}
            </button>
            <button
              type="button"
              onClick={handleReviewPages}
              disabled={isUploading}
              className="flex-1 px-4 py-3 border border-[var(--primary)] rounded-lg hover:bg-[var(--primary)] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: 'var(--primary)' }}
            >
              Review Pages
            </button>
          </div>
        ) : isUploading ? (
          <div className="flex gap-3">
            <button
              type="button"
              disabled
              className="flex-1 px-4 py-3 border border-[var(--border)] rounded-lg opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
              style={{ color: 'var(--foreground)' }}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for camera...
            </button>
          </div>
        ) : null}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          style={{ 
            position: 'absolute',
            width: '1px',
            height: '1px',
            opacity: 0,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0
          }}
          aria-label="Camera input"
        />
      </div>
    );
  }

  // Review Screen
  if (showReview) {
    // Use ref session to get latest data and deduplicate pages
    const reviewSession = sessionRef.current || currentSession;
    if (!reviewSession) return null;
    
    // Deduplicate pages by file reference to prevent showing duplicates
    const uniquePages = reviewSession.pages.filter((page, index, self) => 
      index === self.findIndex(p => 
        p.id === page.id || 
        (p.file.name === page.file.name && 
         p.file.size === page.file.size && 
         p.file.lastModified === page.file.lastModified)
      )
    );
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              Invoice #{reviewSession.number} — Review Pages
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {uniquePages.length} {uniquePages.length === 1 ? 'page' : 'pages'} uploaded
              {uniquePages.length !== reviewSession.pages.length && (
                <span className="text-yellow-600 dark:text-yellow-400 ml-2">
                  ({reviewSession.pages.length} total, {reviewSession.pages.length - uniquePages.length} duplicates removed)
                </span>
              )}
              {groupStatus && groupStatus.total_files !== uniquePages.length && (
                <span className="text-yellow-600 dark:text-yellow-400 ml-2">
                  ({groupStatus.total_files} on server)
                </span>
              )}
            </p>
            {groupStatus && (
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Group ID: {groupStatus.group_id.substring(0, 8)}...
                {groupStatus.expires_at && (
                  <span className="ml-2">
                    Expires: {new Date(groupStatus.expires_at).toLocaleTimeString()}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={refreshGroupStatus}
              disabled={isUploading || !reviewSession.groupId}
              className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: 'var(--foreground)' }}
              title="Refresh group status"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleAddMorePages}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: 'var(--foreground)' }}
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm">Add Page</span>
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {uniquePages.map((page, index) => (
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
                alt={`Page ${page.pageNumber || index + 1}`}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <span>Page {page.pageNumber || index + 1}</span>
                {page.uploaded && (
                  <Check className="h-3 w-3 text-green-400" />
                )}
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
            onClick={handleCancelGroup}
            disabled={isSubmitting || isUploading}
            className="px-4 py-3 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-red-600 dark:text-red-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setShowReview(false);
              setUploadError(null);
              triggerCamera();
            }}
            disabled={isSubmitting || isUploading}
            className="flex-1 px-4 py-3 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--foreground)' }}
          >
            Add More Pages
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting || isUploading || currentSession.pages.length === 0 || !currentSession.groupId}
            className="flex-1 px-4 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Complete Invoice #${currentSession.number}`
            )}
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          style={{ 
            position: 'absolute',
            width: '1px',
            height: '1px',
            opacity: 0,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0
          }}
          aria-label="Camera input"
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
            Invoice #{currentSession.number} Processing Started
          </h3>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {currentSession.pages.length} {currentSession.pages.length === 1 ? 'page' : 'pages'} uploaded
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
            Processing in background. You can start scanning the next invoice now.
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
          <button
            type="button"
            onClick={() => {
              setCurrentSession(null);
              setCurrentPage(null);
              setShowReview(false);
              setShowSuccess(false);
              setGroupStatus(null);
              setUploadError(null);
              if (onCancel) onCancel();
            }}
            className="w-full px-6 py-3 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return null;
}

