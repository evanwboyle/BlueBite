interface GlassDividerProps {
  className?: string;
}

export function GlassDivider({ className = '' }: GlassDividerProps) {
  return (
    <div
      className={className}
      style={{
        height: '1px',
        width: '100%',
        background: 'var(--border-color-default)',
      }}
    />
  );
}
