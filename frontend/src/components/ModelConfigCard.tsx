import { relativeTime } from '@/utils/dateFormat';
import type { ModelConfig, ModelSelection } from '@/contracts';
import { Provider } from '@/contracts';

interface Props {
  config: ModelConfig | undefined;
  onSave: (config: Partial<ModelConfig>) => Promise<void>;
  isSaving: boolean;
}

const MODEL_OPTIONS = [
  { label: 'Amazon Bedrock / Claude Sonnet 4.6', provider: Provider.BEDROCK, modelId: 'us.anthropic.claude-sonnet-4-6', disabled: false },
  { label: 'Amazon Bedrock / Claude Haiku 4.5', provider: Provider.BEDROCK, modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', disabled: false },
  { label: 'Anthropic / Claude Sonnet 4.6', provider: Provider.ANTHROPIC, modelId: 'claude-sonnet-4-6', disabled: false },
  { label: 'OpenAI / GPT-4o', provider: Provider.OPENAI, modelId: 'gpt-4o', disabled: false },
];

const EMBEDDING_OPTIONS = [
  { label: 'Amazon Bedrock / Titan Embed v2', provider: Provider.BEDROCK, modelId: 'amazon.titan-embed-text-v2:0', disabled: false },
];

function ModelSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: ModelSelection | undefined;
  options: typeof MODEL_OPTIONS;
  onChange: (selection: ModelSelection) => void;
}) {
  const currentValue = value ? `${value.provider}/${value.modelId}` : '';

  return (
    <div className="flex items-center gap-4">
      <label className="font-sans text-sm text-ink w-[180px] shrink-0">{label}</label>
      <select
        className="flex-1 h-10 border border-border rounded-[--radius-input] px-3 font-sans text-sm text-ink bg-surface focus:outline-none focus:border-border-focus"
        value={currentValue}
        onChange={(e) => {
          const slashIdx = e.target.value.indexOf('/');
          const provider = e.target.value.slice(0, slashIdx) as Provider;
          const modelId = e.target.value.slice(slashIdx + 1);
          onChange({ provider, modelId });
        }}
      >
        {options.map((opt) => (
          <option key={`${opt.provider}/${opt.modelId}`} value={`${opt.provider}/${opt.modelId}`} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function ModelConfigCard({ config, onSave, isSaving }: Props) {
  return (
    <div className="bg-surface border border-border rounded-[--radius-card] p-8 mb-6 shadow-sm">
      <div className="flex justify-between items-center pb-4 mb-6 border-b border-dashed border-border">
        <span className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">MODEL CONFIGURATION</span>
        {config?.updatedAt && (
          <span className="font-mono text-xs text-ink-muted">Last updated: {relativeTime(config.updatedAt)}</span>
        )}
      </div>
      <div className="flex flex-col gap-5">
        <ModelSelect label="LLM Model" value={config?.llm} options={MODEL_OPTIONS} onChange={(llm) => onSave({ llm })} />
        <ModelSelect label="Summary LLM" value={config?.summaryLlm} options={MODEL_OPTIONS} onChange={(summaryLlm) => onSave({ summaryLlm })} />
        {/* TODO: Remove Agent LLM — not used in the backend query pipeline */}
        {/* <ModelSelect label="Agent LLM" value={config?.agentLlm} options={MODEL_OPTIONS} onChange={(agentLlm) => onSave({ agentLlm })} /> */}
        <ModelSelect label="Embedding Model" value={config?.embedding} options={EMBEDDING_OPTIONS} onChange={(embedding) => onSave({ embedding })} />
      </div>
      <div className="flex justify-end mt-6">
        <button
          className="font-sans text-sm font-medium bg-ink text-white border-none rounded-[--radius-input] h-10 px-6 cursor-pointer transition-colors duration-150 hover:bg-gold hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
