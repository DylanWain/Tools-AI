// ============================================================================
// FileDropzone.tsx - Drag and drop file upload
// ============================================================================

import React, { useState, useCallback, useRef } from 'react';
import type { FileDropzoneProps } from '../types';

const UploadIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17,8 12,3 7,8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const DEFAULT_ACCEPTED_TYPES = [
  'image/*',
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.md',
  '.json',
  '.csv',
  '.xls',
  '.xlsx',
];

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxSize = DEFAULT_MAX_SIZE,
  multiple = true,
  children,
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback((files: File[]): File[] => {
    const valid: File[] = [];
    
    for (const file of files) {
      // Check size
      if (file.size > maxSize) {
        setError(`File "${file.name}" exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`);
        continue;
      }

      // Check type (basic validation)
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const typeMatch = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', ''));
        }
        return type === ext || file.type === type;
      });

      if (!typeMatch) {
        setError(`File type "${ext}" is not supported`);
        continue;
      }

      valid.push(file);
    }

    return valid;
  }, [acceptedTypes, maxSize]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
    setError(null);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = validateFiles(multiple ? files : files.slice(0, 1));
    
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  }, [multiple, validateFiles, onFilesSelected]);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files ? Array.from(e.target.files) : [];
    const validFiles = validateFiles(files);
    
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
    
    // Reset input
    e.target.value = '';
  }, [validateFiles, onFilesSelected]);

  return (
    <div>
      <div
        className={`file-dropzone ${isDragActive ? 'active' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        {children || (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{ color: 'var(--text-tertiary)' }}>
              <UploadIcon />
            </div>
            <div className="file-dropzone-text">
              <strong style={{ color: 'var(--accent-primary)' }}>Click to upload</strong>
              {' or drag and drop'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              PDF, DOC, TXT, Images up to {Math.round(maxSize / 1024 / 1024)}MB
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: '8px',
          padding: '8px 12px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--accent-danger)',
          fontSize: '13px',
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default FileDropzone;
