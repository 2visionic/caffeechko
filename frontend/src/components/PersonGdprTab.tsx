import { File, Calendar, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { GdprDocumentDto } from '../api';
import { formatDateCzech } from '../types/attendance';
import { GdprStatusBadge, sanitizeGdprHtml } from './GdprConsentModal';

interface PersonGdprTabProps {
  validDocuments: GdprDocumentDto[];
  isLoading?: boolean;
  onExportPdfClick?: (doc: GdprDocumentDto) => void;
}

function formatDateTimeCzech(isoStr?: string | null): string {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function PersonGdprTab({
  validDocuments,
  isLoading = false,
  onExportPdfClick
}: PersonGdprTabProps) {
  if (isLoading && validDocuments.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
        Načítám historii GDPR souhlasů...
      </div>
    );
  }

  if (validDocuments.length === 0) {
    return (
      <div className="py-8 px-4 rounded-2xl bg-slate-100/60 dark:bg-zinc-800/40 text-center text-xs text-slate-400 dark:text-zinc-500">
        V systému zatím nejsou evidována žádná platná pravidla GDPR.
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {validDocuments.map((doc) => {
        const sends = doc.userSends || [];
        const latestSend = sends.length > 0 ? sends[0] : null;
        const docStatus =
          latestSend === null
            ? 'unfilled'
            : latestSend.isGranted
            ? 'granted'
            : 'revoked';

        return (
          <div
            key={doc.id}
            className="rounded-2xl bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-800 overflow-hidden"
          >
            {/* Hlavní řádek GDPR dokumentu */}
            <div className="p-4 flex items-center justify-between gap-3 bg-white/70 dark:bg-zinc-900/50">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>GDPR platné od {formatDateCzech(doc.validFrom)}</span>
                  </span>

                  {doc.isCurrentlyActive ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      Aktuální
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                      Minulé
                    </span>
                  )}

                  <GdprStatusBadge status={docStatus} />
                </div>

                <div
                  className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeGdprHtml(doc.content) }}
                />
              </div>

              {/* Akce: Červená ikona File bez pozadí s indikátorem PDF dole na středu */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onExportPdfClick?.(doc)}
                  title={`Stáhnout PDF záznam GDPR (platnost od ${formatDateCzech(doc.validFrom)})`}
                  className="p-1 bg-transparent hover:opacity-75 transition-opacity cursor-pointer relative inline-flex items-center justify-center"
                >
                  <File className="w-7 h-7 text-rose-600 dark:text-rose-400" strokeWidth={1.6} />
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-1 py-[1px] rounded-[2px] bg-rose-600 dark:bg-rose-500 text-white text-[7px] font-extrabold leading-none tracking-tighter">
                    PDF
                  </span>
                </button>
              </div>
            </div>

            {/* Subřádky: Všechny záznamy souhlasů a nesouhlasů této osoby od nejnovějšího */}
            <div className="divide-y divide-slate-200/60 dark:divide-zinc-800/80 border-t border-slate-200/70 dark:border-zinc-800">
              {sends.length === 0 ? (
                <div className="px-4 py-2.5 pl-8 flex items-center gap-2 text-xs text-slate-400 dark:text-zinc-500">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Dosud nevyplněno – žádný odeslaný záznam souhlasu ani nesouhlasu</span>
                </div>
              ) : (
                sends.map((s, idx) => (
                  <div
                    key={s.id}
                    className={`px-4 py-2.5 pl-8 flex flex-wrap items-center justify-between gap-2 text-xs ${
                      idx === 0
                        ? 'bg-slate-50/80 dark:bg-zinc-800/30 font-medium'
                        : 'opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {s.isGranted ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Souhlas udělen</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Nesouhlas (odmítnuto / odvoláno)</span>
                        </span>
                      )}
                      <span className="text-slate-400 dark:text-zinc-500">•</span>
                      <span className="text-slate-600 dark:text-zinc-300">{s.userEmail}</span>
                    </div>

                    <div className="text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                      {formatDateTimeCzech(s.sentAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
