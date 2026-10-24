import { Shield, Check, X } from 'lucide-react';
import { Modal, Button } from './ui';
import { formatDateCzech } from '../types/attendance';

export type GdprConsentStatus = 'granted' | 'revoked' | 'unfilled';

export function sanitizeGdprHtml(raw?: string | null): string {
  if (!raw) return '';
  // Povolíme pouze základní formátovací značky: b, strong, i, em, u, br, p, div, ul, ol, li, span
  let html = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');

  // Pokud text neobsahuje žádné HTML tagy pro odřádkování, převedeme \n na <br>
  if (!/<(br|p|div)\b/i.test(html)) {
    html = html.replace(/\r?\n/g, '<br>');
  }
  return html;
}

export function GdprStatusBadge({
  status = 'unfilled',
  variant = 'full'
}: {
  status?: GdprConsentStatus | string;
  variant?: 'full' | 'mini';
}) {
  const normalized: GdprConsentStatus =
    status === 'granted' ? 'granted' : status === 'revoked' ? 'revoked' : 'unfilled';

  if (variant === 'mini') {
    if (normalized === 'granted') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
          souhlas
        </span>
      );
    }
    if (normalized === 'revoked') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
          nesouhlas
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
        nevyplněno
      </span>
    );
  }

  if (normalized === 'granted') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span>GDPR souhlas</span>
      </span>
    );
  }

  if (normalized === 'revoked') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        <span>GDPR nesouhlas</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-200/80 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-300/60 dark:border-zinc-700">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500" />
      <span>GDPR nevyplněno</span>
    </span>
  );
}

interface GdprConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  validFrom?: string | null;
  content?: string | null;
  currentStatus?: GdprConsentStatus | string;
  isSubmitting?: boolean;
  onChoose: (isGranted: boolean) => Promise<void> | void;
}

export function GdprConsentModal({
  isOpen,
  onClose,
  validFrom,
  content,
  currentStatus = 'unfilled',
  isSubmitting = false,
  onChoose
}: GdprConsentModalProps) {
  const handleSelect = async (isGranted: boolean) => {
    // Pokud vybere stejnou volbu v jaké nyní GDPR je, nic neaktualizujeme a modal jen zavřeme
    if (
      (currentStatus === 'granted' && isGranted) ||
      (currentStatus === 'revoked' && !isGranted)
    ) {
      onClose();
      return;
    }
    await onChoose(isGranted);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Souhlas se zpracováním osobních údajů (GDPR)"
      subtitle={validFrom ? `Platnost dokumentu od ${formatDateCzech(validFrom)}` : 'Aktuální znění GDPR'}
      icon={Shield}
      iconBgClass="bg-amber-500/15 text-amber-700 dark:text-amber-400"
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
          <Button
            variant="filled"
            color="emerald"
            size="normal"
            icon={Check}
            width="full"
            disabled={isSubmitting}
            onClick={() => void handleSelect(true)}
          >
            Souhlasím
          </Button>
          <Button
            variant="filled"
            color="rose"
            size="normal"
            icon={X}
            width="full"
            disabled={isSubmitting}
            onClick={() => void handleSelect(false)}
          >
            Nesouhlasím
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-zinc-800/60 text-xs">
          <span className="text-slate-500 dark:text-zinc-400 font-medium">
            Dosavadní stav vašeho souhlasu:
          </span>
          <GdprStatusBadge status={currentStatus} />
        </div>

        <div
          className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/70 dark:border-zinc-800 text-sm text-slate-700 dark:text-zinc-200 leading-relaxed max-h-[55vh] overflow-y-auto"
          dangerouslySetInnerHTML={{
            __html: sanitizeGdprHtml(content) || '<i>Text dokumentu GDPR není k dispozici.</i>'
          }}
        />
      </div>
    </Modal>
  );
}
