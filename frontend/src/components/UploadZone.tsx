import { useCallback, useRef, useState, memo } from 'react';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const UploadZone = memo(function UploadZone({ onFilesSelected, disabled = false }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [disabled, onFilesSelected]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onFilesSelected(files);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [onFilesSelected]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        border-2 border-dashed rounded-[--radius-card] p-8 text-center
        transition-colors duration-150 cursor-pointer
        ${isDragging ? 'border-gold bg-gold-soft' : 'border-border hover:border-gold hover:bg-gold-soft'}
        ${disabled ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-3">
        <svg
          className="w-10 h-10 text-ink-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <p className="font-sans text-sm text-ink-muted">
          Drag and drop PDF files here
        </p>

        <p className="font-sans text-xs text-ink-muted">or</p>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          disabled={disabled}
          className="font-sans text-sm font-medium border border-border rounded-[--radius-input] px-4 py-2 hover:border-gold transition-colors"
        >
          Upload Files
        </button>

        <p className="font-mono text-[13px] text-ink-muted mt-2">
          PDF files only
        </p>
      </div>
    </div>
  );
});
