import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  position: 'centered' | 'docked';
  placeholder?: string;
}

export default function InputBar({
  onSubmit,
  disabled = false,
  position,
  placeholder = 'Ask about your papers...',
}: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, position === 'centered' ? 300 : 400)}px`;
    }
  }, [text, position]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      layoutId="input-bar"
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`w-full max-w-[720px] border border-border rounded-lg bg-surface shadow-sm ${
        position === 'centered' ? 'origin-top' : 'origin-bottom'
      }`}
    >
      <textarea
        ref={textareaRef}
        className="w-full resize-none border-none outline-none bg-transparent py-3 px-4 text-[15px] text-ink placeholder:text-ink-muted font-sans"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
      <div className="flex justify-end px-3 pb-3">
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="w-8 h-8 rounded-full bg-gold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          <ArrowUp className="w-4 h-4 text-white" />
        </button>
      </div>
    </motion.div>
  );
}
