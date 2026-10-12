import React, { type ReactNode, type ElementType } from 'react';
import { SectionHeader, type SectionHeaderProps } from './SectionHeader';

export interface BoxProps {
  /**
   * Surface elevation level according to M3:
   * - 1 (default): Main surface container card (bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-sm)
   * - 2: Sub-container inside card (bg-slate-50 dark:bg-zinc-800/40 rounded-2xl p-4)
   */
  level?: 1 | 2;
  /** Optional integrated section header */
  header?: SectionHeaderProps;
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

/**
 * Standard Surface Box container.
 * Enforces M3 design rules: no borders, pure white/zinc surface elevation, rounded-3xl.
 */
export const Box: React.FC<BoxProps> = ({
  level = 1,
  header,
  children,
  className = '',
  as: Component = 'section'
}) => {
  const levelClasses =
    level === 1
      ? 'bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-sm transition-colors space-y-6'
      : 'bg-slate-50 dark:bg-zinc-800/40 rounded-2xl p-4 transition-colors space-y-4';

  return (
    <Component className={`${levelClasses} ${className}`}>
      {header && <SectionHeader {...header} />}
      {children}
    </Component>
  );
};
