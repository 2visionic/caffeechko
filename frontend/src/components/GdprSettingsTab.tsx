import { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Plus,
  Edit3,
  Trash2,
  Lock,
  Check,
  Sparkles,
  Bold,
  Italic,
  Underline,
  CornerDownLeft,
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  api,
  DEFAULT_GDPR_HTML_CONTENT,
  getLocalTodayIso,
  type GdprDocumentDto
} from '../api';
import { formatDateCzech } from '../types/attendance';
import { sanitizeGdprHtml } from './GdprConsentModal';
import { Button, Modal } from './ui';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface GdprSettingsTabProps {
  onGdprChanged?: () => Promise<void> | void;
  addToast?: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export function GdprSettingsTab({ onGdprChanged, addToast }: GdprSettingsTabProps) {
  const [documents, setDocuments] = useState<GdprDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<GdprDocumentDto | null>(null);
  const [validFrom, setValidFrom] = useState(() => getLocalTodayIso());
  const [htmlContent, setHtmlContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [deletingDoc, setDeletingDoc] = useState<GdprDocumentDto | null>(null);
  const [expandedDocIds, setExpandedDocIds] = useState<Record<string, boolean>>({});
  const editorRef = useRef<HTMLDivElement>(null);

  const toggleDocExpanded = (doc: GdprDocumentDto) => {
    setExpandedDocIds((prev) => {
      const current = prev[doc.id] ?? Boolean(doc.isCurrentlyActive);
      return { ...prev, [doc.id]: !current };
    });
  };

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await api.getGdprDocuments();
      if (res?.data) {
        setDocuments(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  const openCreateModal = () => {
    setEditingDoc(null);
    setValidFrom(getLocalTodayIso());
    const initialText = documents.length === 0 ? DEFAULT_GDPR_HTML_CONTENT : '';
    setHtmlContent(initialText);
    setIsEditorOpen(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = initialText;
      }
    }, 0);
  };

  const openEditModal = (doc: GdprDocumentDto) => {
    if (doc.sendsCount > 0) return;
    setEditingDoc(doc);
    setValidFrom(doc.validFrom);
    setHtmlContent(doc.content);
    setIsEditorOpen(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = doc.content;
      }
    }, 0);
  };

  const applyFormatCommand = (command: 'bold' | 'italic' | 'underline' | 'insertLineBreak') => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    if (command === 'insertLineBreak') {
      document.execCommand('insertHTML', false, '<br>');
    } else {
      document.execCommand(command, false);
    }
    setHtmlContent(el.innerHTML);
  };

  const handleInsertRecommendedText = () => {
    setHtmlContent(DEFAULT_GDPR_HTML_CONTENT);
    if (editorRef.current) {
      editorRef.current.innerHTML = DEFAULT_GDPR_HTML_CONTENT;
      editorRef.current.focus();
    }
  };

  const handleSave = async () => {
    const currentHtml = (editorRef.current ? editorRef.current.innerHTML : htmlContent).trim();
    const plainText = currentHtml.replace(/<[^>]+>/g, '').trim();

    if (!validFrom) {
      addToast?.('error', 'Chybí datum platnosti', 'Zadejte prosím datum „Platnost od“.');
      return;
    }
    if (!plainText) {
      addToast?.('error', 'Chybí text GDPR', 'Zadejte prosím text GDPR souhlasu.');
      return;
    }

    setIsSaving(true);
    try {
      const res = editingDoc
        ? await api.updateGdprDocument(editingDoc.id, {
            validFrom,
            content: currentHtml
          })
        : await api.createGdprDocument({
            validFrom,
            content: currentHtml
          });

      if (res?.error) {
        addToast?.('error', 'Nelze uložit GDPR', res.error.message || 'Chyba při ukládání GDPR.');
        return;
      }

      if (res?.data) {
        setDocuments(res.data);
      } else {
        await loadDocuments();
      }
      setIsEditorOpen(false);
      await onGdprChanged?.();
      addToast?.(
        'success',
        editingDoc ? 'Záznam GDPR upraven' : 'Nový záznam GDPR vytvořen',
        `Dokument GDPR s platností od ${formatDateCzech(validFrom)} byl uložen do databáze.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;
    const res = await api.deleteGdprDocument(deletingDoc.id);
    if (res?.error) {
      addToast?.('error', 'Nelze smazat GDPR', res.error.message || 'Záznam nelze smazat.');
      setDeletingDoc(null);
      return;
    }
    if (res?.data) {
      setDocuments(res.data);
    } else {
      await loadDocuments();
    }
    setDeletingDoc(null);
    await onGdprChanged?.();
    addToast?.('warning', 'Záznam GDPR smazán', 'Nepoužitý záznam GDPR byl odstraněn.');
  };

  const todayIso = getLocalTodayIso();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="filled"
          color="primary"
          size="normal"
          icon={Plus}
          onClick={openCreateModal}
          className="whitespace-nowrap flex-shrink-0"
        >
          Nové GDPR
        </Button>
      </div>

      {isLoading && documents.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
          Načítám záznamy GDPR...
        </div>
      ) : documents.length === 0 ? (
        <div className="py-8 px-4 rounded-2xl bg-slate-100/60 dark:bg-zinc-800/40 text-center space-y-3">
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            V databázi zatím není evidován žádný záznam GDPR.
          </div>
          <Button
            variant="filled"
            color="primary"
            size="normal"
            icon={Plus}
            onClick={openCreateModal}
          >
            Založit 1. záznam GDPR (s doporučeným textem)
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const isLocked = doc.sendsCount > 0;
            const isFuture = doc.validFrom > todayIso;
            const isExpanded = expandedDocIds[doc.id] ?? Boolean(doc.isCurrentlyActive);

            return (
              <div
                key={doc.id}
                className={`p-4 rounded-2xl transition-all border ${
                  doc.isCurrentlyActive
                    ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                    : 'bg-slate-100/60 dark:bg-zinc-800/40 border-slate-200/60 dark:border-zinc-800'
                }`}
              >
                <div
                  onClick={() => toggleDocExpanded(doc)}
                  className="flex flex-wrap items-start justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                      <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Platnost od: {formatDateCzech(doc.validFrom)}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-zinc-500 ml-1">
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            <span className="hidden sm:inline">Skrýt text</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span className="hidden sm:inline">Zobrazit text</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Chipy a informace pod Platnost od */}
                    <div className="flex flex-wrap items-center gap-2">
                      {doc.isCurrentlyActive ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          Aktuálně platné GDPR
                        </span>
                      ) : isFuture ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                          Budoucí platnost
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                          Historické
                        </span>
                      )}

                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        Odeslaných záznamů: {doc.sendsCount}
                      </span>

                      {isLocked && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                          <Lock className="w-3 h-3" />
                          <span>Uzamčeno</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="surface"
                      size="xs"
                      icon={Edit3}
                      disabled={isLocked}
                      title={
                        isLocked
                          ? 'Tento záznam již má odeslané souhlasy v tabulce GDPR_Sends a nelze jej upravovat. Založte nové GDPR.'
                          : 'Upravit záznam GDPR'
                      }
                      onClick={() => openEditModal(doc)}
                    >
                      Upravit
                    </Button>
                    <Button
                      variant="surface"
                      color="rose"
                      size="xs"
                      icon={Trash2}
                      disabled={isLocked}
                      title={
                        isLocked
                          ? 'Tento záznam již má odeslané souhlasy v tabulce GDPR_Sends a nelze jej smazat.'
                          : 'Smazat nepoužitý záznam GDPR'
                      }
                      onClick={() => {
                        if (!isLocked) setDeletingDoc(doc);
                      }}
                    >
                      Smazat
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div
                    className="mt-3 p-3.5 rounded-xl bg-white/80 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800/80 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeGdprHtml(doc.content) }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal pro vytvoření / úpravu GDPR */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingDoc ? 'Upravit záznam GDPR' : 'Nový záznam GDPR'}
        subtitle="Nastavte datum platnosti od a znění souhlasu se základním formátováním"
        icon={Shield}
        iconBgClass="bg-amber-500/15 text-amber-700 dark:text-amber-400"
        size="lg"
        footer={
          <div className="flex items-center gap-2 w-full">
            <Button
              variant="filled"
              color="primary"
              size="normal"
              icon={Check}
              width="full"
              disabled={isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? 'Ukládám...' : editingDoc ? 'Uložit změny GDPR' : 'Založit GDPR'}
            </Button>
            <Button
              variant="transparent"
              color="rose"
              size="normal"
              onClick={() => setIsEditorOpen(false)}
            >
              Zrušit
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5 font-mono">
              Platnost od
            </label>
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full sm:w-64 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
              Pravidlo vstoupí v platnost v den, kdy je aktuální datum rovno nebo větší než zvolené datum.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-mono">
                Text GDPR souhlasu
              </label>

              <Button
                variant="surface"
                size="xs"
                icon={Sparkles}
                onClick={handleInsertRecommendedText}
              >
                Vložit doporučený text
              </Button>
            </div>

            {/* Formátovací lišta: Bold, Italic, Underline, Odřádkování */}
            <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700/70">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatCommand('bold');
                }}
                title="Tučné (Bold)"
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Bold className="w-3.5 h-3.5" />
                <span>Tučné</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatCommand('italic');
                }}
                title="Kurzíva (Italic)"
                className="px-2.5 py-1.5 rounded-lg text-xs italic text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Italic className="w-3.5 h-3.5" />
                <span>Kurzíva</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatCommand('underline');
                }}
                title="Podtržené (Underline)"
                className="px-2.5 py-1.5 rounded-lg text-xs underline text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Underline className="w-3.5 h-3.5" />
                <span>Podtržené</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormatCommand('insertLineBreak');
                }}
                title="Nový řádek (<br>)"
                className="px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors flex items-center gap-1 cursor-pointer ml-auto"
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
                <span>Odřádkovat</span>
              </button>
            </div>

            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setHtmlContent((e.currentTarget as HTMLDivElement).innerHTML)}
              className="min-h-[220px] max-h-[380px] overflow-y-auto p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-sm text-slate-800 dark:text-zinc-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDeleteModal
        isOpen={Boolean(deletingDoc)}
        onClose={() => setDeletingDoc(null)}
        title="Smazat záznam GDPR"
        description={
          deletingDoc
            ? `GDPR s platností od ${formatDateCzech(deletingDoc.validFrom)}`
            : ''
        }
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
