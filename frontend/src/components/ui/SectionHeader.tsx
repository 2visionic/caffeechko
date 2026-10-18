import React, { type ComponentType, type ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { getColorClasses, type ColorKey } from '../../config/presenceConfig';
import { SECTIONS } from '../../config/sectionsConfig';

export interface SectionHeaderProps {
  icon?: ComponentType<LucideProps>;
  title: string;
  subtitle?: string;
  colorKey?: ColorKey;
  badge?: ReactNode;
  actions?: ReactNode;
  /** When true, actions are rendered on a separate full-width row below the title/subtitle */
  full?: boolean;
  className?: string;
}

/**
 * Unified SectionHeader component for all views and cards.
 * Ensures 100% consistent typography, icon sizing, and action alignment.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  colorKey,
  badge,
  actions,
  full = false,
  className = ''
}) => {
  const matchedSectionColor = Icon
    ? Object.values(SECTIONS).find((s) => s.icon === Icon)?.color
    : undefined;
  const colors = getColorClasses(colorKey ?? matchedSectionColor ?? 'amber');

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Icon + Title & Subtitle */}
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div
              className={`w-8 h-8 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0 shadow-xs`}
            >
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {title}
              </h3>
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions (only when not full) */}
        {!full && actions && (
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0 self-start sm:self-auto">
            {actions}
          </div>
        )}
      </div>

      {/* Full-width Actions row (when full is true) */}
      {full && actions && (
        <div className="w-full pt-0.5">
          {actions}
        </div>
      )}
    </div>
  );
};
