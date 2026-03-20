import type { ReactNode, CSSProperties, HTMLAttributes } from 'react';

type GlassLevel = 'modal' | 'card' | 'surface';

const GLASS_LEVELS: Record<GlassLevel, {
  background: string;
  border: string;
  shadow: string;
  radius: string;
  padding: string;
}> = {
  modal: {
    background: 'var(--glass-mist)',
    border: 'var(--border-glass-bright)',
    shadow: 'var(--shadow-glass-heavy)',
    radius: 'var(--radius-modal)',
    padding: 'var(--padding-modal)',
  },
  card: {
    background: 'var(--glass-breath)',
    border: 'var(--border-glass)',
    shadow: 'var(--shadow-glass)',
    radius: 'var(--radius-card)',
    padding: 'var(--padding-card)',
  },
  surface: {
    background: 'var(--glass-whisper)',
    border: 'var(--border-glass)',
    shadow: 'none',
    radius: 'var(--radius-card)',
    padding: 'var(--padding-card)',
  },
};

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  level?: GlassLevel;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: 'div' | 'section';
}

export function GlassPanel({
  level = 'card',
  children,
  className = '',
  style,
  as: Tag = 'div',
  ...rest
}: GlassPanelProps) {
  const t = GLASS_LEVELS[level];
  return (
    <Tag
      className={className}
      style={{
        background: t.background,
        border: t.border,
        borderRadius: t.radius,
        boxShadow: t.shadow,
        padding: t.padding,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
