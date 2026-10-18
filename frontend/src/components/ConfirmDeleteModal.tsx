import { Trash2 } from 'lucide-react';
import { Button, Modal } from './ui';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description: string;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Smazání záznamu',
  description
}: ConfirmDeleteModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={description}
      icon={Trash2}
      iconBgClass="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
      size="sm"
      footer={
        <div className="w-full flex justify-center">
          <Button
            variant="ghost"
            colorKey="rose"
            size="sm"
            onClick={onClose}
            fullWidth
            className="py-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
          >
            Zrušit
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Sonarová animace v červené barvě s ikonou koše */}
        <div className="relative w-32 h-32 mx-auto flex items-center justify-center mt-2 mb-8 select-none">
          <span className="absolute w-16 h-16 rounded-full animate-sonar-1 pointer-events-none bg-rose-500/25 dark:bg-rose-400/20 border border-rose-500/40 dark:border-rose-400/35" />
          <span className="absolute w-16 h-16 rounded-full animate-sonar-2 pointer-events-none bg-rose-500/20 dark:bg-rose-400/15 border border-rose-500/35 dark:border-rose-400/30" />
          <span className="absolute w-16 h-16 rounded-full animate-sonar-3 pointer-events-none bg-rose-500/15 dark:bg-rose-400/10 border border-rose-500/25 dark:border-rose-400/20" />
          <div className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-500/30 dark:border-rose-400/30 shadow-rose-500/15 text-rose-600 dark:text-rose-400">
            <Trash2 className="w-10 h-10" />
          </div>
        </div>

        {/* Tlačítka Ano / Ne uprostřed pod sonarem */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="surface"
            size="md"
            onClick={onClose}
            className="min-w-[96px] justify-center"
          >
            Ne
          </Button>
          <Button
            variant="filled"
            colorKey="rose"
            size="md"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="min-w-[96px] justify-center"
          >
            Ano
          </Button>
        </div>
      </div>
    </Modal>
  );
}
