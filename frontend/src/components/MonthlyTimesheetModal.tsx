import { Calendar, Download } from 'lucide-react';
import { Modal, Button, ContractBadge } from './ui';

interface MonthlyTimesheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userRole: string;
  contract: 'HPP' | 'OSVČ';
  dailyHours?: number;
  fundHours?: number;
}

interface TimesheetDay {
  dayNum: number;
  dayName: string;
  isWeekend: boolean;
  isHoliday: boolean;
  clockIn: string;
  clockOut: string;
  hours: number;
  type: string;
}

export function MonthlyTimesheetModal({
  isOpen,
  onClose,
  userName,
  userRole,
  contract,
  dailyHours = 8,
  fundHours
}: MonthlyTimesheetModalProps) {
  if (!isOpen) return null;

  const effectiveDailyHours = dailyHours ?? 8;
  const plannedFundHours = fundHours ?? (21 * effectiveDailyHours);

  // Dynamically generated October 2026 calendar (1st to 31st)
  const days: TimesheetDay[] = Array.from({ length: 31 }, (_, i) => {
    const dayNum = i + 1;
    const date = new Date(2026, 9, dayNum); // October 2026
    const dayIndex = date.getDay(); // 0 = Ne, 6 = So
    const dayNames = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
    const isWeekend = dayIndex === 0 || dayIndex === 6;
    const isHoliday = dayNum === 28; // 28. říjen - Den vzniku samostatného československého státu
    const isVacation = dayNum >= 5 && dayNum <= 8;
    const isDoctor = dayNum === 15;

    const type = isHoliday
      ? 'Státní svátek (28. říjen – Den vzniku ČSR)'
      : isWeekend
      ? 'Víkend'
      : isVacation
      ? 'Dovolená (Řádná)'
      : isDoctor
      ? 'Pracovní den + Lékař (3h)'
      : 'Pracovní den';

    const clockIn = isWeekend || isHoliday || isVacation ? '—' : '08:00';
    const clockOut = isWeekend || isHoliday || isVacation ? '—' : '16:30';
    const hours = isWeekend ? 0 : effectiveDailyHours;

    return {
      dayNum,
      dayName: dayNames[dayIndex],
      isWeekend,
      isHoliday,
      clockIn,
      clockOut,
      hours,
      type
    };
  });

  const totalWorkedHours = days.reduce((acc, d) => acc + d.hours, 0);
  const saldoHours = totalWorkedHours - plannedFundHours;

  const handleExportCsv = () => {
    let csv = 'Den;Datum;Den v tydnu;Prichod;Odchod;Hodiny;Typ\n';
    days.forEach((d) => {
      csv += `${d.dayNum};${d.dayNum}. 10. 2026;${d.dayName};${d.clockIn};${d.clockOut};${d.hours};"${d.type}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dochazka_${userName.replace(' ', '_')}_rijen_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Měsíční docházkový list – Říjen 2026"
      subtitle={
        <div className="flex items-center gap-1.5">
          <span>{userName} ({userRole})</span>
          <ContractBadge contract={contract} />
        </div>
      }
      icon={Calendar}
      iconBgClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
      size="3xl"
      footer={
        <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-zinc-400">
          <div>Podklady pro mzdový software (PAMICA / VEMA / Helios).</div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              icon={Download}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
            <Button
              variant="filled"
              colorKey="primary"
              size="sm"
              onClick={onClose}
            >
              Zavřít
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Monthly Balance Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs flex-shrink-0">
          <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60">
            <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Pracovní fond</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-white">{plannedFundHours.toFixed(1)} h</span>
            <span className="text-[10px] text-slate-500 block">21 prac. dní</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60">
            <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Uznáno celkem</span>
            <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">{totalWorkedHours.toFixed(1)} h</span>
            <span className="text-[10px] text-slate-500 block">Práce + Svátky + Abs.</span>
          </div>

          <div className="p-3 rounded-2xl bg-amber-500/10">
            <span className="text-[10px] uppercase font-mono text-amber-900 dark:text-amber-300 font-bold block">Saldo měsíce</span>
            <span className="text-base font-bold font-mono text-amber-700 dark:text-amber-400">
              {saldoHours >= 0 ? `+${saldoHours.toFixed(1)} h` : `${saldoHours.toFixed(1)} h`}
            </span>
            <span className="text-[10px] text-amber-800/80 dark:text-amber-400 block">Převod do listopadu</span>
          </div>

          <div className="p-3 rounded-2xl bg-sky-500/10 dark:bg-sky-950/30">
            <span className="text-[10px] uppercase font-mono text-sky-900 dark:text-sky-300 font-bold block">Absence / Lékař</span>
            <span className="text-base font-bold font-mono text-sky-700 dark:text-sky-400">4 dny Dov. / 3h Lék.</span>
            <span className="text-[10px] text-sky-800/80 dark:text-sky-400 block">Plně kryto náhradou</span>
          </div>
        </div>

        {/* Scrollable Days Table */}
        <div className="overflow-y-auto max-h-[45vh] rounded-2xl bg-slate-50/50 dark:bg-zinc-800/30">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono text-[11px] border-b border-slate-200/40 dark:border-zinc-700/60">
              <tr>
                <th className="py-2.5 px-3">Datum</th>
                <th className="py-2.5 px-3">Den</th>
                <th className="py-2.5 px-3">Příchod</th>
                <th className="py-2.5 px-3">Odchod</th>
                <th className="py-2.5 px-3">Hodiny</th>
                <th className="py-2.5 px-3">Druh evidence / Popis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 font-mono">
              {days.map((d) => (
                <tr
                  key={d.dayNum}
                  className={`hover:bg-slate-50 dark:hover:bg-zinc-800/50 ${
                    d.isWeekend
                      ? 'bg-slate-50/50 dark:bg-zinc-900/40 text-slate-400 dark:text-zinc-600'
                      : d.isHoliday
                      ? 'bg-amber-500/10 text-amber-900 dark:text-amber-300 font-semibold'
                      : d.type.includes('Dovolená')
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400'
                      : d.type.includes('Lékař')
                      ? 'bg-sky-50/40 dark:bg-sky-950/20 text-sky-800 dark:text-sky-400'
                      : 'text-slate-800 dark:text-zinc-200'
                  }`}
                >
                  <td className="py-2 px-3 font-semibold font-sans">{d.dayNum}. 10. 2026</td>
                  <td className="py-2 px-3">{d.dayName}</td>
                  <td className="py-2 px-3">{d.clockIn}</td>
                  <td className="py-2 px-3">{d.clockOut}</td>
                  <td className="py-2 px-3 font-bold">{d.hours > 0 ? `${d.hours.toFixed(1)} h` : '—'}</td>
                  <td className="py-2 px-3 font-sans text-xs">
                    {d.type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
