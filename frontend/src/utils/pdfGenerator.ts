import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { zipSync } from 'fflate';
import type { Column, Content, TDocumentDefinitions, TableCell, CustomTableLayout } from 'pdfmake/interfaces';
import {
  api,
  type GdprDocumentDto,
  type PersonMonthlyClosureItemDto,
  type TimeEntryDetailDto
} from '../api';
import {
  formatDateCzech,
  formatHoursMinutes,
  formatOvertime,
  formatContractLabel
} from '../types/attendance';

// Inicializace virtuálního souborového systému s fontem Roboto (plná podpora české diakritiky)
const vfsData = (pdfFonts as any)?.pdfMake?.vfs || (pdfFonts as any)?.vfs || pdfFonts;
if (typeof (pdfMake as any).addVirtualFileSystem === 'function' && vfsData) {
  (pdfMake as any).addVirtualFileSystem(vfsData);
} else if (vfsData) {
  (pdfMake as any).vfs = vfsData;
}

const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

const DAY_NAMES_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

let cachedLogoFullSvg: string | null = null;
let cachedLogoIconSvg: string | null = null;

async function loadSvgText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Nelze načíst vektorové logo ${url}`);
  }
  return response.text();
}

async function ensurePdfLogosLoaded(): Promise<{ logoFullSvg: string; logoIconSvg: string }> {
  if (!cachedLogoFullSvg) {
    cachedLogoFullSvg = await loadSvgText('/caffeechko-logo.svg');
  }
  if (!cachedLogoIconSvg) {
    cachedLogoIconSvg = await loadSvgText('/caffeechko-icon.svg');
  }
  return {
    logoFullSvg: cachedLogoFullSvg,
    logoIconSvg: cachedLogoIconSvg
  };
}

export function getActiveCompanyName(overrideName?: string): string {
  if (overrideName && overrideName.trim()) return overrideName.trim();
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('caffeechko_dev_config');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.companyName && typeof parsed.companyName === 'string') {
          return parsed.companyName.trim();
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  return 'Firma s.r.o.';
}

function sanitizeFileNamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toLowerSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getMonthFolderSlug(month: number, year: number): string {
  const monthLabel = MONTH_NAMES[month - 1] || `mesic_${month}`;
  return `${toLowerSlug(monthLabel)}_${year}`;
}

function formatDateTimeCz(isoStr?: string | null): string {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('cs-CZ', {
    timeZone: 'Europe/Prague',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatNowCz(): string {
  return new Date().toLocaleString('cs-CZ', {
    timeZone: 'Europe/Prague',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ============================================================================
// VEKTOROVÉ IKONY PRO KOMPLETNÍ IKONOVÝ PŘEHLED A SUB-ŘÁDKY V PDF
// ============================================================================

export type PdfIconKey =
  | 'calendar'
  | 'trending'
  | 'layers'
  | 'sparkles'
  | 'building'
  | 'alert'
  | 'home'
  | 'palmtree'
  | 'thermometer'
  | 'pill'
  | 'baby'
  | 'stethoscope'
  | 'calendar_x'
  | 'clock'
  | 'shield'
  | 'user';

export type PdfAccentKey =
  | 'emerald'
  | 'sky'
  | 'indigo'
  | 'amber'
  | 'rose'
  | 'red'
  | 'orange'
  | 'purple'
  | 'teal'
  | 'slate';

const PDF_ACCENT_PALETTE: Record<PdfAccentKey, { bg: string; fg: string; border: string }> = {
  emerald: { bg: '#ecfdf5', fg: '#059669', border: '#a7f3d0' },
  sky: { bg: '#f0f9ff', fg: '#0284c7', border: '#bae6fd' },
  indigo: { bg: '#eef2ff', fg: '#4f46e5', border: '#c7d2fe' },
  amber: { bg: '#fffbeb', fg: '#d97706', border: '#fde68a' },
  rose: { bg: '#fff1f2', fg: '#e11d48', border: '#fecdd3' },
  red: { bg: '#fef2f2', fg: '#dc2626', border: '#fecaca' },
  orange: { bg: '#fff7ed', fg: '#ea580c', border: '#fed7aa' },
  purple: { bg: '#faf5ff', fg: '#9333ea', border: '#e9d5ff' },
  teal: { bg: '#f0fdfa', fg: '#0d9488', border: '#99f6e4' },
  slate: { bg: '#f1f5f9', fg: '#475569', border: '#cbd5e1' }
};

function getIconInnerSvgPaths(icon: PdfIconKey, stroke: string): string {
  const attrs = `fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  switch (icon) {
    case 'calendar':
      return `<g ${attrs}><rect x="3" y="4" width="18" height="18" rx="2" fill="none"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></g>`;
    case 'trending':
      return `<g ${attrs}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" fill="none"/><polyline points="16 7 22 7 22 13" fill="none"/></g>`;
    case 'layers':
      return `<g ${attrs}><polygon points="12 2 2 7 12 12 22 7 12 2" fill="none"/><polyline points="2 17 12 22 22 17" fill="none"/><polyline points="2 12 12 17 22 12" fill="none"/></g>`;
    case 'sparkles':
      return `<g ${attrs}><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" fill="none"/></g>`;
    case 'building':
      return `<g ${attrs}><rect x="4" y="2" width="16" height="20" rx="2" fill="none"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/></g>`;
    case 'alert':
      return `<g ${attrs}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="none"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="1" fill="${stroke}" stroke="none"/></g>`;
    case 'home':
      return `<g ${attrs}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none"/><polyline points="9 22 9 12 15 12 15 22" fill="none"/></g>`;
    case 'palmtree':
      return `<g ${attrs}><path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4" fill="none"/><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3" fill="none"/><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35z" fill="none"/><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14" fill="none"/></g>`;
    case 'thermometer':
      return `<g ${attrs}><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" fill="none"/></g>`;
    case 'pill':
      return `<g ${attrs}><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" fill="none"/><path d="m8.5 8.5 7 7" fill="none"/></g>`;
    case 'baby':
      return `<g ${attrs}><circle cx="12" cy="12" r="9" fill="none"/><circle cx="9" cy="10" r="1" fill="${stroke}" stroke="none"/><circle cx="15" cy="10" r="1" fill="${stroke}" stroke="none"/><path d="M9.5 15a3.5 3.5 0 0 0 5 0" fill="none"/><path d="M12 3c-1.5 2-1.5 4 0 5" fill="none"/></g>`;
    case 'stethoscope':
      return `<g ${attrs}><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" fill="none"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" fill="none"/><circle cx="20" cy="10" r="2" fill="none"/></g>`;
    case 'calendar_x':
      return `<g ${attrs}><rect x="3" y="4" width="18" height="18" rx="2" fill="none"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="10" y1="14" x2="14" y2="18"/><line x1="14" y1="14" x2="10" y2="18"/></g>`;
    case 'clock':
      return `<g ${attrs}><circle cx="12" cy="12" r="9" fill="none"/><polyline points="12 7 12 12 15 15" fill="none"/></g>`;
    case 'shield':
      return `<g ${attrs}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none"/></g>`;
    case 'user':
    default:
      return `<g ${attrs}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none"/><circle cx="12" cy="7" r="4" fill="none"/></g>`;
  }
}

function buildCircularIconBadgeSvg(icon: PdfIconKey, accent: PdfAccentKey): string {
  const pal = PDF_ACCENT_PALETTE[accent] || PDF_ACCENT_PALETTE.amber;
  const inner = getIconInnerSvgPaths(icon, pal.fg);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="28" height="28">
    <circle cx="20" cy="20" r="19" fill="${pal.bg}" />
    <g transform="translate(8, 8)">${inner}</g>
  </svg>`;
}

/**
 * Jemná L-šipka (↳) s barevnou tečkou pro indikaci podřádku
 */
function buildSubRowBranchSvg(accent: PdfAccentKey): string {
  const pal = PDF_ACCENT_PALETTE[accent] || PDF_ACCENT_PALETTE.slate;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 12" width="16" height="9">
    <path d="M3 1 V7.5 H11 M8.5 5.2 L11.5 7.5 L8.5 9.8" fill="none" stroke="#cbd5e1" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="17" cy="7.5" r="2.6" fill="${pal.fg}" />
  </svg>`;
}

export interface PdfSummaryItem {
  icon: PdfIconKey;
  accent: PdfAccentKey;
  label: string;
  value: string;
  total?: string;
  unit?: string;
  valueColor?: string;
}

/**
 * Vykreslí statistiky úplně totožně jako na Přehledu (komponenta StatPill, layout="vertical"):
 * - Nahoře: kulatá ikona s pastelovým pozadím (vycentrovaná)
 * - Uprostřed: hodnota + "/total" + jednotka na jednom řádku (vycentrovaná)
 * - Dole: popisek malým šedým písmem (vycentrovaný)
 * - Žádné rámečky ani šedé obdélníky kolem jednotlivých statistik!
 */
function buildCompleteIconSummaryGrid(items: PdfSummaryItem[], maxColsPerRow = 6): Content {
  const rows: Content[] = [];
  const colsPerRow = Math.min(maxColsPerRow, Math.max(1, items.length));

  for (let i = 0; i < items.length; i += colsPerRow) {
    const chunk = items.slice(i, i + colsPerRow);
    const pillCols: Column[] = chunk.map((item) => {
      const valueRuns: any[] = [
        {
          text: item.value,
          fontSize: 10,
          bold: true,
          color: item.valueColor || '#0f172a'
        }
      ];
      if (item.total !== undefined) {
        valueRuns.push({
          text: `/${item.total}`,
          fontSize: 8.5,
          bold: false,
          color: '#94a3b8'
        });
      }
      if (item.unit) {
        valueRuns.push({
          text: ` ${item.unit}`,
          fontSize: 8,
          bold: false,
          color: '#94a3b8'
        });
      }

      return {
        width: '*',
        stack: [
          {
            svg: buildCircularIconBadgeSvg(item.icon, item.accent),
            width: 28,
            height: 28,
            alignment: 'center',
            margin: [0, 0, 0, 4]
          },
          {
            text: valueRuns,
            alignment: 'center',
            noWrap: true,
            margin: [0, 0, 0, 2]
          },
          {
            text: item.label,
            fontSize: 7.5,
            color: '#64748b',
            alignment: 'center',
            noWrap: true
          }
        ]
      };
    });

    rows.push({
      columns: pillCols,
      columnGap: 6,
      margin: [0, 4, 0, 6]
    });
  }

  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: rows,
            margin: [6, 8, 6, 4]
          }
        ]
      ]
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0.6 : 0),
      vLineWidth: () => 0,
      hLineColor: () => '#f1f5f9',
      fillColor: () => '#ffffff',
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0
    },
    margin: [0, 2, 0, 12]
  };
}

/**
 * Dynamický layout tabulky s podporou vnořených podřádků (sub-rows):
 * - Mezi hlavním řádkem a jeho podřádky není dělící čára (tvoří jeden vizuální celek se stejným pozadím).
 * - Podřádky mají menší vertikální padding, aby těsně přiléhaly ke svému hlavnímu řádku.
 */
function createGroupedTableLayout(
  rowGroupIndices: number[],
  isSubRowFlags: boolean[]
): CustomTableLayout {
  return {
    hLineWidth: (i, node) => {
      if (i === 0) return 0;
      if (i === 1) return 1.1;
      if (i === node.table.body.length) return 0.9;
      // Pokud je následující řádek podřádkem aktuálního řádku, nekreslíme čáru mezi nimi!
      if (isSubRowFlags[i]) return 0;
      return 0.5;
    },
    vLineWidth: () => 0,
    hLineColor: (i) => (i === 1 ? '#cbd5e1' : '#e2e8f0'),
    fillColor: (rowIndex) => {
      if (rowIndex === 0) return '#f1f5f9';
      const grp = rowGroupIndices[rowIndex] ?? rowIndex;
      return grp % 2 === 1 ? '#ffffff' : '#f8fafc';
    },
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: (i) => {
      if (i === 0) return 6.5;
      return isSubRowFlags[i] ? 1.5 : 5.5;
    },
    paddingBottom: (i, node) => {
      if (i === 0) return 6.5;
      const nextIsSub = i + 1 < node.table.body.length && isSubRowFlags[i + 1];
      if (nextIsSub) return 2;
      return isSubRowFlags[i] ? 5 : 5.5;
    }
  };
}

const CARD_TABLE_LAYOUT: CustomTableLayout = {
  hLineWidth: () => 0.75,
  vLineWidth: () => 0.75,
  hLineColor: () => '#e2e8f0',
  vLineColor: () => '#e2e8f0',
  fillColor: () => '#f8fafc',
  paddingLeft: () => 10,
  paddingRight: () => 10,
  paddingTop: () => 8,
  paddingBottom: () => 8
};

/**
 * Sestaví kompletní TDocumentDefinitions s jednotnou hlavičkou a patičkou:
 * 1) Větší odsazení od horního a spodního okraje stránky
 * 2) Ostrá vektorová loga (SVG) bez bitmapového rozostření
 * 3) Bez dělících čar (dividerů) v hlavičce a patičce, s odsazeným obsahem
 */
async function createBaseDocumentDefinition(
  content: Content[],
  companyName?: string
): Promise<TDocumentDefinitions> {
  const logos = await ensurePdfLogosLoaded();
  const resolvedCompany = getActiveCompanyName(companyName);

  return {
    pageSize: 'A4',
    // [left, top, right, bottom] – zvětšené horní (102 pt) a spodní (90 pt) odsazení obsahu
    pageMargins: [44, 102, 44, 90],
    header: () => ({
      // Odsazeno 36 pt od horní hrany papíru, bez dělící čáry, s 46 pt mezerou nad obsahem
      margin: [44, 36, 44, 0],
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            {
              svg: logos.logoFullSvg,
              width: 110,
              height: 19.5,
              alignment: 'left'
            },
            {
              text: resolvedCompany,
              fontSize: 10.5,
              bold: true,
              color: '#0f172a',
              alignment: 'right',
              margin: [0, 4, 0, 0]
            }
          ]
        ]
      },
      layout: 'noBorders'
    }),
    footer: (currentPage: number, pageCount: number) => ({
      // Odsazeno s dostatečnou rezervou nad spodní hranou papíru, bez dělící čáry
      margin: [44, 24, 44, 0],
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            {
              svg: logos.logoIconSvg,
              width: 20,
              height: 15.6,
              alignment: 'left'
            },
            {
              text: `Strana ${currentPage} z ${pageCount}`,
              fontSize: 8.5,
              bold: true,
              color: '#64748b',
              alignment: 'right',
              margin: [0, 3, 0, 0]
            }
          ]
        ]
      },
      layout: 'noBorders'
    }),
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      color: '#1e293b',
      lineHeight: 1.25
    },
    styles: {
      docCategory: {
        fontSize: 8,
        bold: true,
        color: '#d97706',
        characterSpacing: 0.8
      },
      docTitle: {
        fontSize: 18,
        bold: true,
        color: '#0f172a'
      },
      docSubtitle: {
        fontSize: 9,
        color: '#64748b'
      },
      sectionTitle: {
        fontSize: 10.5,
        bold: true,
        color: '#0f172a',
        margin: [0, 14, 0, 6]
      },
      tableHeader: {
        fontSize: 7.5,
        bold: true,
        color: '#475569'
      }
    },
    content
  };
}

function mapStatusTypeToAccent(typeCode?: string): PdfAccentKey {
  switch (typeCode) {
    case 'office':
      return 'emerald';
    case 'home_office':
    case 'remote':
      return 'sky';
    case 'vacation':
    case 'holiday':
      return 'amber';
    case 'sick_day':
      return 'rose';
    case 'illness':
      return 'red';
    case 'ocr':
      return 'orange';
    case 'doctor':
      return 'indigo';
    case 'unpaid_leave':
      return 'purple';
    case 'compensatory_leave':
      return 'teal';
    default:
      return 'slate';
  }
}

function buildSignatureBlock(leftLabel: string, rightLabel: string, statusNote: string): Content {
  return {
    unbreakable: true,
    margin: [0, 22, 0, 0],
    stack: [
      {
        columns: [
          {
            width: '*',
            text: statusNote,
            fontSize: 8,
            color: '#64748b'
          },
          {
            width: 'auto',
            text: `Vygenerováno: ${formatNowCz()}`,
            fontSize: 8,
            color: '#64748b',
            alignment: 'right'
          }
        ],
        margin: [0, 0, 0, 26]
      },
      {
        columns: [
          {
            width: '44%',
            stack: [
              {
                canvas: [
                  {
                    type: 'line',
                    x1: 0,
                    y1: 0,
                    x2: 205,
                    y2: 0,
                    lineWidth: 0.75,
                    lineColor: '#94a3b8'
                  }
                ]
              },
              {
                text: leftLabel,
                fontSize: 8,
                color: '#475569',
                alignment: 'center',
                margin: [0, 5, 0, 0]
              }
            ]
          },
          { width: '12%', text: '' },
          {
            width: '44%',
            stack: [
              {
                canvas: [
                  {
                    type: 'line',
                    x1: 0,
                    y1: 0,
                    x2: 205,
                    y2: 0,
                    lineWidth: 0.75,
                    lineColor: '#94a3b8'
                  }
                ]
              },
              {
                text: rightLabel,
                fontSize: 8,
                color: '#475569',
                alignment: 'center',
                margin: [0, 5, 0, 0]
              }
            ]
          }
        ]
      }
    ]
  };
}

// ============================================================================
// 1. MĚSÍČNÍ VÝKAZ DOCHÁZKY (MyTimesheetView)
// ============================================================================

export interface TimesheetPdfSubLogItem {
  type: string;
  label: string;
  timeRange?: string;
  hours: number;
  isAbsence?: boolean;
  note?: string;
}

export interface TimesheetPdfDayRow {
  dateStr: string;
  dayShort: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  firstCheckIn: string;
  lastCheckOut: string;
  recognizedHours: number;
  segmentsSummary: string;
  subLogs?: TimesheetPdfSubLogItem[];
}

export interface TimesheetPdfData {
  employeeName: string;
  employeeEmail?: string;
  roleLabel?: string;
  contractLabel: string;
  dailyTargetHours: number;
  year: number;
  month: number;
  workedHours: number;
  fundHours: number;
  overtimeHours: number;
  carriedOverSaldoHours?: number;
  holidaysCount?: number;
  vacationDays: number;
  sickDays: number;
  illnessDays: number;
  ocrDays: number;
  doctorHours: number;
  homeOfficeDays: number;
  unpaidLeaveDays?: number;
  compensatoryLeaveDays?: number;
  days: TimesheetPdfDayRow[];
  companyName?: string;
}

export async function generateTimesheetPdfBlob(data: TimesheetPdfData): Promise<Blob> {
  const monthName = MONTH_NAMES[data.month - 1] || `${data.month}. měsíc`;
  const overtimeColor =
    data.overtimeHours > 0 ? '#059669' : data.overtimeHours < 0 ? '#e11d48' : '#0f172a';

  // Kompletní 12položkový ikonový přehled měsíce
  const summaryItems: PdfSummaryItem[] = [
    {
      icon: 'calendar',
      accent: 'emerald',
      label: 'Odpracováno',
      value: `${Math.round(data.workedHours * 10) / 10}`,
      total: `${Math.round(data.fundHours * 10) / 10}`,
      unit: 'h'
    },
    {
      icon: 'trending',
      accent: data.overtimeHours < 0 ? 'rose' : 'sky',
      label: 'Přesčas',
      value: formatOvertime(data.overtimeHours),
      valueColor: overtimeColor
    },
    {
      icon: 'layers',
      accent: 'indigo',
      label: 'FlexiTime',
      value: formatOvertime(data.carriedOverSaldoHours ?? data.overtimeHours),
      valueColor: '#4f46e5'
    },
    {
      icon: 'sparkles',
      accent: 'amber',
      label: 'Svátky',
      value: `${data.holidaysCount ?? 0}`,
      unit: 'd'
    },
    {
      icon: 'home',
      accent: 'sky',
      label: 'Home Office',
      value: `${data.homeOfficeDays}`,
      unit: 'd'
    },
    {
      icon: 'palmtree',
      accent: 'amber',
      label: 'Dovolená',
      value: `${data.vacationDays}`,
      unit: 'd'
    },
    {
      icon: 'thermometer',
      accent: 'rose',
      label: 'Sick day',
      value: `${data.sickDays}`,
      unit: 'd'
    },
    {
      icon: 'pill',
      accent: 'red',
      label: 'Nemoc',
      value: `${data.illnessDays}`,
      unit: 'd'
    },
    {
      icon: 'baby',
      accent: 'orange',
      label: 'OČR',
      value: `${data.ocrDays}`,
      unit: 'd'
    },
    {
      icon: 'stethoscope',
      accent: 'indigo',
      label: 'Lékař',
      value: formatHoursMinutes(data.doctorHours)
    },
    {
      icon: 'calendar_x',
      accent: 'purple',
      label: 'Neplacené volno',
      value: `${data.unpaidLeaveDays ?? 0}`,
      unit: 'd'
    },
    {
      icon: 'clock',
      accent: 'teal',
      label: 'Náhradní volno',
      value: `${data.compensatoryLeaveDays ?? 0}`,
      unit: 'd'
    }
  ];

  const tableBody: TableCell[][] = [
    [
      { text: 'DATUM', style: 'tableHeader', alignment: 'left' },
      { text: 'DEN', style: 'tableHeader', alignment: 'left' },
      { text: 'PŘÍCHOD', style: 'tableHeader', alignment: 'center' },
      { text: 'ODCHOD', style: 'tableHeader', alignment: 'center' },
      { text: 'PŘEHLED AKTIVIT DNE', style: 'tableHeader', alignment: 'left' },
      { text: 'UZNÁNO', style: 'tableHeader', alignment: 'right' }
    ]
  ];

  const rowGroupIndices: number[] = [0];
  const isSubRowFlags: boolean[] = [false];
  let groupCounter = 0;

  for (const d of data.days) {
    groupCounter++;
    const isNonWorkDay = d.isWeekend || d.isHoliday;
    const rowTextColor = isNonWorkDay && d.recognizedHours === 0 ? '#94a3b8' : '#1e293b';

    // Hlavní řádek dne
    tableBody.push([
      { text: d.dateStr, color: rowTextColor, bold: !isNonWorkDay },
      {
        text: d.isHoliday ? `${d.dayShort} (Sv)` : d.dayShort,
        color: d.isHoliday ? '#d97706' : rowTextColor,
        bold: d.isHoliday
      },
      { text: d.firstCheckIn || '—', alignment: 'center', color: rowTextColor },
      { text: d.lastCheckOut || '—', alignment: 'center', color: rowTextColor },
      {
        text:
          d.segmentsSummary ||
          (d.isHoliday ? `Státní svátek (${d.holidayName || ''})` : d.isWeekend ? 'Víkend' : '—'),
        color: rowTextColor,
        bold: Boolean(d.subLogs && d.subLogs.some((s) => s.isAbsence))
      },
      {
        text: d.recognizedHours > 0 ? formatHoursMinutes(d.recognizedHours) : '—',
        alignment: 'right',
        bold: d.recognizedHours > 0,
        color: d.recognizedHours > 0 ? '#0f172a' : rowTextColor
      }
    ]);
    rowGroupIndices.push(groupCounter);
    isSubRowFlags.push(false);

    // Bod 5: Rozpad absencí (a víceúsekových dnů) na dalším podřádku se zmenšeným písmem a indikací příslušnosti
    const subLogs = d.subLogs || [];
    const shouldRenderSubRows =
      subLogs.length > 1 || subLogs.some((s) => s.isAbsence);

    if (shouldRenderSubRows) {
      for (const sub of subLogs) {
        const accent = mapStatusTypeToAccent(sub.type);
        const pal = PDF_ACCENT_PALETTE[accent];
        const timeText = sub.timeRange || (sub.isAbsence ? 'Celodenní' : '—');

        tableBody.push([
          { text: '' },
          { text: '' },
          {
            text: timeText,
            colSpan: 2,
            fontSize: 7.5,
            color: '#64748b',
            alignment: 'center',
            margin: [0, 1, 0, 0]
          },
          {},
          {
            columns: [
              {
                svg: buildSubRowBranchSvg(accent),
                width: 16,
                height: 9,
                margin: [0, 1.5, 4, 0]
              },
              {
                width: '*',
                text: [
                  { text: sub.label, bold: true, color: pal.fg },
                  sub.note ? { text: `  •  ${sub.note}`, color: '#64748b' } : { text: '' }
                ],
                fontSize: 7.5,
                margin: [0, 1, 0, 0]
              }
            ],
            columnGap: 4
          },
          {
            text: sub.hours > 0 ? formatHoursMinutes(sub.hours) : '—',
            alignment: 'right',
            fontSize: 7.5,
            bold: true,
            color: '#475569',
            margin: [0, 1, 0, 0]
          }
        ]);
        rowGroupIndices.push(groupCounter);
        isSubRowFlags.push(true);
      }
    }
  }

  const content: Content[] = [
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'MĚSÍČNÍ VÝKAZ DOCHÁZKY', style: 'docCategory' },
            { text: `${monthName} ${data.year}`, style: 'docTitle', margin: [0, 2, 0, 2] },
            {
              text: 'Uzavřený měsíční přehled odpracované doby a absencí',
              style: 'docSubtitle'
            }
          ]
        },
        {
          width: 'auto',
          alignment: 'right',
          stack: [
            { text: data.employeeName, fontSize: 12, bold: true, color: '#0f172a' },
            {
              text: [data.roleLabel, data.contractLabel].filter(Boolean).join(' • '),
              fontSize: 8.5,
              color: '#475569',
              margin: [0, 2, 0, 0]
            },
            {
              text: `Denní úvazek: ${formatHoursMinutes(data.dailyTargetHours)} / den`,
              fontSize: 8,
              color: '#64748b',
              margin: [0, 2, 0, 0]
            }
          ]
        }
      ],
      margin: [0, 0, 0, 10]
    },
    buildCompleteIconSummaryGrid(summaryItems, 6),
    { text: 'Denní přehled docházky a rozpad absencí', style: 'sectionTitle', margin: [0, 4, 0, 6] },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        keepWithHeaderRows: 1,
        widths: [48, 36, 44, 44, '*', 52],
        body: tableBody
      },
      layout: createGroupedTableLayout(rowGroupIndices, isSubRowFlags)
    },
    buildSignatureBlock(
      `Podpis zaměstnance (${data.employeeName})`,
      'Podpis nadřízeného / schválil',
      `Stav dokumentu: Uzavřený měsíční výkaz (${monthName} ${data.year})`
    )
  ];

  const docDef = await createBaseDocumentDefinition(content, data.companyName);
  return pdfMake.createPdf(docDef).getBlob();
}

export async function downloadTimesheetPdf(data: TimesheetPdfData): Promise<void> {
  const blob = await generateTimesheetPdfBlob(data);
  const safeName = sanitizeFileNamePart(data.employeeName);
  const ym = `${data.year}-${String(data.month).padStart(2, '0')}`;
  triggerBrowserDownload(blob, `Vykaz_dochazky_${safeName}_${ym}.pdf`);
}

// ============================================================================
// 2. MĚSÍČNÍ UZÁVĚRKA OSOBY (ClosuresView - jednotlivě i Hromadný export)
// ============================================================================

export async function generatePersonClosurePdfBlob(
  person: PersonMonthlyClosureItemDto,
  timeEntries?: TimeEntryDetailDto[],
  companyName?: string
): Promise<Blob> {
  let resolvedEntries = timeEntries;
  if (!resolvedEntries) {
    try {
      const res = await api.getMonthlyEntries(person.userId, person.year, person.month);
      if (res?.data) {
        resolvedEntries = res.data;
      }
    } catch {
      // ignore if entries cannot be fetched
    }
  }

  const monthName = MONTH_NAMES[person.month - 1] || `${person.month}. měsíc`;
  const contractLabel = formatContractLabel(person.contract, person.contractTypeName || person.contractType);
  const rec = person.closureRecord;

  const workedHours = rec ? rec.workedHours : person.workedHours;
  const fundHours = rec ? rec.fundHours : person.fundHours;
  const overtimeBalance = rec ? rec.overtimeBalanceHours : person.overtimeBalanceHours;
  const saldoUsed = rec ? rec.saldoUsedHours : 0;
  const overtimeToSaldo = rec ? rec.overtimeToSaldoHours : 0;
  const paidOvertime = rec ? rec.paidOvertimeHours : Math.max(0, overtimeBalance);
  const outgoingSaldo = person.incomingSaldoHours - saldoUsed + overtimeToSaldo;

  const overtimeColor =
    overtimeBalance > 0 ? '#059669' : overtimeBalance < 0 ? '#e11d48' : '#0f172a';
  const hasUnverified = person.unverifiedPresencesCount > 0;
  const homeOfficeDaysCount = (resolvedEntries || []).filter(
    (e) => e.locationType === 'home_office'
  ).length;

  // Kompletní 12položkový ikonový přehled uzávěrky (přesně podle ClosuresView)
  const summaryItems: PdfSummaryItem[] = [
    {
      icon: 'calendar',
      accent: 'emerald',
      label: 'Odpracováno',
      value: `${Math.round(workedHours * 10) / 10}`,
      total: `${Math.round(fundHours * 10) / 10}`,
      unit: 'h'
    },
    {
      icon: 'trending',
      accent: overtimeBalance < 0 ? 'rose' : 'sky',
      label: 'Přesčas',
      value: formatOvertime(overtimeBalance),
      valueColor: overtimeColor
    },
    {
      icon: 'layers',
      accent: 'indigo',
      label: 'FlexiTime',
      value: formatOvertime(outgoingSaldo),
      valueColor: '#4f46e5'
    },
    {
      icon: hasUnverified ? 'alert' : 'building',
      accent: hasUnverified ? 'rose' : 'emerald',
      label: 'Neověřené přít.',
      value: `${person.unverifiedPresencesCount}`,
      valueColor: hasUnverified ? '#e11d48' : '#059669'
    },
    {
      icon: 'home',
      accent: 'sky',
      label: 'Home Office',
      value: `${homeOfficeDaysCount}`,
      unit: 'd'
    },
    {
      icon: 'palmtree',
      accent: 'amber',
      label: person.contract === 'OSVČ' ? 'Volno' : 'Dovolená',
      value: `${person.vacationDays}`,
      unit: 'd'
    },
    {
      icon: 'thermometer',
      accent: 'rose',
      label: 'Sick day',
      value: `${person.sickDays}`,
      unit: 'd'
    },
    {
      icon: 'pill',
      accent: 'red',
      label: 'Nemoc',
      value: `${person.illnessDays}`,
      unit: 'd'
    },
    {
      icon: 'baby',
      accent: 'orange',
      label: 'OČR',
      value: `${person.ocrDays}`,
      unit: 'd'
    },
    {
      icon: 'stethoscope',
      accent: 'indigo',
      label: 'Lékař',
      value: formatHoursMinutes(person.doctorHours)
    },
    {
      icon: 'calendar_x',
      accent: 'purple',
      label: 'Neplacené volno',
      value: `${person.unpaidLeaveDays}`,
      unit: 'd'
    },
    {
      icon: 'clock',
      accent: 'teal',
      label: 'Náhradní volno',
      value: `${person.compensatoryLeaveDays ?? 0}`,
      unit: 'd'
    }
  ];

  // Tabulka vypořádání fondu, přesčasů, salda a rozpadu čerpaných absencí pod hlavním řádkem
  const settlementBody: TableCell[][] = [
    [
      { text: 'POLOŽKA UZÁVĚRKY', style: 'tableHeader', alignment: 'left' },
      { text: 'POPIS / ROZPAD', style: 'tableHeader', alignment: 'left' },
      { text: 'HODNOTA', style: 'tableHeader', alignment: 'right' }
    ]
  ];
  const settlementGroups: number[] = [0];
  const settlementSubFlags: boolean[] = [false];
  let sGrp = 0;

  const pushSettlementRow = (
    title: string,
    desc: string,
    val: string,
    bold = false,
    valColor = '#0f172a'
  ) => {
    sGrp++;
    settlementBody.push([
      { text: title, bold },
      { text: desc, color: '#475569' },
      { text: val, alignment: 'right', bold: true, color: valColor }
    ]);
    settlementGroups.push(sGrp);
    settlementSubFlags.push(false);
  };

  pushSettlementRow(
    'Předepsaný měsíční fond',
    `Úvazek ${contractLabel} (${formatHoursMinutes(person.dailyTargetHours)} / den)`,
    formatHoursMinutes(fundHours),
    true
  );

  // Hlavní řádek: Skutečně uznaná doba (vč. náhrad za absence) + podřádky rozpadu absencí!
  pushSettlementRow(
    'Skutečně uznaná doba (vč. absencí)',
    'Odpracovaná doba na pracovišti, Home Office a započtené absence',
    formatHoursMinutes(workedHours),
    true
  );

  if (person.absencesForChecklist && person.absencesForChecklist.length > 0) {
    for (const abs of person.absencesForChecklist) {
      const accent = mapStatusTypeToAccent(abs.typeCode);
      const pal = PDF_ACCENT_PALETTE[accent];
      const dateRange =
        abs.startDate === abs.endDate
          ? formatDateCzech(abs.startDate)
          : `${formatDateCzech(abs.startDate)} – ${formatDateCzech(abs.endDate)}`;
      const timeRange =
        abs.startTime && abs.endTime ? ` (${abs.startTime}–${abs.endTime})` : '';
      const verifyText = abs.requiresChecklist
        ? abs.isVerified
          ? 'doloženo a ověřeno'
          : 'chybí doklad'
        : 'schváleno';
      const amountText =
        abs.hoursCount > 0 && abs.daysCount === 0
          ? formatHoursMinutes(abs.hoursCount)
          : `${abs.daysCount} d (${formatHoursMinutes(abs.hoursCount)})`;

      settlementBody.push([
        {
          columns: [
            {
              svg: buildSubRowBranchSvg(accent),
              width: 16,
              height: 9,
              margin: [4, 1.5, 4, 0]
            },
            {
              width: '*',
              text: abs.typeName,
              fontSize: 7.5,
              bold: true,
              color: pal.fg,
              margin: [0, 1, 0, 0]
            }
          ],
          columnGap: 4
        },
        {
          text: `${dateRange}${timeRange}  •  stav: ${verifyText}${abs.note ? `  •  ${abs.note}` : ''}`,
          fontSize: 7.5,
          color: '#64748b',
          margin: [0, 1, 0, 0]
        },
        {
          text: amountText,
          alignment: 'right',
          fontSize: 7.5,
          bold: true,
          color: '#475569',
          margin: [0, 1, 0, 0]
        }
      ]);
      settlementGroups.push(sGrp);
      settlementSubFlags.push(true);
    }
  }

  pushSettlementRow(
    'Hrubá bilance měsíce (odpracováno − fond)',
    overtimeBalance >= 0 ? 'Přesčas nad měsíční fond' : 'Nedopracované hodiny do fondu',
    formatOvertime(overtimeBalance),
    true,
    overtimeColor
  );
  pushSettlementRow(
    'Vstupní FlexiTime saldo z minulého měsíce',
    'Převod nevyčerpaného salda z předchozího období',
    formatOvertime(person.incomingSaldoHours)
  );
  pushSettlementRow(
    'Čerpání salda na pokrytí mínusu',
    'Hodiny odečtené ze salda pro dorovnání fondu',
    formatHoursMinutes(saldoUsed)
  );
  pushSettlementRow(
    'Převod přesčasu do FlexiTime salda',
    'Hodiny přesčasu uložené do salda pro náhradní volno',
    formatHoursMinutes(overtimeToSaldo)
  );
  pushSettlementRow(
    'Přesčas k proplacení ve mzdě',
    'Konečný počet hodin přesčasu k proplacení',
    formatHoursMinutes(paidOvertime),
    true,
    '#059669'
  );
  pushSettlementRow(
    'Konečné výstupní FlexiTime saldo',
    'Zůstatek salda převáděný do následujícího měsíce',
    formatOvertime(outgoingSaldo),
    true,
    '#4f46e5'
  );

  const content: Content[] = [
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'PROTOKOL MĚSÍČNÍ UZÁVĚRKY DOCHÁZKY', style: 'docCategory' },
            { text: `${monthName} ${person.year}`, style: 'docTitle', margin: [0, 2, 0, 2] },
            {
              text: rec
                ? `Uzavřeno dne ${formatDateTimeCz(rec.closedAt)}${rec.closedByName ? ` • ${rec.closedByName}` : ''}`
                : 'Přehled měsíční uzávěrky zaměstnance',
              style: 'docSubtitle'
            }
          ]
        },
        {
          width: 'auto',
          alignment: 'right',
          stack: [
            { text: person.fullName, fontSize: 12, bold: true, color: '#0f172a' },
            {
              text: `${person.roleLabel} • ${contractLabel}`,
              fontSize: 8.5,
              color: '#475569',
              margin: [0, 2, 0, 0]
            },
            {
              text: person.email,
              fontSize: 8,
              color: '#64748b',
              margin: [0, 2, 0, 0]
            }
          ]
        }
      ],
      margin: [0, 0, 0, 10]
    },
    buildCompleteIconSummaryGrid(summaryItems, 6),
    { text: '1. Vypořádání pracovního fondu, absencí, přesčasů a salda', style: 'sectionTitle', margin: [0, 4, 0, 6] },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        keepWithHeaderRows: 1,
        widths: [175, '*', 85],
        body: settlementBody
      },
      layout: createGroupedTableLayout(settlementGroups, settlementSubFlags)
    }
  ];

  // 2. Denní evidence příchodů, odchodů a absencí (s podřádkovým rozpadem absencí)
  const hasEntries = Boolean(resolvedEntries && resolvedEntries.length > 0);
  const hasAbsences = Boolean(person.absencesForChecklist && person.absencesForChecklist.length > 0);

  if (hasEntries || hasAbsences) {
    const entriesTableBody: TableCell[][] = [
      [
        { text: 'DATUM', style: 'tableHeader', alignment: 'left' },
        { text: 'DEN', style: 'tableHeader', alignment: 'left' },
        { text: 'PŘÍCHOD', style: 'tableHeader', alignment: 'center' },
        { text: 'ODCHOD', style: 'tableHeader', alignment: 'center' },
        { text: 'MÍSTO VÝKONU PRÁCE / ABSENCE', style: 'tableHeader', alignment: 'left' },
        { text: 'UZNÁNO', style: 'tableHeader', alignment: 'right' }
      ]
    ];
    const entryGroups: number[] = [0];
    const entrySubFlags: boolean[] = [false];
    let eGrp = 0;

    // Seskupíme podle kalendářního dne (YYYY-MM-DD), abychom pod hlavní řádek dne vykreslili podřádky absencí
    const dayMap = new Map<
      string,
      {
        entries: TimeEntryDetailDto[];
        absences: typeof person.absencesForChecklist;
      }
    >();

    for (const e of resolvedEntries || []) {
      if (!dayMap.has(e.date)) {
        dayMap.set(e.date, { entries: [], absences: [] });
      }
      dayMap.get(e.date)!.entries.push(e);
    }

    for (const abs of person.absencesForChecklist || []) {
      const start = new Date(`${abs.startDate}T00:00:00`);
      const end = new Date(`${abs.endDate}T00:00:00`);
      for (
        let cur = new Date(start);
        cur <= end;
        cur.setDate(cur.getDate() + 1)
      ) {
        if (cur.getFullYear() !== person.year || cur.getMonth() + 1 !== person.month) continue;
        const dow = cur.getDay();
        if (dow === 0 || dow === 6) continue;
        const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(
          cur.getDate()
        ).padStart(2, '0')}`;
        if (!dayMap.has(iso)) {
          dayMap.set(iso, { entries: [], absences: [] });
        }
        dayMap.get(iso)!.absences.push(abs);
      }
    }

    const sortedDates = Array.from(dayMap.keys()).sort();
    for (const isoDate of sortedDates) {
      eGrp++;
      const bucket = dayMap.get(isoDate)!;
      const dateStr = formatDateCzech(isoDate);
      const parsedDate = new Date(`${isoDate}T00:00:00`);
      const dayShort = !Number.isNaN(parsedDate.getTime())
        ? DAY_NAMES_SHORT[parsedDate.getDay()] || ''
        : '';

      const sortedEntries = [...bucket.entries].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );
      const firstIn = sortedEntries.length > 0 ? sortedEntries[0].startTime : '—';
      const lastOut =
        sortedEntries.length > 0
          ? sortedEntries[sortedEntries.length - 1].endTime || '—'
          : '—';

      const entriesHours = sortedEntries.reduce((s, e) => s + (e.hours || 0), 0);
      const absenceHours = bucket.absences.reduce((s, a) => {
        if (a.daysCount > 0) return s + person.dailyTargetHours;
        return s + (a.hoursCount || 0);
      }, 0);
      const totalDayHours = Math.min(
        Math.max(entriesHours + absenceHours, entriesHours),
        entriesHours + absenceHours
      );

      const mainLabels: string[] = [];
      for (const e of sortedEntries) {
        const lbl =
          e.locationType === 'home_office'
            ? 'Home Office'
            : e.locationType === 'doctor'
            ? 'Lékař'
            : e.workplaceName || 'Pracoviště';
        if (!mainLabels.includes(lbl)) mainLabels.push(lbl);
      }
      for (const a of bucket.absences) {
        if (!mainLabels.includes(a.typeName)) mainLabels.push(a.typeName);
      }

      entriesTableBody.push([
        { text: dateStr, bold: true },
        { text: dayShort },
        { text: firstIn, alignment: 'center' },
        { text: lastOut, alignment: 'center' },
        {
          text: mainLabels.join(', ') || '—',
          bold: bucket.absences.length > 0
        },
        {
          text: totalDayHours > 0 ? formatHoursMinutes(totalDayHours) : '—',
          alignment: 'right',
          bold: true
        }
      ]);
      entryGroups.push(eGrp);
      entrySubFlags.push(false);

      // Pokud má den absenci nebo více záznamů, připojíme zmenšené podřádky s indikací příslušnosti
      if (bucket.absences.length > 0 || sortedEntries.length > 1) {
        for (const e of sortedEntries) {
          const accent = mapStatusTypeToAccent(e.locationType);
          const pal = PDF_ACCENT_PALETTE[accent];
          const lbl =
            e.locationType === 'home_office'
              ? 'Home Office'
              : e.locationType === 'doctor'
              ? 'Lékař'
              : e.workplaceName || 'Pracoviště';

          entriesTableBody.push([
            { text: '' },
            { text: '' },
            {
              text: `${e.startTime} – ${e.endTime || '—'}`,
              colSpan: 2,
              fontSize: 7.5,
              color: '#64748b',
              alignment: 'center',
              margin: [0, 1, 0, 0]
            },
            {},
            {
              columns: [
                {
                  svg: buildSubRowBranchSvg(accent),
                  width: 16,
                  height: 9,
                  margin: [0, 1.5, 4, 0]
                },
                {
                  width: '*',
                  text: lbl,
                  fontSize: 7.5,
                  bold: true,
                  color: pal.fg,
                  margin: [0, 1, 0, 0]
                }
              ],
              columnGap: 4
            },
            {
              text: formatHoursMinutes(e.hours || 0),
              alignment: 'right',
              fontSize: 7.5,
              bold: true,
              color: '#475569',
              margin: [0, 1, 0, 0]
            }
          ]);
          entryGroups.push(eGrp);
          entrySubFlags.push(true);
        }

        for (const a of bucket.absences) {
          const accent = mapStatusTypeToAccent(a.typeCode);
          const pal = PDF_ACCENT_PALETTE[accent];
          const aHours = a.daysCount > 0 ? person.dailyTargetHours : a.hoursCount || 0;
          const timeInfo =
            a.startTime && a.endTime ? `${a.startTime} – ${a.endTime}` : 'Celodenní';

          entriesTableBody.push([
            { text: '' },
            { text: '' },
            {
              text: timeInfo,
              colSpan: 2,
              fontSize: 7.5,
              color: '#64748b',
              alignment: 'center',
              margin: [0, 1, 0, 0]
            },
            {},
            {
              columns: [
                {
                  svg: buildSubRowBranchSvg(accent),
                  width: 16,
                  height: 9,
                  margin: [0, 1.5, 4, 0]
                },
                {
                  width: '*',
                  text: [
                    { text: a.typeName, bold: true, color: pal.fg },
                    a.note ? { text: `  •  ${a.note}`, color: '#64748b' } : { text: '' }
                  ],
                  fontSize: 7.5,
                  margin: [0, 1, 0, 0]
                }
              ],
              columnGap: 4
            },
            {
              text: formatHoursMinutes(aHours),
              alignment: 'right',
              fontSize: 7.5,
              bold: true,
              color: '#475569',
              margin: [0, 1, 0, 0]
            }
          ]);
          entryGroups.push(eGrp);
          entrySubFlags.push(true);
        }
      }
    }

    content.push(
      {
        text: '2. Denní evidence přítomností a rozpad absencí',
        style: 'sectionTitle',
        pageBreak: entriesTableBody.length > 6 ? 'before' : undefined,
        margin: [0, 12, 0, 6]
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          keepWithHeaderRows: 1,
          widths: [52, 34, 46, 46, '*', 56],
          body: entriesTableBody
        },
        layout: createGroupedTableLayout(entryGroups, entrySubFlags)
      }
    );
  }

  content.push(
    buildSignatureBlock(
      `Podpis zaměstnance (${person.fullName})`,
      `Uzavřel a schválil (${rec?.closedByName || 'Vedoucí / Administrátor'})`,
      `Stav uzávěrky: ${person.isClosed ? 'UZAVŘENO' : 'NEUZAVŘENO'} • Období ${monthName} ${person.year}`
    )
  );

  const docDef = await createBaseDocumentDefinition(content, companyName);
  return pdfMake.createPdf(docDef).getBlob();
}

export async function downloadPersonClosurePdf(
  person: PersonMonthlyClosureItemDto,
  timeEntries?: TimeEntryDetailDto[],
  companyName?: string
): Promise<void> {
  const blob = await generatePersonClosurePdfBlob(person, timeEntries, companyName);
  const safeName = sanitizeFileNamePart(person.fullName);
  const ym = `${person.year}-${String(person.month).padStart(2, '0')}`;
  triggerBrowserDownload(blob, `Uzaverka_${safeName}_${ym}.pdf`);
}

/**
 * Hromadný export PDF uzávěrek do stromové struktury složek:
 *   <mesic_rok>/<jmeno_prijmeni>/uzaverka_<jmeno_prijmeni>_<mesic_rok>.pdf
 *   (např. zari_2026/david_sykora/uzaverka_david_sykora_zari_2026.pdf)
 * 1) V prohlížečích s podporou File System Access API (Chrome, Edge, Brave, Opera)
 *    otevře systémový výběr cílové složky, založí v ní složku měsíce (např. zari_2026),
 *    uvnitř podsložky jednotlivých zaměstnanců (např. david_sykora) a do nich uloží PDF.
 * 2) V ostatních prohlížečích (Firefox, Safari) vytvoří stejnou strukturu složek uvnitř ZIP archivu.
 */
export async function exportBulkClosuresPdfs(
  people: PersonMonthlyClosureItemDto[],
  options?: {
    companyName?: string;
    onProgress?: (current: number, total: number, personName: string) => void;
  }
): Promise<{ mode: 'directory' | 'zip' | 'cancelled'; count: number; monthFolder?: string }> {
  if (people.length === 0) {
    return { mode: 'cancelled', count: 0 };
  }

  const first = people[0];
  const monthFolderName = getMonthFolderSlug(first.month, first.year);

  const w = window as unknown as {
    showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<any>;
  };

  if (typeof w.showDirectoryPicker === 'function') {
    let rootDirHandle: any;
    try {
      rootDirHandle = await w.showDirectoryPicker({ mode: 'readwrite' });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { mode: 'cancelled', count: 0 };
      }
      throw err;
    }

    // 1. Založení složky měsíce (např. "zari_2026")
    const monthDirHandle = await rootDirHandle.getDirectoryHandle(monthFolderName, {
      create: true
    });

    for (let i = 0; i < people.length; i++) {
      const person = people[i];
      options?.onProgress?.(i + 1, people.length, person.fullName);

      const personSlug = toLowerSlug(person.fullName) || `zamestnanec_${i + 1}`;
      const personMonthFolder = getMonthFolderSlug(person.month, person.year);

      // 2. Založení podsložky zaměstnance (např. "david_sykora") uvnitř složky měsíce
      const targetMonthDir =
        personMonthFolder === monthFolderName
          ? monthDirHandle
          : await rootDirHandle.getDirectoryHandle(personMonthFolder, { create: true });
      const personDirHandle = await targetMonthDir.getDirectoryHandle(personSlug, {
        create: true
      });

      // 3. Vygenerování a zápis PDF do podsložky zaměstnance
      const pdfBlob = await generatePersonClosurePdfBlob(person, undefined, options?.companyName);
      const fileName = `uzaverka_${personSlug}_${personMonthFolder}.pdf`;

      const fileHandle = await personDirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();

      await new Promise((r) => setTimeout(r, 0));
    }

    return { mode: 'directory', count: people.length, monthFolder: monthFolderName };
  }

  const zipEntries: Record<string, Uint8Array> = {};

  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    options?.onProgress?.(i + 1, people.length, person.fullName);

    const personSlug = toLowerSlug(person.fullName) || `zamestnanec_${i + 1}`;
    const personMonthFolder = getMonthFolderSlug(person.month, person.year);
    const pdfBlob = await generatePersonClosurePdfBlob(person, undefined, options?.companyName);
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const fileName = `uzaverka_${personSlug}_${personMonthFolder}.pdf`;

    zipEntries[`${personMonthFolder}/${personSlug}/${fileName}`] = new Uint8Array(arrayBuffer);
    await new Promise((r) => setTimeout(r, 0));
  }

  const zippedBytes = zipSync(zipEntries, { level: 6 });
  const zipBlob = new Blob([zippedBytes], { type: 'application/zip' });
  triggerBrowserDownload(zipBlob, `${monthFolderName}.zip`);

  return { mode: 'zip', count: people.length, monthFolder: monthFolderName };
}

// ============================================================================
// 3. ZÁZNAM SOUHLASU GDPR (PersonGdprTab)
// ============================================================================

export interface GdprPdfExportData {
  document: GdprDocumentDto;
  personName: string;
  personEmail?: string;
  personRoleLabel?: string;
  personContractLabel?: string;
  companyName?: string;
}

function parseGdprHtmlToPdfContent(rawHtml?: string | null): Content[] {
  if (!rawHtml) return [{ text: '—' }];

  const normalized = rawHtml
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '');

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${normalized}</div>`, 'text/html');
  const root = doc.body.firstElementChild || doc.body;

  interface StyledSpan {
    text: string;
    bold?: boolean;
    italics?: boolean;
    decoration?: 'underline';
  }

  const runs: StyledSpan[] = [];

  function walk(node: Node, style: { bold?: boolean; italics?: boolean; underline?: boolean }) {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.nodeValue || '';
      if (txt) {
        runs.push({
          text: txt,
          bold: style.bold || undefined,
          italics: style.italics || undefined,
          decoration: style.underline ? 'underline' : undefined
        });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'br') {
        runs.push({ text: '\n' });
        return;
      }
      const nextStyle = {
        bold: style.bold || tag === 'b' || tag === 'strong',
        italics: style.italics || tag === 'i' || tag === 'em',
        underline: style.underline || tag === 'u'
      };
      el.childNodes.forEach((child) => walk(child, nextStyle));
    }
  }

  walk(root, {});

  return [
    {
      text: runs.length > 0 ? runs : normalized.replace(/<[^>]+>/g, ''),
      fontSize: 9.5,
      color: '#1e293b',
      lineHeight: 1.4
    }
  ];
}

export async function generateGdprDocumentPdfBlob(data: GdprPdfExportData): Promise<Blob> {
  const { document: doc } = data;
  const sends = doc.userSends || [];
  const latestSend = sends.length > 0 ? sends[0] : null;

  const statusText =
    latestSend === null
      ? 'Dosud nevyplněno'
      : latestSend.isGranted
      ? 'Souhlas udělen'
      : 'Nesouhlas (odvoláno)';

  const statusAccent: PdfAccentKey =
    latestSend === null ? 'amber' : latestSend.isGranted ? 'emerald' : 'rose';
  const statusColor =
    latestSend === null ? '#d97706' : latestSend.isGranted ? '#059669' : '#e11d48';

  const gdprSummaryItems: PdfSummaryItem[] = [
    {
      icon: 'user',
      accent: 'amber',
      label: 'Subjekt údajů',
      value: data.personName
    },
    {
      icon: 'calendar',
      accent: doc.isCurrentlyActive ? 'emerald' : 'slate',
      label: 'Platnost od',
      value: formatDateCzech(doc.validFrom)
    },
    {
      icon: 'shield',
      accent: statusAccent,
      label: 'Stav souhlasu',
      value: statusText,
      valueColor: statusColor
    }
  ];

  const historyBody: TableCell[][] = [
    [
      { text: '#', style: 'tableHeader', alignment: 'center' },
      { text: 'ROZHODNUTÍ SUBJEKTU ÚDAJŮ', style: 'tableHeader', alignment: 'left' },
      { text: 'IDENTIFIKACE ÚČTU (E-MAIL)', style: 'tableHeader', alignment: 'left' },
      { text: 'DATUM A ČAS ZÁZNAMU', style: 'tableHeader', alignment: 'right' }
    ]
  ];
  const historyGroups: number[] = [0];
  const historySubFlags: boolean[] = [false];

  if (sends.length === 0) {
    historyBody.push([
      {
        text: 'K tomuto dokumentu GDPR dosud nebyl evidován žádný odeslaný záznam souhlasu ani nesouhlasu.',
        colSpan: 4,
        color: '#64748b',
        italics: true,
        alignment: 'center'
      },
      {},
      {},
      {}
    ]);
    historyGroups.push(1);
    historySubFlags.push(false);
  } else {
    sends.forEach((s, idx) => {
      historyBody.push([
        { text: `${idx + 1}.`, alignment: 'center', color: '#64748b' },
        {
          text: s.isGranted
            ? 'Souhlas udělen'
            : 'Nesouhlas (odmítnuto / odvoláno)',
          bold: idx === 0,
          color: s.isGranted ? '#059669' : '#e11d48'
        },
        { text: s.userEmail || data.personEmail || '—' },
        {
          text: formatDateTimeCz(s.sentAt),
          alignment: 'right',
          bold: idx === 0
        }
      ]);
      historyGroups.push(idx + 1);
      historySubFlags.push(false);
    });
  }

  const content: Content[] = [
    {
      columns: [
        {
          width: '*',
          stack: [
            {
              text: 'EVIDENCE SOUHLASU SE ZPRACOVÁNÍM OSOBNÍCH ÚDAJŮ (GDPR)',
              style: 'docCategory'
            },
            {
              text: `Dokument GDPR • platnost od ${formatDateCzech(doc.validFrom)}`,
              style: 'docTitle',
              margin: [0, 2, 0, 2]
            },
            {
              text: doc.isCurrentlyActive
                ? 'Aktuálně platná verze pravidel ochrany osobních údajů'
                : 'Historická verze pravidel ochrany osobních údajů',
              style: 'docSubtitle'
            }
          ]
        },
        {
          width: 'auto',
          alignment: 'right',
          stack: [
            { text: data.personName, fontSize: 12, bold: true, color: '#0f172a' },
            {
              text: [data.personRoleLabel, data.personContractLabel].filter(Boolean).join(' • '),
              fontSize: 8.5,
              color: '#475569',
              margin: [0, 2, 0, 0]
            },
            {
              text: data.personEmail || '',
              fontSize: 8,
              color: '#64748b',
              margin: [0, 2, 0, 0]
            }
          ]
        }
      ],
      margin: [0, 0, 0, 12]
    },
    buildCompleteIconSummaryGrid(gdprSummaryItems),
    { text: '1. Plné znění dokumentu GDPR', style: 'sectionTitle' },
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: parseGdprHtmlToPdfContent(doc.content),
              margin: [4, 4, 4, 4]
            }
          ]
        ]
      },
      layout: CARD_TABLE_LAYOUT,
      margin: [0, 0, 0, 8]
    },
    {
      text: '2. Auditní historie vyjádření souhlasů a nesouhlasů osoby',
      style: 'sectionTitle'
    },
    {
      table: {
        headerRows: 1,
        widths: [28, '*', 155, 115],
        body: historyBody
      },
      layout: createGroupedTableLayout(historyGroups, historySubFlags)
    },
    buildSignatureBlock(
      `Podpis subjektu údajů (${data.personName})`,
      `Za správce osobních údajů (${getActiveCompanyName(data.companyName)})`,
      `ID dokumentu GDPR: ${doc.id}`
    )
  ];

  const docDef = await createBaseDocumentDefinition(content, data.companyName);
  return pdfMake.createPdf(docDef).getBlob();
}

export async function downloadGdprDocumentPdf(data: GdprPdfExportData): Promise<void> {
  const blob = await generateGdprDocumentPdfBlob(data);
  const safeName = sanitizeFileNamePart(data.personName);
  const validFromSafe = sanitizeFileNamePart(data.document.validFrom);
  triggerBrowserDownload(blob, `GDPR_Souhlas_${safeName}_od_${validFromSafe}.pdf`);
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
