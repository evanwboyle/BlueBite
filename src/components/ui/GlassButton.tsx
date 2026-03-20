import type { ReactNode, ButtonHTMLAttributes } from 'react';
import './GlassButton.css';

type ButtonVariant = 'default' | 'primary' | 'accent' | 'ghost';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: 'glass-btn',
  primary: 'glass-btn glass-btn--primary',
  accent: 'glass-btn glass-btn--accent',
  ghost: 'glass-btn glass-btn--ghost',
};

export function GlassButton({
  variant = 'default',
  children,
  className = '',
  ...rest
}: GlassButtonProps) {
  return (
    <button
      className={`${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
