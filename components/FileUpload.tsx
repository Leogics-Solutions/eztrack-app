'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Camera, Image as ImageIcon } from 'lucide-react';

interface FileUploadProps {
  onFileSelect?: (file: File | null) => void;
  onFilesSelect?: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  required?: boolean;
  label?: string;
  helpText?: string;
  requiredText?: string;
  autoUpload?: boolean; // If false, files are only selected, not uploaded immediately
}

export function FileUpload({
  onFileSelect,
  onFilesSelect,
  multiple = false,
  accept,
  required = false,
  label,
  helpText,
  requiredText,
  autoUpload = true,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showMobileOptions, setShowMobileOptions] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // If multiple is true, append to existing files; otherwise replace
    const updatedFiles = multiple 
      ? [...selectedFiles, ...fileArray] 
      : fileArray;
    
    setSelectedFiles(updatedFiles);

    // Only call callbacks if autoUpload is true (default behavior)
    if (autoUpload) {
      if (multiple && onFilesSelect) {
        onFilesSelect(updatedFiles);
      } else if (!multiple && onFileSelect) {
        onFileSelect(updatedFiles[0] || null);
      } else if (multiple && !onFilesSelect && onFileSelect) {
        // Fallback: if multiple is true but only onFileSelect is provided, use first file
        onFileSelect(updatedFiles[0] || null);
      }
    } else {
      // If autoUpload is false, just update selected files state
      // Callbacks will be called manually when upload button is clicked
      if (multiple && onFilesSelect) {
        onFilesSelect(updatedFiles);
      } else if (!multiple && onFileSelect) {
        onFileSelect(updatedFiles[0] || null);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleClick = () => {
    if (isMobile) {
      setShowMobileOptions(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleTakePhoto = () => {
    setShowMobileOptions(false);
    // Small delay to ensure modal closes before opening camera
    setTimeout(() => {
      cameraInputRef.current?.click();
    }, 100);
  };

  const handleUploadFromDevice = () => {
    setShowMobileOptions(false);
    // Small delay to ensure modal closes before opening file picker
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    
    if (multiple && onFilesSelect) {
      onFilesSelect(newFiles);
    } else if (!multiple && onFileSelect) {
      onFileSelect(newFiles[0] || null);
    }
  };

  const getFileDisplayName = (file: File) => {
    return file.name.length > 30 ? `${file.name.substring(0, 30)}...` : file.name;
  };

  return (
    <>
      <div className="mb-6">
        {label && (
          <label className="block text-sm font-medium mb-2">
            {label}
            {required && requiredText && (
              <span className="text-[var(--error)] ml-1">{requiredText}</span>
            )}
          </label>
        )}

        {/* Drag and Drop Area */}
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragging 
              ? 'border-[var(--primary)] bg-[var(--primary-light)] bg-opacity-10' 
              : 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--muted)]'
            }
          `}
        >
          <Upload className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
            {isMobile ? 'Tap to upload' : 'Drag and drop files here, or click to select'}
          </p>
          {helpText && (
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {helpText}
            </p>
          )}
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-[var(--border)] rounded-md bg-[var(--card)]"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <ImageIcon className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-sm truncate" style={{ color: 'var(--foreground)' }}>
                    {getFileDisplayName(file)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="ml-2 p-1 rounded hover:bg-[var(--muted)] transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Hidden Camera Input (for mobile) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileInputChange}
          className="hidden"
          style={{ display: 'none' }}
        />
      </div>

      {/* Mobile Bottom Sheet */}
      {showMobileOptions && (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/50"
            onClick={() => setShowMobileOptions(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[9999] bg-[var(--card)] rounded-t-xl shadow-2xl transform transition-transform duration-300"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <div className="p-4">
              <div className="w-12 h-1 bg-[var(--border)] rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-4 text-center" style={{ color: 'var(--foreground)' }}>
                Select Source
              </h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  className="w-full flex items-center gap-3 p-4 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
                  style={{ color: 'var(--foreground)' }}
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-base font-medium">Take Photo</span>
                </button>
                <button
                  type="button"
                  onClick={handleUploadFromDevice}
                  className="w-full flex items-center gap-3 p-4 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
                  style={{ color: 'var(--foreground)' }}
                >
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-base font-medium">Upload from Device</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMobileOptions(false)}
                  className="w-full p-4 border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors mt-2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

