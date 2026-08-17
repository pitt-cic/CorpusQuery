// frontend/src/components/UploadProgress.tsx
import { memo, useState, useCallback, useMemo } from 'react';
import type { FileUploadState, SkippedFile, BatchPhase } from '@/hooks/useDocumentUpload';

interface UploadProgressProps {
  files: Map<string, FileUploadState>;
  skipped: SkippedFile[];
  phase: BatchPhase;
  overallProgress: { completed: number; total: number };
  onRemove: (fileId: string) => void;
  onStartUpload: () => void;
  onCancel: () => void;
  onReset: () => void;
  canStartUpload: boolean;
  isUploading: boolean;
}

const StatusIcon = memo(function StatusIcon({ status }: { status: FileUploadState['status'] }) {
  switch (status) {
    case 'pending':
      return <span className="w-4 h-4 rounded-full border border-ink-muted" />;
    case 'uploading':
      return (
        <span className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      );
    case 'complete':
      return <span className="text-success">&#10003;</span>;
    case 'failed':
      return <span className="text-error">&#10005;</span>;
    case 'skipped':
      return <span className="text-ink-muted">&#8722;</span>;
    default:
      return null;
  }
});

const FileRow = memo(function FileRow({
  file,
  onRemove,
  showRemove = true,
}: {
  file: FileUploadState;
  onRemove: (id: string) => void;
  showRemove?: boolean;
}) {
  const handleRemove = useCallback(() => onRemove(file.id), [file.id, onRemove]);
  const sizeKB = Math.round(file.file.size / 1024);
  const sizeMB = sizeKB > 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB';

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0">
      <StatusIcon status={file.status} />
      <span className="flex-1 font-sans text-sm text-ink truncate">{file.file.name}</span>
      <span className="font-mono text-[13px] text-ink-muted">{sizeMB}</span>
      {showRemove && (
        <button
          onClick={handleRemove}
          disabled={file.status === 'uploading'}
          className="text-ink-muted hover:text-error disabled:opacity-50"
          aria-label={`Remove ${file.file.name}`}
        >
          &times;
        </button>
      )}
    </div>
  );
});

const CollapsibleSection = memo(function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 font-mono text-[13px] text-gold bg-transparent border-none cursor-pointer py-1"
      >
        <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>&#9658;</span>
        {title} ({count})
      </button>
      {isOpen && (
        <div className="mt-2 bg-surface border border-border rounded-[--radius-card] max-h-[200px] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
});

export const UploadProgress = memo(function UploadProgress({
  files,
  skipped,
  phase,
  overallProgress,
  onRemove,
  onStartUpload,
  onCancel,
  onReset,
  canStartUpload,
  isUploading,
}: UploadProgressProps) {
  const fileArray = useMemo(() => Array.from(files.values()), [files]);
  const readyFiles = useMemo(() => fileArray.filter((f) => f.status === 'pending'), [fileArray]);
  const uploadedFiles = useMemo(
    () => fileArray.filter((f) => f.status === 'complete' || f.status === 'failed'),
    [fileArray]
  );

  if (phase === 'idle') return null;

  return (
    <div className="mt-4">
      {/* Header with progress */}
      {isUploading && (
        <div className="flex items-center gap-2 mb-4 font-mono text-[13px] text-ink">
          <span className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          Uploading ({overallProgress.completed}/{overallProgress.total})
        </div>
      )}

      {phase === 'complete' && (
        <div className="flex items-center gap-2 mb-4 font-mono text-[13px] text-success">
          <span>&#10003;</span>
          Upload complete
        </div>
      )}

      {/* Ready to upload section */}
      {readyFiles.length > 0 && (
        <CollapsibleSection title="Ready to upload" count={readyFiles.length}>
          {readyFiles.map((file) => (
            <FileRow key={file.id} file={file} onRemove={onRemove} />
          ))}
        </CollapsibleSection>
      )}

      {/* Uploading/Uploaded section */}
      {(isUploading || phase === 'complete') && uploadedFiles.length > 0 && (
        <CollapsibleSection title="Uploaded" count={uploadedFiles.length}>
          {uploadedFiles.map((file) => (
            <FileRow key={file.id} file={file} onRemove={onRemove} showRemove={false} />
          ))}
        </CollapsibleSection>
      )}

      {/* Skipped section */}
      {skipped.length > 0 && (
        <CollapsibleSection title="Skipped - already exists" count={skipped.length} defaultOpen={false}>
          {skipped.map((s) => (
            <div key={s.filename} className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0">
              <span className="text-ink-muted">&#8722;</span>
              <span className="flex-1 font-sans text-sm text-ink-muted line-through truncate">
                {s.filename}
              </span>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-3 mt-4">
        {canStartUpload && (
          <>
            <button
              onClick={onReset}
              className="font-sans text-sm border border-border rounded-[--radius-input] px-4 py-2 hover:border-gold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onStartUpload}
              className="font-sans text-sm font-medium bg-ink text-white rounded-[--radius-input] px-4 py-2 hover:bg-gold hover:text-ink transition-colors"
            >
              Start Upload
            </button>
          </>
        )}

        {isUploading && (
          <button
            onClick={onCancel}
            className="font-sans text-sm border border-error text-error rounded-[--radius-input] px-4 py-2 hover:bg-error hover:text-white transition-colors"
          >
            Cancel Upload
          </button>
        )}

        {phase === 'complete' && (
          <button
            onClick={onReset}
            className="font-sans text-sm border border-border rounded-[--radius-input] px-4 py-2 hover:border-gold transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
});
