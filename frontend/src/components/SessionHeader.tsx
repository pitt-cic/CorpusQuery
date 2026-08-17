interface Props {
  title: string | null;
  question: string | null;
  isLoading?: boolean;
}

export default function SessionHeader({ title, question, isLoading }: Props) {
  const displayText = title ?? question;
  const tooltip = title ?? (question ? question.slice(0, 50) : undefined);

  return (
    <header className="py-4 px-8 border-b border-border">
      {displayText ? (
        <h1 className="text-lg font-medium text-ink truncate" title={tooltip}>
          {displayText}
        </h1>
      ) : isLoading ? (
        <div className="h-6 w-64 bg-gradient-to-r from-border via-paper-warm to-border animate-shimmer rounded" />
      ) : (
        <h1 className="text-lg font-medium text-ink truncate">Untitled session</h1>
      )}
    </header>
  );
}
