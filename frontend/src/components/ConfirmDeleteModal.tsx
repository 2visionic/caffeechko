import { Trash2 } from 'lucide-react';
import { Button, Modal } from './ui';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description: string;
  confirmText?: string;
  confirmColor?: 'rose' | 'amber' | 'emerald';
  icon?: any;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Smazání záznamu',
  description,
  confirmText = 'Smazat',
  confirmColor = 'rose',
  icon: IconComponent = Trash2
}: ConfirmDeleteModalProps) {
  const isEmerald = confirmColor === 'emerald';
  const iconBg = isEmerald
    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={description}
      icon={IconComponent}
      iconBgClass={iconBg}
      size="sm"
      footer={
        <>
          <Button
            variant="filled"
            color={confirmColor}
            size="normal"
            width="full"
            icon={IconComponent}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </Button>
          <Button
            variant="transparent"
            color={confirmColor}
            size="normal"
            width="full"
            onClick={onClose}
          >
            Zrušit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Sonarová animace */}
        <div className="relative w-32 h-32 mx-auto flex items-center justify-center my-2 select-none">
          {isEmerald ? (
            <>
              <span className="absolute w-16 h-16 rounded-full animate-sonar-1 pointer-events-none bg-emerald-500/25 dark:bg-emerald-400/20 border border-emerald-500/40 dark:border-emerald-400/35" />
              <span className="absolute w-16 h-16 rounded-full animate-sonar-2 pointer-events-none bg-emerald-500/20 dark:bg-emerald-400/15 border border-emerald-500/35 dark:border-emerald-400/30" />
              <span className="absolute w-16 h-16 rounded-full animate-sonar-3 pointer-events-none bg-emerald-500/15 dark:bg-emerald-400/10 border border-emerald-500/25 dark:border-emerald-400/20" />
              <div className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-500/30 dark:border-emerald-400/30 shadow-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <IconComponent className="w-10 h-10" />
              </div>
            </>
          ) : (
            <>
              <span className="absolute w-16 h-16 rounded-full animate-sonar-1 pointer-events-none bg-rose-500/25 dark:bg-rose-400/20 border border-rose-500/40 dark:border-rose-400/35" />
              <span className="absolute w-16 h-16 rounded-full animate-sonar-2 pointer-events-none bg-rose-500/20 dark:bg-rose-400/15 border border-rose-500/35 dark:border-rose-400/30" />
              <span className="absolute w-16 h-16 rounded-full animate-sonar-3 pointer-events-none bg-rose-500/15 dark:bg-rose-400/10 border border-rose-500/25 dark:border-rose-400/20" />
              <div className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-500/30 dark:border-rose-400/30 shadow-rose-500/15 text-rose-600 dark:text-rose-400">
                <IconComponent className="w-10 h-10" />
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
