import type { ReactNode, CSSProperties, ElementType } from 'react';

type TextVariant =
  | 'brand'      // Yeseva One, 30px, tight tracking
  | 'heading'    // Yeseva One, 36px
  | 'title'      // DM Sans, 20px, semibold
  | 'body'       // DM Sans, 16px, regular
  | 'label'      // DM Sans, 14px, muted
  | 'whisper';   // DM Sans, 10px, uppercase tracking

const VARIANT_STYLES: Record<TextVariant, CSSProperties> = {
  brand: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.875rem',
    letterSpacing: '-0.025em',
    color: 'var(--text-primary)',
    lineHeight: 1.2,
  },
  heading: {
    fontFamily: 'var(--font-heading)',
    fontSize: '2.25rem',
    color: 'var(--text-primary)',
    lineHeight: 1.2,
  },
  title: {
    fontFamily: 'var(--font-body)',
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  body: {
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    color: 'var(--text-body)',
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
  },
  whisper: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.625rem',
    fontWeight: 400,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--text-whisper)',
  },
};

const DEFAULT_TAG: Record<TextVariant, ElementType> = {
  brand: 'h1',
  heading: 'h2',
  title: 'h3',
  body: 'p',
  label: 'p',
  whisper: 'span',
};

interface TextProps {
  variant?: TextVariant;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
}

export function Text({
  variant = 'body',
  children,
  className = '',
  style,
  as,
}: TextProps) {
  const Tag = as ?? DEFAULT_TAG[variant];
  return (
    <Tag
      className={className}
      style={{ ...VARIANT_STYLES[variant], ...style }}
    >
      {children}
    </Tag>
  );
}
