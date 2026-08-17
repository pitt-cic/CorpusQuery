import { relativeTime } from '@/utils/dateFormat';
import type { RetrievalConfig } from '@/contracts';

interface Props {
  config: Partial<RetrievalConfig>;
  errors: Partial<Record<keyof RetrievalConfig, string>>;
  isDirty: boolean;
  isSaving: boolean;
  onFieldChange: (field: keyof RetrievalConfig, value: number) => void;
  onSave: () => Promise<void>;
  updatedAt?: string;
}

export default function RetrievalConfigCard({
  config,
  errors,
  isDirty,
  isSaving,
  onFieldChange,
  onSave,
  updatedAt,
}: Props) {
  return (
    <div className="bg-surface border border-border rounded-[--radius-card] p-8 mb-6 shadow-sm">
      <div className="flex justify-between items-center pb-4 mb-6 border-b border-dashed border-border">
        <span className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">RETRIEVAL CONFIGURATION</span>
        {updatedAt && (
          <span className="font-mono text-xs text-ink-muted">Last updated: {relativeTime(updatedAt)}</span>
        )}
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <label className="font-sans text-sm text-ink w-[180px] shrink-0">Evidence K</label>
          <input
            type="number"
            className={`w-20 h-10 border rounded-[--radius-input] px-3 font-sans text-sm text-center text-ink focus:outline-none focus:border-border-focus ${
              errors.evidenceK ? 'border-error' : 'border-border'
            }`}
            value={config.evidenceK ?? ''}
            min={1}
            onChange={(e) => onFieldChange('evidenceK', parseInt(e.target.value, 10))}
          />
          {errors.evidenceK && <span className="text-xs text-error">{errors.evidenceK}</span>}
        </div>
        <div className="flex items-center gap-4">
          <label className="font-sans text-sm text-ink w-[180px] shrink-0">Max Sources</label>
          <input
            type="number"
            className={`w-20 h-10 border rounded-[--radius-input] px-3 font-sans text-sm text-center text-ink focus:outline-none focus:border-border-focus ${
              errors.maxSources ? 'border-error' : 'border-border'
            }`}
            value={config.maxSources ?? ''}
            min={1}
            onChange={(e) => onFieldChange('maxSources', parseInt(e.target.value, 10))}
          />
          {errors.maxSources && <span className="text-xs text-error">{errors.maxSources}</span>}
        </div>
        <div className="flex items-center gap-4">
          <label className="font-sans text-sm text-ink w-[180px] shrink-0">MMR Lambda</label>
          <div className="flex items-center gap-3 flex-1">
            <input
              type="range"
              className="flex-1 accent-gold"
              min={0}
              max={1}
              step={0.05}
              value={config.mmrLambda ?? 1}
              onChange={(e) => onFieldChange('mmrLambda', parseFloat(e.target.value))}
            />
            <span className="font-mono text-[13px] text-ink w-10">
              {(config.mmrLambda ?? 1).toFixed(2)}
            </span>
          </div>
          {errors.mmrLambda && <span className="text-xs text-error">{errors.mmrLambda}</span>}
        </div>
        <div className="flex items-center gap-4">
          <label className="font-sans text-sm text-ink w-[180px] shrink-0">Evidence Summary Length</label>
          <input
            type="number"
            className={`w-20 h-10 border rounded-[--radius-input] px-3 font-sans text-sm text-center text-ink focus:outline-none focus:border-border-focus ${
              errors.evidenceSummaryLength ? 'border-error' : 'border-border'
            }`}
            value={config.evidenceSummaryLength ?? ''}
            min={50}
            max={500}
            onChange={(e) => onFieldChange('evidenceSummaryLength', parseInt(e.target.value, 10))}
          />
          <span className="text-xs text-ink-muted">words</span>
          {errors.evidenceSummaryLength && <span className="text-xs text-error">{errors.evidenceSummaryLength}</span>}
        </div>
        <div className="flex items-center gap-4">
          <label className="font-sans text-sm text-ink w-[180px] shrink-0">Answer Length</label>
          <input
            type="number"
            className={`w-20 h-10 border rounded-[--radius-input] px-3 font-sans text-sm text-center text-ink focus:outline-none focus:border-border-focus ${
              errors.answerLength ? 'border-error' : 'border-border'
            }`}
            value={config.answerLength ?? ''}
            min={100}
            max={1000}
            onChange={(e) => onFieldChange('answerLength', parseInt(e.target.value, 10))}
          />
          <span className="text-xs text-ink-muted">words</span>
          {errors.answerLength && <span className="text-xs text-error">{errors.answerLength}</span>}
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <button
          className="font-sans text-sm font-medium bg-ink text-white border-none rounded-[--radius-input] h-10 px-6 cursor-pointer transition-colors duration-150 hover:bg-gold hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!isDirty || isSaving}
          onClick={onSave}
        >
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
