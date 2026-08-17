import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

export type UploadStatus = 'pending' | 'uploading' | 'complete' | 'failed' | 'skipped';
export type BatchPhase = 'idle' | 'selecting' | 'preparing' | 'uploading' | 'complete';

export interface FileUploadState {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
}

export interface SkippedFile {
  filename: string;
  reason: string;
}

export function useDocumentUpload(orcid?: string) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<Map<string, FileUploadState>>(new Map());
  const [skipped, setSkipped] = useState<SkippedFile[]>([]);
  const [phase, setPhase] = useState<BatchPhase>('idle');
  const [indexJobId, setIndexJobId] = useState<string | null>(null);

  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  const safeSetFiles = useCallback(
    (updater: Map<string, FileUploadState> | ((prev: Map<string, FileUploadState>) => Map<string, FileUploadState>)) => {
      if (isMountedRef.current) {
        setFiles(updater);
      }
    },
    []
  );

  const safeSetPhase = useCallback((newPhase: BatchPhase) => {
    if (isMountedRef.current) {
      setPhase(newPhase);
    }
  }, []);

  const selectFiles = useCallback(
    (newFiles: File[]) => {
      safeSetFiles((prev) => {
        const next = new Map(prev);
        for (const file of newFiles) {
          if (!file.name.toLowerCase().endsWith('.pdf')) continue;
          const isDuplicate = Array.from(next.values()).some(
            (existing) => existing.file.name === file.name && existing.file.size === file.size
          );
          if (!isDuplicate) {
            const id = crypto.randomUUID();
            next.set(id, { id, file, status: 'pending', progress: 0 });
          }
        }
        return next;
      });
      safeSetPhase('selecting');
    },
    [safeSetFiles, safeSetPhase]
  );

  const updateFile = useCallback(
    (fileId: string, updates: Partial<FileUploadState>) => {
      safeSetFiles((prev) => {
        const next = new Map(prev);
        const existing = next.get(fileId);
        if (existing) {
          next.set(fileId, { ...existing, ...updates });
        }
        return next;
      });
    },
    [safeSetFiles]
  );

  const uploadFile = useCallback(
    async (fileState: FileUploadState, presignedUrl: string): Promise<void> => {
      const controller = new AbortController();
      abortControllersRef.current.set(fileState.id, controller);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            updateFile(fileState.id, { progress });
          }
        });

        xhr.addEventListener('load', () => {
          abortControllersRef.current.delete(fileState.id);
          if (xhr.status >= 200 && xhr.status < 300) {
            updateFile(fileState.id, { status: 'complete', progress: 100 });
            resolve();
          } else {
            updateFile(fileState.id, { status: 'failed', error: `Upload failed: ${xhr.status}` });
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          abortControllersRef.current.delete(fileState.id);
          updateFile(fileState.id, { status: 'failed', error: 'Network error' });
          reject(new Error('Network error'));
        });

        xhr.addEventListener('abort', () => {
          abortControllersRef.current.delete(fileState.id);
          updateFile(fileState.id, { status: 'failed', error: 'Upload cancelled' });
          reject(new Error('Upload cancelled'));
        });

        controller.signal.addEventListener('abort', () => xhr.abort());

        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', 'application/pdf');
        xhr.send(fileState.file);
      });
    },
    [updateFile]
  );

  const startUpload = useCallback(async () => {
    if (phase === 'uploading') return;

    const pendingFiles = Array.from(files.values()).filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    safeSetPhase('preparing');

    try {
      const filenames = pendingFiles.map((f) => f.file.name);
      const response = await api.getUploadUrls(filenames, orcid);

      setSkipped(response.skipped);

      // Mark skipped files
      for (const skip of response.skipped) {
        const fileEntry = pendingFiles.find((f) => f.file.name === skip.filename);
        if (fileEntry) {
          updateFile(fileEntry.id, { status: 'skipped', error: skip.reason });
        }
      }

      const toUpload = response.uploads.map((u) => {
        const fileEntry = pendingFiles.find((f) => f.file.name === u.filename);
        return { fileState: fileEntry!, presignedUrl: u.uploadUrl };
      }).filter((u) => u.fileState);

      if (toUpload.length === 0) {
        safeSetPhase('complete');
        return;
      }

      safeSetPhase('uploading');

      // Upload concurrently (max 3)
      const MAX_CONCURRENT = 3;
      const results: Promise<void>[] = [];
      const succeededFilenames: string[] = [];
      let index = 0;

      const uploadNext = async (): Promise<void> => {
        while (index < toUpload.length) {
          const current = toUpload[index++];
          updateFile(current.fileState.id, { status: 'uploading' });
          try {
            await uploadFile(current.fileState, current.presignedUrl);
            succeededFilenames.push(current.fileState.file.name);
          } catch {
            // Error already handled in uploadFile
          }
        }
      };

      for (let i = 0; i < Math.min(MAX_CONCURRENT, toUpload.length); i++) {
        results.push(uploadNext());
      }

      await Promise.all(results);

      // If ORCID is set, trigger S3 Vectors indexing for the uploaded files
      const successFilenames = succeededFilenames;

      if (orcid && successFilenames.length > 0) {
        try {
          const { jobId } = await api.indexDocuments(orcid, successFilenames);
          if (isMountedRef.current) setIndexJobId(jobId);
        } catch {
          // Indexing trigger failed — upload still succeeded
        }
      }

      safeSetPhase('complete');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch {
      safeSetPhase('complete');
    }
  }, [phase, files, orcid, safeSetPhase, updateFile, uploadFile, queryClient]);

  const cancelUpload = useCallback(() => {
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();
    safeSetPhase('complete');
  }, [safeSetPhase]);

  const removeFile = useCallback(
    (fileId: string) => {
      const controller = abortControllersRef.current.get(fileId);
      if (controller) {
        controller.abort();
        abortControllersRef.current.delete(fileId);
      }
      safeSetFiles((prev) => {
        const next = new Map(prev);
        next.delete(fileId);
        return next;
      });
    },
    [safeSetFiles]
  );

  const reset = useCallback(() => {
    cancelUpload();
    safeSetFiles(new Map());
    setSkipped([]);
    safeSetPhase('idle');
    setIndexJobId(null);
  }, [cancelUpload, safeSetFiles, safeSetPhase]);

  const overallProgress = useMemo(() => {
    const fileArray = Array.from(files.values());
    const total = fileArray.length;
    const completed = fileArray.filter((f) => f.status === 'complete' || f.status === 'skipped').length;
    return { completed, total };
  }, [files]);

  const canStartUpload = phase === 'selecting' && files.size > 0;
  const isUploading = phase === 'preparing' || phase === 'uploading';
  const anySuccess = Array.from(files.values()).some((f) => f.status === 'complete');

  return {
    files,
    skipped,
    phase,
    overallProgress,
    selectFiles,
    startUpload,
    cancelUpload,
    removeFile,
    reset,
    canStartUpload,
    isUploading,
    anySuccess,
    indexJobId,
  };
}
