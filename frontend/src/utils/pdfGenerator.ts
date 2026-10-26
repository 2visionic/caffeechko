import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { zipSync } from 'fflate';
import type { Content, TDocumentDefinitions, TableCell, CustomTableLayout } from 'pdfmake/interfaces';
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

let cachedLogoFullDataUrl: string | null = null;
let cachedLogoIconDataUrl: string | null = null;

async function loadAssetAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error(`Nelze načíst obrázek ${url}`));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function ensurePdfLogosLoaded(): Promise<{ logoFull: string; logoIcon: string }> {
  if (!cachedLogoFullDataUrl) {
    cachedLogoFullDataUrl = await loadAssetAsDataUrl('/caffeechko-logo.png');
  }
  if (!cachedLogoIconDataUrl) {
    cachedLogoIconDataUrl = await loadAssetAsDataUrl('/caffeechko-icon.png');
  }
  return {
    logoFull: cachedLogoFullDataUrl,
    logoIcon: cachedLogoIconDataUrl
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

// Jednotné rozvržení tabulek v dokumentech
const CLEAN_TABLE_LAYOUT: CustomTableLayout = {
  hLineWidth: (i, node) => {
    if (i === 0) return 0;
    if (i === 1) return 1.2;
    if (i === node.table.body.length) return 1;
    return 0.5;
  },
  vLineWidth: () => 0,
  hLineColor: (i) => (i === 1 ? '#cbd5e1' : '#e2e8f0'),
  fillColor: (rowIndex) => {
    if (rowIndex === 0) return '#f1f5f9';
    return rowIndex % 2 === 1 ? '#ffffff' : '#f8fafc';
  },
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: (i) => (i === 0 ? 7 : 6),
  paddingBottom: (i) => (i === 0 ? 7 : 6)
};

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

const HEADER_DIVIDER_LAYOUT: CustomTableLayout = {
  hLineWidth: (i) => (i === 1 ? 1 : 0),
  vLineWidth: () => 0,
  hLineColor: () => '#e2e8f0',
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 10
};

const FOOTER_DIVIDER_LAYOUT: CustomTableLayout = {
  hLineWidth: (i) => (i === 0 ? 1 : 0),
  vLineWidth: () => 0,
  hLineColor: () => '#e2e8f0',
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 8,
  paddingBottom: () => 0
};

/**
 * Sestaví kompletní TDocumentDefinitions s jednotnou hlavičkou a patičkou:
 * - Hlavička: vlevo logo caffeechko, vpravo název firmy
 * - Patička: vlevo logo caffeechko-icon, vpravo počet stran z kolika
 */
async function createBaseDocumentDefinition(
  content: Content[],
  companyName?: string
): Promise<TDocumentDefinitions> {
  const logos = await ensurePdfLogosLoaded();
  const resolvedCompany = getActiveCompanyName(companyName);

  return {
    pageSize: 'A4',
    pageMargins: [40, 68, 40, 56],
    images: {
      logoFull: logos.logoFull,
      logoIcon: logos.logoIcon
    },
    header: () => ({
      margin: [40, 22, 40, 0],
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            {
              image: 'logoFull',
              height: 20,
              alignment: 'left'
            },
            {
              text: resolvedCompany,
              fontSize: 10.5,
              bold: true,
              color: '#0f172a',
              alignment: 'right',
              margin: [0, 5, 0, 0]
            }
          ]
        ]
      },
      layout: HEADER_DIVIDER_LAYOUT
    }),
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 12, 40, 0],
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            {
              image: 'logoIcon',
              height: 15,
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
      layout: FOOTER_DIVIDER_LAYOUT
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
        fontSize: 9.5,
        color: '#64748b'
      },
      sectionTitle: {
        fontSize: 10.5,
        bold: true,
        color: '#0f172a',
        margin: [0, 14, 0, 6]
      },
      tableHeader: {
        fontSize: 8,
        bold: true,
        color: '#475569'
      },
      kpiLabel: {
        fontSize: 7.5,
        bold: true,
        color: '#64748b'
      },
      kpiValue: {
        fontSize: 13,
        bold: true,
        color: '#0f172a',
        margin: [0, 2, 0, 1]
      },
      kpiSub: {
        fontSize: 7.5,
        color: '#64748b'
      }
    },
    content
  };
}

function buildKpiCard(label: string, value: string, subtext: string, valueColor = '#0f172a'): Content {
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              { text: label.toUpperCase(), style: 'kpiLabel' },
              { text: value, style: 'kpiValue', color: valueColor },
              { text: subtext, style: 'kpiSub' }
            ]
          }
        ]
      ]
    },
    layout: CARD_TABLE_LAYOUT
  };
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
                    x2: 210,
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
                    x2: 210,
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
  vacationDays: number;
  sickDays: number;
  illnessDays: number;
  ocrDays: number;
  doctorHours: number;
  homeOfficeDays: number;
  days: TimesheetPdfDayRow[];
  companyName?: string;
}

export async function generateTimesheetPdfBlob(data: TimesheetPdfData): Promise<Blob> {
  const monthName = MONTH_NAMES[data.month - 1] || `${data.month}. měsíc`;
  const overtimeColor =
    data.overtimeHours > 0 ? '#059669' : data.overtimeHours < 0 ? '#e11d48' : '#0f172a';

  const tableBody: TableCell[][] = [
    [
      { text: 'DATUM', style: 'tableHeader', alignment: 'left' },
      { text: 'DEN', style: 'tableHeader', alignment: 'left' },
      { text: 'PŘÍCHOD', style: 'tableHeader', alignment: 'center' },
      { text: 'ODCHOD', style: 'tableHeader', alignment: 'center' },
      { text: 'PŘEHLED ZÁZNAMŮ A ABSENCÍ', style: 'tableHeader', alignment: 'left' },
      { text: 'UZNÁNO', style: 'tableHeader', alignment: 'right' }
    ]
  ];

  for (const d of data.days) {
    const isNonWorkDay = d.isWeekend || d.isHoliday;
    const rowTextColor = isNonWorkDay && d.recognizedHours === 0 ? '#94a3b8' : '#1e293b';

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
        color: rowTextColor
      },
      {
        text: d.recognizedHours > 0 ? `${formatHoursMinutes(d.recognizedHours)} h` : '—',
        alignment: 'right',
        bold: d.recognizedHours > 0,
        color: d.recognizedHours > 0 ? '#0f172a' : rowTextColor
      }
    ]);
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
              text: `Denní úvazek: ${formatHoursMinutes(data.dailyTargetHours)} h / den`,
              fontSize: 8,
              color: '#64748b',
              margin: [0, 2, 0, 0]
            }
          ]
        }
      ],
      margin: [0, 0, 0, 14]
    },
    {
      columns: [
        buildKpiCard(
          'Odpracováno',
          `${formatHoursMinutes(data.workedHours)} h`,
          `Měsíční fond: ${formatHoursMinutes(data.fundHours)} h`
        ),
        buildKpiCard(
          'Bilance měsíce',
          `${formatOvertime(data.overtimeHours)} h`,
          data.overtimeHours >= 0 ? 'Přesčas / kladné saldo' : 'Chybějící hodiny do fondu',
          overtimeColor
        ),
        buildKpiCard(
          'Čerpané volno',
          `${data.vacationDays + data.sickDays} d`,
          `Dovolená: ${data.vacationDays} d • Sick day: ${data.sickDays} d`
        ),
        buildKpiCard(
          'Lékař & Nemoc',
          `${formatHoursMinutes(data.doctorHours)} h`,
          `Nemoc: ${data.illnessDays} d • OČR: ${data.ocrDays} d • HO: ${data.homeOfficeDays} d`
        )
      ],
      columnGap: 8,
      margin: [0, 0, 0, 14]
    },
    { text: 'Denní přehled docházky', style: 'sectionTitle', margin: [0, 2, 0, 6] },
    {
      table: {
        headerRows: 1,
        widths: [48, 38, 46, 46, '*', 54],
        body: tableBody
      },
      layout: CLEAN_TABLE_LAYOUT
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

  // Tabulka vypořádání fondu, přesčasů a salda
  const settlementBody: TableCell[][] = [
    [
      { text: 'POLOŽKA UZÁVĚRKY', style: 'tableHeader', alignment: 'left' },
      { text: 'POPIS / METODIKA', style: 'tableHeader', alignment: 'left' },
      { text: 'HODNOTA', style: 'tableHeader', alignment: 'right' }
    ],
    [
      { text: 'Předepsaný měsíční fond', bold: true },
      { text: `Úvazek ${contractLabel} (${formatHoursMinutes(person.dailyTargetHours)} h / den)` },
      { text: `${formatHoursMinutes(fundHours)} h`, alignment: 'right', bold: true }
    ],
    [
      { text: 'Skutečně uznaná doba (vč. náhrad)', bold: true },
      { text: 'Odpracovaná doba na pracovišti, Home Office a placené náhrady' },
      { text: `${formatHoursMinutes(workedHours)} h`, alignment: 'right', bold: true }
    ],
    [
      { text: 'Hrubá bilance měsíce (odpracováno − fond)', bold: true },
      { text: overtimeBalance >= 0 ? 'Přesčas nad měsíční fond' : 'Nedopracované hodiny do fondu' },
      {
        text: `${formatOvertime(overtimeBalance)} h`,
        alignment: 'right',
        bold: true,
        color: overtimeColor
      }
    ],
    [
      { text: 'Vstupní saldo z předchozího měsíce' },
      { text: 'Převod nevyčerpaného salda z minulého období' },
      { text: `${formatOvertime(person.incomingSaldoHours)} h`, alignment: 'right' }
    ],
    [
      { text: 'Čerpání salda na pokrytí mínusu' },
      { text: 'Hodiny odečtené ze salda pro dorovnání fondu' },
      { text: `${formatHoursMinutes(saldoUsed)} h`, alignment: 'right' }
    ],
    [
      { text: 'Převod přesčasu do salda' },
      { text: 'Hodiny přesčasu uložené do salda pro náhradní volno' },
      { text: `${formatHoursMinutes(overtimeToSaldo)} h`, alignment: 'right' }
    ],
    [
      { text: 'Přesčas k proplacení ve mzdě', bold: true },
      { text: 'Konečný počet hodin přesčasu k proplacení' },
      { text: `${formatHoursMinutes(paidOvertime)} h`, alignment: 'right', bold: true, color: '#059669' }
    ],
    [
      { text: 'Konečné výstupní saldo do dalšího měsíce', bold: true },
      { text: 'Zůstatek salda převáděný do následujícího období' },
      { text: `${formatOvertime(outgoingSaldo)} h`, alignment: 'right', bold: true }
    ]
  ];

  // Tabulka přehledu čerpaných absencí
  const absenceRows: TableCell[][] = [
    [
      { text: 'TYP ABSENCE', style: 'tableHeader', alignment: 'left' },
      { text: 'TERMÍN', style: 'tableHeader', alignment: 'left' },
      { text: 'ROZSAH', style: 'tableHeader', alignment: 'right' },
      { text: 'KONTROLA DOKLADŮ', style: 'tableHeader', alignment: 'right' }
    ]
  ];

  if (person.absencesForChecklist && person.absencesForChecklist.length > 0) {
    for (const abs of person.absencesForChecklist) {
      const dateRange =
        abs.startDate === abs.endDate
          ? formatDateCzech(abs.startDate)
          : `${formatDateCzech(abs.startDate)} – ${formatDateCzech(abs.endDate)}`;
      const timeRange =
        abs.startTime && abs.endTime ? ` (${abs.startTime}–${abs.endTime})` : '';
      const amountLabel =
        abs.hoursCount > 0 && abs.daysCount === 0
          ? `${formatHoursMinutes(abs.hoursCount)} h`
          : `${abs.daysCount} d (${formatHoursMinutes(abs.hoursCount)} h)`;

      absenceRows.push([
        { text: abs.typeName, bold: true },
        { text: `${dateRange}${timeRange}` },
        { text: amountLabel, alignment: 'right', bold: true },
        {
          text: abs.requiresChecklist
            ? abs.isVerified
              ? 'Doloženo a ověřeno'
              : 'Chybí doklad'
            : 'Schváleno v systému',
          alignment: 'right',
          color: abs.requiresChecklist && !abs.isVerified ? '#e11d48' : '#059669',
          bold: true
        }
      ]);
    }
  } else {
    absenceRows.push([
      {
        text: 'V tomto měsíci nebyly čerpány žádné celodenní ani hodinové absence.',
        colSpan: 4,
        color: '#64748b',
        italics: true,
        alignment: 'center'
      },
      {},
      {},
      {}
    ]);
  }

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
      margin: [0, 0, 0, 14]
    },
    {
      columns: [
        buildKpiCard(
          'Odpracováno / Fond',
          `${formatHoursMinutes(workedHours)} h`,
          `Měsíční fond: ${formatHoursMinutes(fundHours)} h`
        ),
        buildKpiCard(
          'Bilance měsíce',
          `${formatOvertime(overtimeBalance)} h`,
          `K proplacení: ${formatHoursMinutes(paidOvertime)} h`,
          overtimeColor
        ),
        buildKpiCard(
          'Konečné saldo',
          `${formatOvertime(outgoingSaldo)} h`,
          `Vstupní: ${formatOvertime(person.incomingSaldoHours)} h`
        ),
        buildKpiCard(
          'Absence v měsíci',
          `${person.vacationDays + person.sickDays + person.illnessDays + person.ocrDays} d`,
          `Dov: ${person.vacationDays}d • SD: ${person.sickDays}d • Lék: ${formatHoursMinutes(person.doctorHours)}h`
        )
      ],
      columnGap: 8,
      margin: [0, 0, 0, 10]
    },
    { text: '1. Vypořádání pracovního fondu, přesčasů a salda', style: 'sectionTitle' },
    {
      table: {
        headerRows: 1,
        widths: [175, '*', 80],
        body: settlementBody
      },
      layout: CLEAN_TABLE_LAYOUT
    },
    { text: '2. Přehled absencí a kontrola dokladů v měsíci', style: 'sectionTitle' },
    {
      table: {
        headerRows: 1,
        widths: [120, '*', 85, 110],
        body: absenceRows
      },
      layout: CLEAN_TABLE_LAYOUT
    }
  ];

  // Pokud máme načtené i záznamy příchodů/odchodů daného měsíce, připojíme tabulku přítomností
  if (resolvedEntries && resolvedEntries.length > 0) {
    const entriesTableBody: TableCell[][] = [
      [
        { text: 'DATUM', style: 'tableHeader', alignment: 'left' },
        { text: 'DEN', style: 'tableHeader', alignment: 'left' },
        { text: 'PŘÍCHOD', style: 'tableHeader', alignment: 'center' },
        { text: 'ODCHOD', style: 'tableHeader', alignment: 'center' },
        { text: 'MÍSTO VÝKONU PRÁCE', style: 'tableHeader', alignment: 'left' },
        { text: 'ODPRACOVÁNO', style: 'tableHeader', alignment: 'right' }
      ]
    ];

    const sorted = [...resolvedEntries].sort((a, b) =>
      `${a.date}_${a.startTime}`.localeCompare(`${b.date}_${b.startTime}`)
    );
    for (const entry of sorted) {
      const dateStr = formatDateCzech(entry.date);
      const parsedDate = new Date(`${entry.date}T00:00:00`);
      const dayShort = !Number.isNaN(parsedDate.getTime())
        ? DAY_NAMES_SHORT[parsedDate.getDay()] || ''
        : '';
      const timeIn = entry.startTime || '—';
      const timeOut = entry.endTime || '—';
      const durHours = entry.hours || 0;
      const locLabel =
        entry.locationType === 'home_office'
          ? 'Home Office'
          : entry.locationType === 'doctor'
          ? 'Lékař'
          : entry.workplaceName || 'Pracoviště';

      entriesTableBody.push([
        { text: dateStr, bold: true },
        { text: dayShort },
        { text: timeIn, alignment: 'center' },
        { text: timeOut, alignment: 'center' },
        { text: locLabel },
        {
          text: durHours > 0 ? `${formatHoursMinutes(durHours)} h` : '—',
          alignment: 'right',
          bold: true
        }
      ]);
    }

    content.push(
      { text: '3. Evidence zaznamenaných příchodů a odchodů', style: 'sectionTitle' },
      {
        table: {
          headerRows: 1,
          widths: [68, 34, 52, 52, '*', 75],
          body: entriesTableBody
        },
        layout: CLEAN_TABLE_LAYOUT
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
 * Hromadný export PDF uzávěrek:
 * 1) V prohlížečích s podporou File System Access API (Chrome, Edge, Brave, Opera)
 *    otevře systémový výběr složky a postupně do ní zapíše jednotlivá PDF bez nutnosti ZIPu.
 * 2) V ostatních prohlížečích (Firefox, Safari) vygeneruje všechna PDF a stáhne je v jednom ZIP archivu.
 */
export async function exportBulkClosuresPdfs(
  people: PersonMonthlyClosureItemDto[],
  options?: {
    companyName?: string;
    onProgress?: (current: number, total: number, personName: string) => void;
  }
): Promise<{ mode: 'directory' | 'zip' | 'cancelled'; count: number }> {
  if (people.length === 0) {
    return { mode: 'cancelled', count: 0 };
  }

  const w = window as unknown as {
    showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<any>;
  };

  // Varianta A: Přímý zápis jednotlivých PDF souborů do vybrané složky na disku
  if (typeof w.showDirectoryPicker === 'function') {
    let dirHandle: any;
    try {
      dirHandle = await w.showDirectoryPicker({ mode: 'readwrite' });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { mode: 'cancelled', count: 0 };
      }
      throw err;
    }

    for (let i = 0; i < people.length; i++) {
      const person = people[i];
      options?.onProgress?.(i + 1, people.length, person.fullName);

      const pdfBlob = await generatePersonClosurePdfBlob(person, undefined, options?.companyName);
      const safeName = sanitizeFileNamePart(person.fullName);
      const ym = `${person.year}-${String(person.month).padStart(2, '0')}`;
      const fileName = `Uzaverka_${safeName}_${ym}.pdf`;

      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();

      // Uvolnění event loopu pro plynulou odezvu UI
      await new Promise((r) => setTimeout(r, 0));
    }

    return { mode: 'directory', count: people.length };
  }

  // Varianta B: Fallback na ZIP archiv (pro prohlížeče bez showDirectoryPicker)
  const zipEntries: Record<string, Uint8Array> = {};

  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    options?.onProgress?.(i + 1, people.length, person.fullName);

    const pdfBlob = await generatePersonClosurePdfBlob(person, undefined, options?.companyName);
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const safeName = sanitizeFileNamePart(person.fullName);
    const ym = `${person.year}-${String(person.month).padStart(2, '0')}`;
    const fileName = `Uzaverka_${safeName}_${ym}.pdf`;

    zipEntries[fileName] = new Uint8Array(arrayBuffer);
    await new Promise((r) => setTimeout(r, 0));
  }

  const zippedBytes = zipSync(zipEntries, { level: 6 });
  const zipBlob = new Blob([zippedBytes], { type: 'application/zip' });
  const first = people[0];
  const ym = `${first.year}-${String(first.month).padStart(2, '0')}`;
  triggerBrowserDownload(zipBlob, `Uzaverky_hromadny_export_${ym}.zip`);

  return { mode: 'zip', count: people.length };
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

/**
 * Převede jednoduché HTML z GDPR editoru (<b>, <strong>, <i>, <em>, <u>, <br>, <p>)
 * na čisté pdfmake textové segmenty se zachováním tučného písma, kurzívy, podtržení a odřádkování.
 */
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
      : 'Nesouhlas (odmítnuto / odvoláno)';

  const statusColor =
    latestSend === null ? '#d97706' : latestSend.isGranted ? '#059669' : '#e11d48';

  const historyBody: TableCell[][] = [
    [
      { text: '#', style: 'tableHeader', alignment: 'center' },
      { text: 'ROZHODNUTÍ SUBJEKTU ÚDAJŮ', style: 'tableHeader', alignment: 'left' },
      { text: 'IDENTIFIKACE ÚČTU (E-MAIL)', style: 'tableHeader', alignment: 'left' },
      { text: 'DATUM A ČAS ZÁZNAMU', style: 'tableHeader', alignment: 'right' }
    ]
  ];

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
      margin: [0, 0, 0, 14]
    },
    {
      columns: [
        buildKpiCard('Subjekt údajů', data.personName, data.personEmail || 'Registrovaný uživatel'),
        buildKpiCard(
          'Platnost předpisu od',
          formatDateCzech(doc.validFrom),
          doc.isCurrentlyActive ? 'Stav předpisu: Aktuální' : 'Stav předpisu: Minulé'
        ),
        buildKpiCard(
          'Aktuální stav souhlasu',
          statusText,
          latestSend ? `Poslední změna: ${formatDateTimeCz(latestSend.sentAt)}` : 'Čeká na vyjádření',
          statusColor
        )
      ],
      columnGap: 8,
      margin: [0, 0, 0, 12]
    },
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
      layout: CLEAN_TABLE_LAYOUT
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
