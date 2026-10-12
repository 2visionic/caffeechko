import { useState } from 'react';
import { getStatusConfig } from '../../config/presenceConfig';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface UserAvatarProps {
  /** Full name of the user for initials calculation */
  name?: string | null;
  /** Optional profile photo URL */
  photoUrl?: string | null;
  /** Size scale */
  size?: AvatarSize;
  /** Whether this avatar represents the currently active persona (applies subtle gold highlight) */
  isCurrent?: boolean;
  /** Whether the user is currently clocked in / online */
  isOnline?: boolean;
  /** Presence or absence type to color the status dot (office, home_office, etc.) */
  statusType?: string | null;
  /** Explicit dot class override */
  dotClass?: string;
  /** Whether to show status dot */
  showDot?: boolean;
  /** Extra container className */
  className?: string;
}

export function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_CONTAINER_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-14 h-14 text-base'
};

const DOT_SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4'
};

export function UserAvatar({
  name,
  photoUrl,
  size = 'md',
  isCurrent = false,
  isOnline,
  statusType,
  dotClass,
  showDot = false,
  className = ''
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(name);

  const containerSize = SIZE_CONTAINER_CLASSES[size] || SIZE_CONTAINER_CLASSES.md;
  const dotSize = DOT_SIZE_CLASSES[size] || DOT_SIZE_CLASSES.md;

  // Determine background and text colors
  const colorClasses = isCurrent
    ? 'bg-gradient-to-tr from-amber-500/20 to-amber-600/30 dark:from-amber-500/30 dark:to-amber-600/20 text-amber-900 dark:text-amber-300 font-bold shadow-sm'
    : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold';

  // Determine status dot color
  let activeDotClass = dotClass;
  if (!activeDotClass) {
    if (statusType) {
      activeDotClass = getStatusConfig(statusType).dotClass;
    } else if (isOnline !== undefined) {
      activeDotClass = isOnline ? 'bg-emerald-500' : 'bg-slate-400';
    }
  }

  const shouldRenderDot = showDot || statusType !== undefined || isOnline !== undefined || !!dotClass;

  return (
    <div className={`relative flex-shrink-0 select-none ${className}`}>
      <div
        className={`${containerSize} rounded-full flex items-center justify-center overflow-hidden ${colorClasses}`}
        title={name || 'Uživatel'}
      >
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={name || 'Uživatel'}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {shouldRenderDot && activeDotClass && (
        <span
          className={`absolute bottom-0 right-0 ${dotSize} rounded-full ring-2 ring-white dark:ring-zinc-900 ${activeDotClass}`}
        />
      )}
    </div>
  );
}
