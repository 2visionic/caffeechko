using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Dochazka.Api.Data;
using Dochazka.Api.Models;

namespace Dochazka.Api.Controllers;

[ApiController]
[Route("api/closures")]
public class ClosuresController : ControllerBase
{
    private readonly DochazkaDbContext _context;
    private static readonly Guid FallbackOfficerId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    public ClosuresController(DochazkaDbContext context)
    {
        _context = context;
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (Guid.TryParse(claim, out var jwtUserId))
        {
            return jwtUserId;
        }

        if (Request.Headers.TryGetValue("X-User-Id", out var headerVal) &&
            Guid.TryParse(headerVal.FirstOrDefault(), out var headerUserId))
        {
            return headerUserId;
        }

        return null;
    }

    private static DateTime GetShiftOriginLocalDate(TimeEntry entry)
    {
        var localStart = entry.StartTime.ToLocalTime();
        if (localStart.TimeOfDay == TimeSpan.Zero)
        {
            return localStart.Date.AddDays(-1);
        }
        return localStart.Date;
    }

    /// <summary>
    /// Zajistí existenci tabulky monthly_closures v aktivním spojení (pro případ přepnutí DB za běhu).
    /// </summary>
    private async Task EnsureMonthlyClosuresTableAsync()
    {
        try
        {
            var conn = _context.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
            {
                await conn.OpenAsync();
            }
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS monthly_closures (
                    Id TEXT PRIMARY KEY,
                    UserId TEXT NOT NULL,
                    Year INTEGER NOT NULL,
                    Month INTEGER NOT NULL,
                    WorkedHours TEXT NOT NULL DEFAULT '0.00',
                    FundHours TEXT NOT NULL DEFAULT '0.00',
                    OvertimeBalanceHours TEXT NOT NULL DEFAULT '0.00',
                    SaldoUsedHours TEXT NOT NULL DEFAULT '0.00',
                    OvertimeToSaldoHours TEXT NOT NULL DEFAULT '0.00',
                    NetSaldoChangeHours TEXT NOT NULL DEFAULT '0.00',
                    PaidOvertimeHours TEXT NOT NULL DEFAULT '0.00',
                    VerifiedAbsenceIdsJson TEXT NULL,
                    ClosedByUserId TEXT NOT NULL,
                    ClosedAt TEXT NOT NULL,
                    UpdatedAt TEXT NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS IX_monthly_closures_UserId_Year_Month ON monthly_closures (UserId, Year, Month);";
            await cmd.ExecuteNonQueryAsync();
        }
        catch { }
    }

    [HttpGet("overview")]
    public async Task<ActionResult<ApiResponse<MonthlyClosuresOverviewDto>>> GetClosuresOverview(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        await EnsureMonthlyClosuresTableAsync();
        await AttendanceController.AutoCutoffAndSeedSuspiciousShiftsAsync(_context);

        var nowLocal = DateTimeOffset.UtcNow.ToLocalTime();
        var nowUtc = DateTimeOffset.UtcNow;

        var allUsers = await _context.Users
            .Where(u => u.IsApproved)
            .OrderBy(u => u.LastName)
            .ThenBy(u => u.FirstName)
            .ToListAsync();

        var usersById = allUsers.ToDictionary(u => u.Id, u => u);
        var activeUsers = allUsers.Where(u => u.IsActive).ToList();

        var allTimeEntries = await _context.TimeEntries
            .Where(t => !t.IsDeleted)
            .ToListAsync();

        var allAbsences = await _context.AbsenceRequests
            .Where(r => !r.IsDeleted && (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending))
            .ToListAsync();

        var allClosures = await _context.MonthlyClosures.ToListAsync();
        var allSettings = await _context.UserAbsenceSettings.ToListAsync();

        var absenceTypesById = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var workplacesById = await _context.Workplaces.ToDictionaryAsync(w => w.Id, w => w.Name);
        var contractTypesByCode = (await _context.ContractTypes.ToListAsync())
            .GroupBy(ct => ct.Code.ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First());

        var companySetting = await _context.CompanySettings.FirstOrDefaultAsync();
        decimal baseDailyHours = companySetting?.DailyHours ?? 8.00m;
        var allHolidays = await _context.Holidays.ToListAsync();

        // Zjistíme všechny měsíce (Year, Month), kde existuje alespoň 1 presence nebo 1 absence (nebo již existující uzávěrka)
        var candidateMonths = new SortedSet<(int Year, int Month)>();
        candidateMonths.Add((nowLocal.Year, nowLocal.Month));

        foreach (var te in allTimeEntries)
        {
            var d = GetShiftOriginLocalDate(te);
            candidateMonths.Add((d.Year, d.Month));
        }

        foreach (var ar in allAbsences)
        {
            var cur = new DateTime(ar.PlannedStart.Year, ar.PlannedStart.Month, 1);
            var end = new DateTime(ar.PlannedEnd.Year, ar.PlannedEnd.Month, 1);
            while (cur <= end)
            {
                candidateMonths.Add((cur.Year, cur.Month));
                cur = cur.AddMonths(1);
            }
        }

        foreach (var mc in allClosures)
        {
            candidateMonths.Add((mc.Year, mc.Month));
        }

        List<User> GetEligibleUsersForMonth(int y, int m)
        {
            int daysInM = DateTime.DaysInMonth(y, m);
            var mEndDate = new DateTime(y, m, daysInM);
            return activeUsers.Where(u =>
            {
                if (u.EmploymentStartDate.HasValue &&
                    u.EmploymentStartDate.Value.Date > mEndDate)
                {
                    // Pokud osoba nastoupila až po skončení tohoto měsíce, zahrneme ji jen pokud v měsíci má záznam nebo uzávěrku
                    bool hasEntry = allTimeEntries.Any(t => t.UserId == u.Id && GetShiftOriginLocalDate(t).Year == y && GetShiftOriginLocalDate(t).Month == m);
                    bool hasAbs = allAbsences.Any(a => a.UserId == u.Id && a.PlannedStart.Date <= mEndDate && a.PlannedEnd.Date >= new DateTime(y, m, 1));
                    bool hasCl = allClosures.Any(c => c.UserId == u.Id && c.Year == y && c.Month == m);
                    return hasEntry || hasAbs || hasCl;
                }
                return true;
            }).ToList();
        }

        bool MonthHasActivity(int y, int m)
        {
            int daysInM = DateTime.DaysInMonth(y, m);
            var mStart = new DateTime(y, m, 1);
            var mEnd = new DateTime(y, m, daysInM);

            bool hasPresence = allTimeEntries.Any(t =>
            {
                var d = GetShiftOriginLocalDate(t);
                return d.Year == y && d.Month == m;
            });
            if (hasPresence) return true;

            bool hasAbsence = allAbsences.Any(r =>
                r.PlannedStart.Date <= mEnd && r.PlannedEnd.Date >= mStart);
            return hasAbsence;
        }

        var availableMonths = new List<EligibleClosureMonthDto>();
        foreach (var (y, m) in candidateMonths)
        {
            // Pravidlo 3: Uzávěrka měsíce je podmíněna tím, že daný měsíc již skončil (např. za říjen lze uzávěrku udělat až v listopadu a výš)
            if (y > nowLocal.Year || (y == nowLocal.Year && m >= nowLocal.Month))
            {
                continue;
            }

            bool hasActivity = MonthHasActivity(y, m);
            var monthUsers = GetEligibleUsersForMonth(y, m);
            int totalUsers = monthUsers.Count;
            var closuresInMonth = allClosures.Where(c => c.Year == y && c.Month == m).Select(c => c.UserId).ToHashSet();
            int closedCount = monthUsers.Count(u => closuresInMonth.Contains(u.Id));
            int unclosedCount = Math.Max(0, totalUsers - closedCount);
            bool isFullyClosed = hasActivity && totalUsers > 0 && unclosedCount == 0;

            if (hasActivity || closedCount > 0)
            {
                availableMonths.Add(new EligibleClosureMonthDto
                {
                    Year = y,
                    Month = m,
                    HasActivity = hasActivity,
                    TotalUsersCount = totalUsers,
                    ClosedUsersCount = closedCount,
                    UnclosedUsersCount = unclosedCount,
                    IsFullyClosed = isFullyClosed,
                    IsLocked = AttendanceController.IsMonthObmesicLocked(y, m, nowLocal)
                });
            }
        }

        var prevMonthDate = new DateTime(nowLocal.Year, nowLocal.Month, 1).AddMonths(-1);

        // První neuzavřená měsíční uzávěrka (nejstarší ukončený měsíc s alespoň 1 presencí nebo 1 absencí, kde alespoň 1 člověk nemá uzavřenou docházku)
        var firstUnclosed = availableMonths
            .Where(am => am.HasActivity && !am.IsFullyClosed)
            .OrderBy(am => am.Year)
            .ThenBy(am => am.Month)
            .FirstOrDefault()
            ?? availableMonths
                .Where(am => am.HasActivity)
                .OrderByDescending(am => am.Year)
                .ThenByDescending(am => am.Month)
                .FirstOrDefault()
            ?? new EligibleClosureMonthDto
            {
                Year = prevMonthDate.Year,
                Month = prevMonthDate.Month,
                HasActivity = MonthHasActivity(prevMonthDate.Year, prevMonthDate.Month),
                TotalUsersCount = activeUsers.Count,
                ClosedUsersCount = 0,
                UnclosedUsersCount = activeUsers.Count,
                IsFullyClosed = false
            };

        int firstUnclosedYear = firstUnclosed.Year;
        int firstUnclosedMonth = firstUnclosed.Month;

        // Omezení navigace: nelze se prokliknout do vyšší uzávěrky než je první neuzavřená (pouze do historie již uzavřených)
        int selectedYear = year ?? firstUnclosedYear;
        int selectedMonth = month ?? firstUnclosedMonth;
        if (selectedYear > firstUnclosedYear || (selectedYear == firstUnclosedYear && selectedMonth > firstUnclosedMonth))
        {
            selectedYear = firstUnclosedYear;
            selectedMonth = firstUnclosedMonth;
        }

        // Filtrujeme dostupné měsíce pouze do první neuzavřené uzávěrky (včetně) a pouze ty, které mají aktivitu nebo uzávěrku
        var navigableMonths = availableMonths
            .Where(am =>
                (am.HasActivity || am.ClosedUsersCount > 0) &&
                (am.Year < firstUnclosedYear || (am.Year == firstUnclosedYear && am.Month <= firstUnclosedMonth)))
            .OrderBy(am => am.Year)
            .ThenBy(am => am.Month)
            .ToList();

        if (!navigableMonths.Any(am => am.Year == selectedYear && am.Month == selectedMonth))
        {
            selectedYear = firstUnclosedYear;
            selectedMonth = firstUnclosedMonth;
        }

        // Roční uzávěrky: rok se zobrazí / je připraven k roční uzávěrce pouze tehdy, když všechny měsíce v daném roce, co mají uzávěrku (HasActivity), jsou plně uzavřeny
        var yearsGroup = availableMonths
            .Where(am => am.HasActivity)
            .GroupBy(am => am.Year)
            .OrderBy(g => g.Key)
            .ToList();

        var availableYears = new List<EligibleClosureYearDto>();
        foreach (var yg in yearsGroup)
        {
            int y = yg.Key;
            int eligMonths = yg.Count();
            int closedMonths = yg.Count(am => am.IsFullyClosed);
            bool readyForYearly = eligMonths > 0 && closedMonths == eligMonths;
            bool isYearlyClosed = activeUsers.Count > 0 && activeUsers.All(u =>
                allSettings.Any(s => s.UserId == u.Id && s.Year == y && s.IsClosed));

            availableYears.Add(new EligibleClosureYearDto
            {
                Year = y,
                HasActivity = eligMonths > 0,
                EligibleMonthsCount = eligMonths,
                ClosedMonthsCount = closedMonths,
                IsReadyForYearlyClosure = readyForYearly,
                IsYearlyClosed = isYearlyClosed
            });
        }

        // Výpočet detailního přehledu osob pro zvolený měsíc (selectedYear, selectedMonth)
        bool isSelectedMonthEnded = selectedYear < nowLocal.Year || (selectedYear == nowLocal.Year && selectedMonth < nowLocal.Month);
        bool isSelectedMonthLocked = AttendanceController.IsMonthObmesicLocked(selectedYear, selectedMonth, nowLocal);
        bool canCloseSelectedMonth = isSelectedMonthEnded && MonthHasActivity(selectedYear, selectedMonth);
        var eligibleUsersForSelected = GetEligibleUsersForMonth(selectedYear, selectedMonth);

        // Přepočet plovoucích uzávěrek v daném roce pro konzistentní saldo
        await RecalculateYearFloatingClosuresAsync(
            selectedYear,
            eligibleUsersForSelected,
            allTimeEntries,
            allAbsences,
            allClosures,
            absenceTypesById,
            contractTypesByCode,
            allHolidays,
            baseDailyHours,
            nowLocal,
            nowUtc);

        allClosures = await _context.MonthlyClosures
            .Where(mc => mc.Year == selectedYear)
            .ToListAsync();

        var resolvedHolidaysForYear = Dochazka.Api.Services.HolidayService.GetResolvedHolidaysForYear(allHolidays, selectedYear);
        var holidayDates = resolvedHolidaysForYear.Select(h => h.DateOnlyValue).ToHashSet();

        int daysInSelectedMonth = DateTime.DaysInMonth(selectedYear, selectedMonth);
        var monthStartDate = new DateTime(selectedYear, selectedMonth, 1);
        var monthEndDate = new DateTime(selectedYear, selectedMonth, daysInSelectedMonth);
        bool isCurrentMonth = selectedYear == nowLocal.Year && selectedMonth == nowLocal.Month;
        bool isPastMonth = selectedYear < nowLocal.Year || (selectedYear == nowLocal.Year && selectedMonth < nowLocal.Month);
        int cutoffDay = isCurrentMonth ? nowLocal.Day : (isPastMonth ? daysInSelectedMonth : 0);

        // Načtení edit logů pro neověřené přítomnosti ve zvoleném měsíci
        var monthTimeEntries = allTimeEntries
            .Where(t =>
            {
                var d = GetShiftOriginLocalDate(t);
                return d.Year == selectedYear && d.Month == selectedMonth;
            })
            .ToList();

        var monthEntryIds = monthTimeEntries.Select(e => e.Id).ToList();
        var entryEditLogsList = monthEntryIds.Count > 0
            ? await _context.TimeEntryEditLogs.Where(l => monthEntryIds.Contains(l.TimeEntryId)).ToListAsync()
            : new List<TimeEntryEditLog>();

        var editLogsByEntryId = entryEditLogsList
            .GroupBy(l => l.TimeEntryId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(x => x.EditedAt)
                    .Select(x => new RecordEditLogDto
                    {
                        Id = x.Id.ToString(),
                        EditedByUserId = x.EditedByUserId.ToString(),
                        EditedByName = x.EditedByName,
                        EditedAt = x.EditedAt.ToString("o"),
                        Summary = x.Summary
                    })
                    .ToList());

        var peopleDtos = new List<PersonMonthlyClosureItemDto>();

        foreach (var u in eligibleUsersForSelected)
        {
            var cTypeCode = UserDisplayHelper.GetContractTypeCode(u);
            contractTypesByCode.TryGetValue(cTypeCode.ToLowerInvariant(), out var ctSetting);
            decimal coeff = ctSetting?.Coefficient ?? (u.ContractType == ContractType.half_time ? 0.50m : u.ContractType == ContractType.part_time ? 0.25m : 1.00m);
            decimal dailyTarget = Math.Round(baseDailyHours * coeff, 2);

            var uEntries = monthTimeEntries
                .Where(t => t.UserId == u.Id)
                .OrderBy(t => t.StartTime)
                .ToList();

            var uAbsences = allAbsences
                .Where(r => r.UserId == u.Id && r.PlannedStart.Date <= monthEndDate && r.PlannedEnd.Date >= monthStartDate)
                .OrderBy(r => r.PlannedStart)
                .ToList();

            var uApprovedAbsences = uAbsences
                .Where(r => r.Status == AbsenceStatus.completed)
                .ToList();

            double totalSeconds = 0;
            double secondsUpToCutoff = 0;
            var unverifiedDtos = new List<TimeEntryDetailDto>();

            foreach (var e in uEntries)
            {
                var originDate = GetShiftOriginLocalDate(e);
                var end = e.EndTime ?? nowUtc;
                var secs = Math.Max(0, (end - e.StartTime).TotalSeconds);
                totalSeconds += secs;
                if (originDate.Day <= cutoffDay)
                {
                    secondsUpToCutoff += secs;
                }

                // Neověřená přítomnost v kanceláři (LocationType == office && WorkplaceId == null) NEBO podezřelé logování přes půlnoc neukončené do 05:00
                bool isUnverifiedOffice = e.LocationType == LocationType.office && !e.WorkplaceId.HasValue;
                bool isSuspicious = AttendanceController.IsSuspiciousEntry(e);
                if (isUnverifiedOffice || isSuspicious)
                {
                    var localStart = e.StartTime.ToLocalTime();
                    var localEnd = e.EndTime?.ToLocalTime();
                    // Vynecháme půlnoční pokračování 00:00, pokud v témže měsíci existuje předchozí část končící 23:59
                    if (localStart.TimeOfDay == TimeSpan.Zero)
                    {
                        var prevDate = localStart.Date.AddDays(-1);
                        bool hasPrevPart = uEntries.Any(p =>
                            p.Id != e.Id &&
                            p.EndTime.HasValue &&
                            p.EndTime.Value.ToLocalTime().Date == prevDate &&
                            p.EndTime.Value.ToLocalTime().Hour == 23 &&
                            p.EndTime.Value.ToLocalTime().Minute == 59);
                        if (hasPrevPart) continue;
                    }

                    var hours = Math.Round(secs / 3600.0, 2);
                    unverifiedDtos.Add(new TimeEntryDetailDto
                    {
                        Id = e.Id.ToString(),
                        Date = originDate.ToString("yyyy-MM-dd"),
                        StartTime = localStart.ToString("HH:mm"),
                        EndTime = localEnd?.ToString("HH:mm"),
                        Hours = hours,
                        LocationType = e.LocationType == LocationType.office ? "office" : "home_office",
                        WorkplaceId = e.WorkplaceId?.ToString(),
                        WorkplaceName = e.WorkplaceId.HasValue && workplacesById.TryGetValue(e.WorkplaceId.Value, out var wpName) ? wpName : null,
                        IsManual = e.IsManual,
                        IsSuspicious = isSuspicious,
                        EditedBy = e.EditedBy?.ToString(),
                        EditedAt = e.EditedAt,
                        EditReason = e.EditReason,
                        EditLogs = editLogsByEntryId.TryGetValue(e.Id, out var logs) ? logs : new List<RecordEditLogDto>()
                    });
                }
            }

            int workDays = 0;
            decimal deductedHours = 0m;
            int workDaysUpToCutoff = 0;
            decimal deductedHoursUpToCutoff = 0m;

            int illnessDays = 0;
            int ocrDays = 0;
            int vacationDays = 0;
            int sickDays = 0;
            int unpaidLeaveDays = 0;
            int compensatoryLeaveDays = 0;
            int approvedCompensatoryDays = 0;
            double doctorHours = 0;

            for (int d = 1; d <= daysInSelectedMonth; d++)
            {
                var dt = new DateOnly(selectedYear, selectedMonth, d);
                var dayDate = new DateTime(selectedYear, selectedMonth, d);
                var dow = dayDate.DayOfWeek;
                bool isWorkingDay = dow != DayOfWeek.Saturday && dow != DayOfWeek.Sunday && !holidayDates.Contains(dt);

                if (isWorkingDay)
                {
                    workDays++;
                    decimal dayDeducted = 0m;

                    bool hasIllness = false;
                    bool hasOcr = false;
                    bool hasVacation = false;
                    bool hasSickDay = false;
                    bool hasUnpaid = false;
                    bool hasCompensatory = false;
                    bool hasApprovedCompensatory = false;

                    foreach (var req in uAbsences)
                    {
                        if (req.PlannedStart.Date <= dayDate && req.PlannedEnd.Date >= dayDate &&
                            absenceTypesById.TryGetValue(req.AbsenceTypeId, out var absType))
                        {
                            var code = absType.Code.ToLowerInvariant();
                            if (code == "illness") hasIllness = true;
                            else if (code == "ocr") hasOcr = true;
                            else if (code == "vacation") hasVacation = true;
                            else if (code == "sick_day") hasSickDay = true;
                            else if (code == "unpaid_leave") hasUnpaid = true;
                            else if (code == "compensatory_leave" || absType.DrawsFromSaldo)
                            {
                                hasCompensatory = true;
                                if (req.Status == AbsenceStatus.completed) hasApprovedCompensatory = true;
                            }

                            if (req.Status == AbsenceStatus.completed && absType.IsPaid && !absType.IsWorkMode)
                            {
                                if (absType.DurationMode == DurationMode.hours)
                                {
                                    var durHours = (decimal)Math.Max(0, (req.PlannedEnd - req.PlannedStart).TotalHours);
                                    dayDeducted += durHours;
                                }
                                else
                                {
                                    dayDeducted += dailyTarget;
                                }
                            }
                        }
                    }

                    if (hasIllness) illnessDays++;
                    if (hasOcr) ocrDays++;
                    if (hasVacation) vacationDays++;
                    if (hasSickDay) sickDays++;
                    if (hasUnpaid) unpaidLeaveDays++;
                    if (hasCompensatory) compensatoryLeaveDays++;
                    if (hasApprovedCompensatory) approvedCompensatoryDays++;

                    if (dayDeducted > dailyTarget) dayDeducted = dailyTarget;
                    deductedHours += dayDeducted;

                    if (d <= cutoffDay)
                    {
                        workDaysUpToCutoff++;
                        deductedHoursUpToCutoff += dayDeducted;
                    }
                }
            }

            // Hodiny lékaře v daném měsíci
            foreach (var req in uAbsences)
            {
                if (absenceTypesById.TryGetValue(req.AbsenceTypeId, out var absType) &&
                    absType.Code.Equals("doctor", StringComparison.OrdinalIgnoreCase))
                {
                    var dur = Math.Max(0, (req.PlannedEnd - req.PlannedStart).TotalHours);
                    doctorHours += Math.Round(dur, 2);
                }
            }

            decimal fullFundHours = Math.Max(0m, Math.Round(workDays * dailyTarget - deductedHours, 2));
            decimal cutoffFundHours = Math.Max(0m, Math.Round(workDaysUpToCutoff * dailyTarget - deductedHoursUpToCutoff, 2));

            decimal workedHoursDec = (decimal)Math.Round(totalSeconds / 3600.0, 2);
            decimal workedUpToCutoffDec = (decimal)Math.Round(secondsUpToCutoff / 3600.0, 2);

            decimal effectiveFundForBalance = isCurrentMonth ? cutoffFundHours : fullFundHours;
            decimal effectiveWorkedForBalance = isCurrentMonth ? workedUpToCutoffDec : workedHoursDec;
            decimal overtimeBalanceDec = Math.Round(effectiveWorkedForBalance - effectiveFundForBalance, 2);

            // Pravidlo 2: Saldo z předchozích měsíců (< selectedMonth) + saldo k danému měsíci (součet z předchozích a aktuálního, tj. <= selectedMonth)
            var prevClosuresInYear = allClosures
                .Where(mc => mc.UserId == u.Id && mc.Year == selectedYear && mc.Month < selectedMonth)
                .OrderBy(mc => mc.Month)
                .ToList();

            decimal incomingSaldoDec = 0m;
            foreach (var pc in prevClosuresInYear)
            {
                incomingSaldoDec += pc.NetSaldoChangeHours;
            }
            incomingSaldoDec -= approvedCompensatoryDays * dailyTarget;
            if (incomingSaldoDec < 0m) incomingSaldoDec = 0m;

            var existingClosure = allClosures.FirstOrDefault(mc =>
                mc.UserId == u.Id && mc.Year == selectedYear && mc.Month == selectedMonth);

            // Pravidlo 6: Saldo se dopočítává vždy k danému měsíci součtem z uzavřených měsíčních uzávěrek předchozích měsíců (< selectedMonth)
            decimal carriedOverSaldoDec = incomingSaldoDec;
            if (carriedOverSaldoDec < 0m) carriedOverSaldoDec = 0m;

            var verifiedIdsSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (existingClosure != null && !string.IsNullOrWhiteSpace(existingClosure.VerifiedAbsenceIdsJson))
            {
                try
                {
                    var parsedIds = JsonSerializer.Deserialize<List<string>>(existingClosure.VerifiedAbsenceIdsJson);
                    if (parsedIds != null)
                    {
                        foreach (var idStr in parsedIds) verifiedIdsSet.Add(idStr);
                    }
                }
                catch { }
            }

            // Absence pro 2. krok uzávěrky (checklist dokumentů + informativní přehled sick_day / dovolená / neplacené volno)
            var checklistItems = new List<ClosureAbsenceChecklistItemDto>();
            foreach (var req in uAbsences)
            {
                if (!absenceTypesById.TryGetValue(req.AbsenceTypeId, out var absType)) continue;
                var code = absType.Code.ToLowerInvariant();
                if (absType.IsWorkMode || code == "home_office") continue;

                var effStart = req.PlannedStart.Date < monthStartDate ? monthStartDate : req.PlannedStart.Date;
                var effEnd = req.PlannedEnd.Date > monthEndDate ? monthEndDate : req.PlannedEnd.Date;

                int reqWorkDays = 0;
                double reqHours = 0;
                if (absType.DurationMode == DurationMode.hours || code == "doctor")
                {
                    reqHours = Math.Round(Math.Max(0, (req.PlannedEnd - req.PlannedStart).TotalHours), 2);
                }
                else
                {
                    for (var curD = effStart; curD <= effEnd; curD = curD.AddDays(1))
                    {
                        var curDo = DateOnly.FromDateTime(curD);
                        if (curD.DayOfWeek != DayOfWeek.Saturday &&
                            curD.DayOfWeek != DayOfWeek.Sunday &&
                            !holidayDates.Contains(curDo))
                        {
                            reqWorkDays++;
                        }
                    }
                }

                bool requiresCheck = code == "illness" || code == "doctor" || code == "ocr";
                string? checkLabel = code switch
                {
                    "illness" => "eNeschopenka doložena",
                    "doctor" => "Propustka doložena",
                    "ocr" => "Žádost o ošetřovné doložena",
                    _ => null
                };

                checklistItems.Add(new ClosureAbsenceChecklistItemDto
                {
                    Id = req.Id.ToString(),
                    TypeCode = code,
                    TypeName = absType.GetDisplayName(u.ContractKind),
                    StartDate = effStart.ToString("yyyy-MM-dd"),
                    EndDate = effEnd.ToString("yyyy-MM-dd"),
                    StartTime = (absType.DurationMode == DurationMode.hours || code == "doctor")
                        ? req.PlannedStart.ToLocalTime().ToString("HH:mm")
                        : null,
                    EndTime = (absType.DurationMode == DurationMode.hours || code == "doctor")
                        ? req.PlannedEnd.ToLocalTime().ToString("HH:mm")
                        : null,
                    DaysCount = reqWorkDays,
                    HoursCount = reqHours,
                    Note = req.Note,
                    RequiresChecklist = requiresCheck,
                    ChecklistLabel = checkLabel,
                    IsVerified = !requiresCheck || existingClosure != null || verifiedIdsSet.Contains(req.Id.ToString())
                });
            }

            MonthlyClosureRecordDto? closureRecordDto = null;
            if (existingClosure != null)
            {
                usersById.TryGetValue(existingClosure.ClosedByUserId, out var closedByUser);
                closureRecordDto = new MonthlyClosureRecordDto
                {
                    Id = existingClosure.Id.ToString(),
                    UserId = existingClosure.UserId.ToString(),
                    Year = existingClosure.Year,
                    Month = existingClosure.Month,
                    WorkedHours = (double)existingClosure.WorkedHours,
                    FundHours = (double)existingClosure.FundHours,
                    OvertimeBalanceHours = (double)existingClosure.OvertimeBalanceHours,
                    SaldoUsedHours = (double)existingClosure.SaldoUsedHours,
                    OvertimeToSaldoHours = (double)existingClosure.OvertimeToSaldoHours,
                    NetSaldoChangeHours = (double)existingClosure.NetSaldoChangeHours,
                    PaidOvertimeHours = (double)existingClosure.PaidOvertimeHours,
                    VerifiedAbsenceIds = verifiedIdsSet.ToList(),
                    ClosedByUserId = existingClosure.ClosedByUserId.ToString(),
                    ClosedByName = closedByUser?.DisplayName ?? "Office Manager",
                    ClosedAt = existingClosure.ClosedAt.ToString("o"),
                    UpdatedAt = existingClosure.UpdatedAt.ToString("o")
                };
            }

            var contractTypeNamesMap = contractTypesByCode.ToDictionary(k => k.Key, v => v.Value.Name);

            var compTypeObj = absenceTypesById.Values.FirstOrDefault(t => string.Equals(t.Code, "compensatory_leave", StringComparison.OrdinalIgnoreCase));
            var uCompSetting = compTypeObj != null
                ? (allSettings.FirstOrDefault(s => s.UserId == u.Id && s.AbsenceTypeId == compTypeObj.Id && s.Year == selectedYear)
                   ?? allSettings.Where(s => s.UserId == u.Id && s.AbsenceTypeId == compTypeObj.Id).OrderByDescending(s => s.Year).FirstOrDefault())
                : null;
            bool compLeaveEnabled = u.ContractKind != ContractKind.osvc &&
                uCompSetting != null &&
                uCompSetting.AllocatedCapacity.HasValue &&
                uCompSetting.AllocatedCapacity.Value > 0m;

            peopleDtos.Add(new PersonMonthlyClosureItemDto
            {
                UserId = u.Id.ToString(),
                FullName = u.DisplayName,
                Email = u.Email,
                Role = u.Role.ToString(),
                RoleLabel = UserDisplayHelper.GetRoleLabelCzech(u.Role),
                Contract = u.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
                ContractType = cTypeCode,
                ContractTypeName = UserDisplayHelper.GetContractDisplayLabel(u.ContractKind, u.ContractType, contractTypeNamesMap, u.ContractTypeCode),
                IsPermanentHomeOffice = u.IsPermanentHomeOffice,
                DailyTargetHours = (double)dailyTarget,
                Year = selectedYear,
                Month = selectedMonth,
                WorkedHours = (double)workedHoursDec,
                FundHours = (double)fullFundHours,
                OvertimeBalanceHours = (double)overtimeBalanceDec,
                IncomingSaldoHours = (double)Math.Round(incomingSaldoDec, 2),
                CarriedOverSaldoHours = (double)Math.Round(carriedOverSaldoDec, 2),
                UnverifiedPresencesCount = unverifiedDtos.Count,
                UnverifiedPresences = unverifiedDtos,
                IllnessDays = illnessDays,
                OcrDays = ocrDays,
                VacationDays = vacationDays,
                SickDays = sickDays,
                DoctorHours = Math.Round(doctorHours, 2),
                UnpaidLeaveDays = unpaidLeaveDays,
                CompensatoryLeaveDays = compensatoryLeaveDays,
                CompensatoryLeaveEnabled = compLeaveEnabled,
                AbsencesForChecklist = checklistItems,
                IsClosed = existingClosure != null,
                IsLocked = isSelectedMonthLocked,
                ClosureRecord = closureRecordDto
            });
        }

        return Ok(ApiResponse<MonthlyClosuresOverviewDto>.Success(new MonthlyClosuresOverviewDto
        {
            SelectedYear = selectedYear,
            SelectedMonth = selectedMonth,
            FirstUnclosedYear = firstUnclosedYear,
            FirstUnclosedMonth = firstUnclosedMonth,
            CanCloseSelectedMonth = canCloseSelectedMonth,
            IsSelectedMonthLocked = isSelectedMonthLocked,
            AvailableMonths = navigableMonths,
            AvailableYears = availableYears,
            People = peopleDtos
        }));
    }

    [HttpPost("monthly")]
    public async Task<ActionResult<ApiResponse<MonthlyClosureRecordDto>>> SavePersonMonthlyClosure(
        [FromBody] SavePersonMonthlyClosureDto dto)
    {
        await EnsureMonthlyClosuresTableAsync();

        var callerId = dto.ClosedByUserId ?? GetCurrentUserId() ?? FallbackOfficerId;
        var caller = await _context.Users.FindAsync(callerId);
        if (caller == null || (caller.Role != UserRole.office_manager && caller.Role != UserRole.admin))
        {
            return StatusCode(403, ApiResponse<MonthlyClosureRecordDto>.Failure(
                "ERR_FORBIDDEN",
                "Měsíční uzávěrky může provádět pouze Office Manager (nebo Administrátor)."));
        }

        var user = await _context.Users.FindAsync(dto.UserId);
        if (user == null)
        {
            return NotFound(ApiResponse<MonthlyClosureRecordDto>.Failure("ERR_USER_NOT_FOUND", "Osoba nebyla nalezena."));
        }

        if (dto.Month < 1 || dto.Month > 12 || dto.Year < 2000 || dto.Year > 2100)
        {
            return BadRequest(ApiResponse<MonthlyClosureRecordDto>.Failure("ERR_INVALID_PERIOD", "Neplatný měsíc nebo rok uzávěrky."));
        }

        var nowCheckLocal = DateTimeOffset.UtcNow.ToLocalTime();
        if (dto.Year > nowCheckLocal.Year || (dto.Year == nowCheckLocal.Year && dto.Month >= nowCheckLocal.Month))
        {
            return BadRequest(ApiResponse<MonthlyClosureRecordDto>.Failure(
                "ERR_MONTH_NOT_ENDED",
                "Měsíční uzávěrku lze provést až po skončení daného měsíce."));
        }

        if (AttendanceController.IsMonthObmesicLocked(dto.Year, dto.Month, nowCheckLocal))
        {
            return BadRequest(ApiResponse<MonthlyClosureRecordDto>.Failure(
                "ERR_CLOSURE_LOCKED",
                "Uzávěrky starší než předchozí měsíc (obměsíc) jsou automaticky uzamčeny a nelze je měnit."));
        }

        int daysInMonth = DateTime.DaysInMonth(dto.Year, dto.Month);
        var monthStart = new DateTime(dto.Year, dto.Month, 1);
        var monthEnd = new DateTime(dto.Year, dto.Month, daysInMonth);

        var allTimeEntriesInMonth = await _context.TimeEntries
            .Where(t => !t.IsDeleted)
            .ToListAsync();

        bool hasPresenceInMonth = allTimeEntriesInMonth.Any(t =>
        {
            var d = GetShiftOriginLocalDate(t);
            return d.Year == dto.Year && d.Month == dto.Month;
        });

        var allAbsencesInMonth = (await _context.AbsenceRequests
            .Where(r => !r.IsDeleted && (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending))
            .ToListAsync())
            .Where(r => r.PlannedStart.Date <= monthEnd && r.PlannedEnd.Date >= monthStart)
            .ToList();

        if (!hasPresenceInMonth && allAbsencesInMonth.Count == 0)
        {
            return BadRequest(ApiResponse<MonthlyClosureRecordDto>.Failure(
                "ERR_MONTH_EMPTY",
                "Měsíční uzávěrku daného měsíce lze provést pouze tehdy, pokud v daném měsíci existuje alespoň 1 přítomnost nebo 1 absence."));
        }

        // 1. Kontrola, že u dané osoby nezůstaly neověřené přítomnosti
        var userMonthEntries = allTimeEntriesInMonth
            .Where(t => t.UserId == dto.UserId)
            .Where(t =>
            {
                var d = GetShiftOriginLocalDate(t);
                return d.Year == dto.Year && d.Month == dto.Month;
            })
            .ToList();

        bool hasUnverifiedPresence = userMonthEntries.Any(e =>
        {
            if (AttendanceController.IsSuspiciousEntry(e)) return true;
            if (e.LocationType != LocationType.office || e.WorkplaceId.HasValue) return false;
            var localStart = e.StartTime.ToLocalTime();
            if (localStart.TimeOfDay == TimeSpan.Zero)
            {
                var prevDate = localStart.Date.AddDays(-1);
                bool hasPrevPart = userMonthEntries.Any(p =>
                    p.Id != e.Id &&
                    p.EndTime.HasValue &&
                    p.EndTime.Value.ToLocalTime().Date == prevDate &&
                    p.EndTime.Value.ToLocalTime().Hour == 23 &&
                    p.EndTime.Value.ToLocalTime().Minute == 59);
                if (hasPrevPart) return false;
            }
            return true;
        });

        if (hasUnverifiedPresence)
        {
            return BadRequest(ApiResponse<MonthlyClosureRecordDto>.Failure(
                "ERR_UNVERIFIED_PRESENCES",
                "Před uložením uzávěrky je nutné v 1. kroku vyřešit (ověřit, upravit nebo smazat) všechny neověřené přítomnosti."));
        }

        // 2. Kontrola checklistu absencí v kompetenci officera (illness, doctor, ocr)
        var absenceTypesById = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var userMonthAbsences = allAbsencesInMonth.Where(r => r.UserId == dto.UserId).ToList();
        var verifiedSet = new HashSet<string>(dto.VerifiedAbsenceIds ?? new List<string>(), StringComparer.OrdinalIgnoreCase);

        var nowUtc = DateTimeOffset.UtcNow;
        foreach (var abs in userMonthAbsences)
        {
            if (!absenceTypesById.TryGetValue(abs.AbsenceTypeId, out var absType)) continue;
            var code = absType.Code.ToLowerInvariant();
            if (code == "illness" || code == "doctor" || code == "ocr")
            {
                if (!verifiedSet.Contains(abs.Id.ToString()))
                {
                    return BadRequest(ApiResponse<MonthlyClosureRecordDto>.Failure(
                        "ERR_CHECKLIST_INCOMPLETE",
                        "Před uložením uzávěrky je nutné ve 2. kroku potvrdit doložení všech požadovaných dokladů u absencí (eNeschopenka, propustka lékaře, žádost OČR)."));
                }

                // Pokud byla absence čekající, schválíme ji v rámci uzávěrky
                if (abs.Status == AbsenceStatus.pending)
                {
                    abs.Status = AbsenceStatus.completed;
                    abs.ApprovedBy = caller.Id;
                    abs.ApprovedAt = nowUtc;
                }
            }
        }

        // 3. Výpočet fondu, odpracovaných hodin, přesčasového balance a konta salda
        var companySetting = await _context.CompanySettings.FirstOrDefaultAsync();
        decimal baseDailyHours = companySetting?.DailyHours ?? 8.00m;
        var cTypeCode = UserDisplayHelper.GetContractTypeCode(user);
        var ctSetting = await _context.ContractTypes.FirstOrDefaultAsync(ct => ct.Code.ToLower() == cTypeCode.ToLower());
        decimal coeff = ctSetting?.Coefficient ?? (user.ContractType == ContractType.half_time ? 0.50m : user.ContractType == ContractType.part_time ? 0.25m : 1.00m);
        decimal dailyTarget = Math.Round(baseDailyHours * coeff, 2);

        var allHolidays = await _context.Holidays.ToListAsync();
        var holidayDates = Dochazka.Api.Services.HolidayService.GetResolvedHolidaysForYear(allHolidays, dto.Year)
            .Select(h => h.DateOnlyValue)
            .ToHashSet();

        var nowLocal = nowUtc.ToLocalTime();
        bool isCurrentMonth = dto.Year == nowLocal.Year && dto.Month == nowLocal.Month;
        bool isPastMonth = dto.Year < nowLocal.Year || (dto.Year == nowLocal.Year && dto.Month < nowLocal.Month);
        int cutoffDay = isCurrentMonth ? nowLocal.Day : (isPastMonth ? daysInMonth : 0);

        double totalSeconds = 0;
        double secondsUpToCutoff = 0;
        foreach (var e in userMonthEntries)
        {
            var originDate = GetShiftOriginLocalDate(e);
            var end = e.EndTime ?? nowUtc;
            var secs = Math.Max(0, (end - e.StartTime).TotalSeconds);
            totalSeconds += secs;
            if (originDate.Day <= cutoffDay)
            {
                secondsUpToCutoff += secs;
            }
        }

        int workDays = 0;
        decimal deductedHours = 0m;
        int workDaysUpToCutoff = 0;
        decimal deductedHoursUpToCutoff = 0m;

        for (int d = 1; d <= daysInMonth; d++)
        {
            var dt = new DateOnly(dto.Year, dto.Month, d);
            var dayDate = new DateTime(dto.Year, dto.Month, d);
            var dow = dayDate.DayOfWeek;
            if (dow != DayOfWeek.Saturday && dow != DayOfWeek.Sunday && !holidayDates.Contains(dt))
            {
                workDays++;
                decimal dayDeducted = 0m;
                foreach (var req in userMonthAbsences.Where(r => r.Status == AbsenceStatus.completed))
                {
                    if (req.PlannedStart.Date <= dayDate && req.PlannedEnd.Date >= dayDate &&
                        absenceTypesById.TryGetValue(req.AbsenceTypeId, out var absType) &&
                        absType.IsPaid && !absType.IsWorkMode)
                    {
                        if (absType.DurationMode == DurationMode.hours)
                        {
                            var durHours = (decimal)Math.Max(0, (req.PlannedEnd - req.PlannedStart).TotalHours);
                            dayDeducted += durHours;
                        }
                        else
                        {
                            dayDeducted += dailyTarget;
                        }
                    }
                }
                if (dayDeducted > dailyTarget) dayDeducted = dailyTarget;
                deductedHours += dayDeducted;

                if (d <= cutoffDay)
                {
                    workDaysUpToCutoff++;
                    deductedHoursUpToCutoff += dayDeducted;
                }
            }
        }

        decimal fullFundHours = Math.Max(0m, Math.Round(workDays * dailyTarget - deductedHours, 2));
        decimal cutoffFundHours = Math.Max(0m, Math.Round(workDaysUpToCutoff * dailyTarget - deductedHoursUpToCutoff, 2));

        decimal workedHoursDec = (decimal)Math.Round(totalSeconds / 3600.0, 2);
        decimal workedUpToCutoffDec = (decimal)Math.Round(secondsUpToCutoff / 3600.0, 2);

        decimal effectiveFund = isCurrentMonth ? cutoffFundHours : fullFundHours;
        decimal effectiveWorked = isCurrentMonth ? workedUpToCutoffDec : workedHoursDec;
        decimal overtimeBalanceDec = Math.Round(effectiveWorked - effectiveFund, 2);

        // Dostupné konto salda z předchozích uzavřených měsíců v daném roce
        var prevClosures = await _context.MonthlyClosures
            .Where(mc => mc.UserId == dto.UserId && mc.Year == dto.Year && mc.Month < dto.Month)
            .OrderBy(mc => mc.Month)
            .ToListAsync();

        decimal availableSaldo = 0m;
        foreach (var pc in prevClosures)
        {
            availableSaldo += pc.NetSaldoChangeHours;
        }
        if (availableSaldo < 0m) availableSaldo = 0m;

        decimal saldoUsed = Math.Max(0m, Math.Round(dto.SaldoUsedHours, 2));
        if (saldoUsed > availableSaldo + 0.02m)
        {
            return BadRequest(ApiResponse<MonthlyClosureRecordDto>.Failure(
                "ERR_SALDO_EXCEEDED",
                $"Nelze čerpat více ze salda ({saldoUsed:0.##} h), než je aktuálně dostupné v kontu salda ({availableSaldo:0.##} h)."));
        }
        if (saldoUsed > availableSaldo) saldoUsed = availableSaldo;

        decimal balanceAfterSaldoUsed = overtimeBalanceDec + saldoUsed;
        decimal maxTransferToSaldo = Math.Max(0m, balanceAfterSaldoUsed);
        decimal overtimeToSaldo = Math.Max(0m, Math.Round(dto.OvertimeToSaldoHours, 2));
        if (overtimeToSaldo > maxTransferToSaldo + 0.02m)
        {
            return BadRequest(ApiResponse<MonthlyClosureRecordDto>.Failure(
                "ERR_OVERTIME_EXCEEDED",
                $"Do konta salda nelze převést více hodin ({overtimeToSaldo:0.##} h), než je dostupný kladný přesčas ({maxTransferToSaldo:0.##} h)."));
        }
        if (overtimeToSaldo > maxTransferToSaldo) overtimeToSaldo = maxTransferToSaldo;

        decimal netSaldoChange = Math.Round(overtimeToSaldo - saldoUsed, 2);
        decimal paidOvertime = Math.Round(overtimeBalanceDec + saldoUsed - overtimeToSaldo, 2);

        var existing = await _context.MonthlyClosures
            .FirstOrDefaultAsync(mc => mc.UserId == dto.UserId && mc.Year == dto.Year && mc.Month == dto.Month);

        var verifiedJson = JsonSerializer.Serialize(verifiedSet.ToList());

        if (existing == null)
        {
            existing = new MonthlyClosure
            {
                Id = Guid.NewGuid(),
                UserId = dto.UserId,
                Year = dto.Year,
                Month = dto.Month,
                WorkedHours = workedHoursDec,
                FundHours = fullFundHours,
                OvertimeBalanceHours = overtimeBalanceDec,
                SaldoUsedHours = saldoUsed,
                OvertimeToSaldoHours = overtimeToSaldo,
                NetSaldoChangeHours = netSaldoChange,
                PaidOvertimeHours = paidOvertime,
                VerifiedAbsenceIdsJson = verifiedJson,
                ClosedByUserId = caller.Id,
                ClosedAt = nowUtc,
                UpdatedAt = nowUtc
            };
            _context.MonthlyClosures.Add(existing);
        }
        else
        {
            existing.WorkedHours = workedHoursDec;
            existing.FundHours = fullFundHours;
            existing.OvertimeBalanceHours = overtimeBalanceDec;
            existing.SaldoUsedHours = saldoUsed;
            existing.OvertimeToSaldoHours = overtimeToSaldo;
            existing.NetSaldoChangeHours = netSaldoChange;
            existing.PaidOvertimeHours = paidOvertime;
            existing.VerifiedAbsenceIdsJson = verifiedJson;
            existing.ClosedByUserId = caller.Id;
            existing.UpdatedAt = nowUtc;
        }

        await _context.SaveChangesAsync();

        // Pokud existují navazující uzavřené měsíce v témže roce, přepočítáme jejich plovoucí hodnoty
        var laterClosures = await _context.MonthlyClosures
            .Where(mc => mc.UserId == dto.UserId && mc.Year == dto.Year && mc.Month > dto.Month)
            .OrderBy(mc => mc.Month)
            .ToListAsync();

        if (laterClosures.Count > 0)
        {
            decimal runningSaldo = availableSaldo + netSaldoChange;
            if (runningSaldo < 0m) runningSaldo = 0m;

            foreach (var lc in laterClosures)
            {
                if (lc.SaldoUsedHours > runningSaldo)
                {
                    lc.SaldoUsedHours = runningSaldo;
                }
                decimal maxToSaldo = Math.Max(0m, lc.OvertimeBalanceHours + lc.SaldoUsedHours);
                if (lc.OvertimeToSaldoHours > maxToSaldo)
                {
                    lc.OvertimeToSaldoHours = maxToSaldo;
                }
                lc.NetSaldoChangeHours = Math.Round(lc.OvertimeToSaldoHours - lc.SaldoUsedHours, 2);
                lc.PaidOvertimeHours = Math.Round(lc.OvertimeBalanceHours + lc.SaldoUsedHours - lc.OvertimeToSaldoHours, 2);
                runningSaldo = Math.Max(0m, runningSaldo + lc.NetSaldoChangeHours);
            }
            await _context.SaveChangesAsync();
        }

        return Ok(ApiResponse<MonthlyClosureRecordDto>.Success(new MonthlyClosureRecordDto
        {
            Id = existing.Id.ToString(),
            UserId = existing.UserId.ToString(),
            Year = existing.Year,
            Month = existing.Month,
            WorkedHours = (double)existing.WorkedHours,
            FundHours = (double)existing.FundHours,
            OvertimeBalanceHours = (double)existing.OvertimeBalanceHours,
            SaldoUsedHours = (double)existing.SaldoUsedHours,
            OvertimeToSaldoHours = (double)existing.OvertimeToSaldoHours,
            NetSaldoChangeHours = (double)existing.NetSaldoChangeHours,
            PaidOvertimeHours = (double)existing.PaidOvertimeHours,
            VerifiedAbsenceIds = verifiedSet.ToList(),
            ClosedByUserId = caller.Id.ToString(),
            ClosedByName = caller.DisplayName,
            ClosedAt = existing.ClosedAt.ToString("o"),
            UpdatedAt = existing.UpdatedAt.ToString("o")
        }));
    }

    /// <summary>
    /// Pravidlo 6: Smazání záznamu měsíční uzávěrky osoby (vrátí osobu mezi neuzavřené a přepočte plovoucí saldo v roce).
    /// </summary>
    [HttpPost("monthly/{id}/delete")]
    public async Task<ActionResult<ApiResponse<bool>>> DeletePersonMonthlyClosure(
        [FromRoute] Guid id,
        [FromBody] DeleteMonthlyClosureDto? dto)
    {
        await EnsureMonthlyClosuresTableAsync();

        var callerId = dto?.DeletedByUserId ?? GetCurrentUserId() ?? FallbackOfficerId;
        var caller = await _context.Users.FindAsync(callerId);
        if (caller == null || (caller.Role != UserRole.office_manager && caller.Role != UserRole.admin))
        {
            return StatusCode(403, ApiResponse<bool>.Failure(
                "ERR_FORBIDDEN",
                "Mazat měsíční uzávěrky může pouze Office Manager (nebo Administrátor)."));
        }

        var existing = await _context.MonthlyClosures.FindAsync(id);
        if (existing == null)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_NOT_FOUND", "Záznam měsíční uzávěrky nebyl nalezen."));
        }

        if (AttendanceController.IsMonthObmesicLocked(existing.Year, existing.Month, DateTimeOffset.UtcNow.ToLocalTime()))
        {
            return BadRequest(ApiResponse<bool>.Failure(
                "ERR_CLOSURE_LOCKED",
                "Uzávěrky starší než předchozí měsíc (obměsíc) jsou automaticky uzamčeny a nelze je smazat."));
        }

        var userId = existing.UserId;
        var year = existing.Year;

        _context.MonthlyClosures.Remove(existing);
        await _context.SaveChangesAsync();

        // Přepočet zbývajících uzávěrek dané osoby v témže roce
        var remainingInYear = await _context.MonthlyClosures
            .Where(mc => mc.UserId == userId && mc.Year == year)
            .OrderBy(mc => mc.Month)
            .ToListAsync();

        if (remainingInYear.Count > 0)
        {
            decimal runningSaldo = 0m;
            foreach (var lc in remainingInYear)
            {
                if (lc.SaldoUsedHours > runningSaldo)
                {
                    lc.SaldoUsedHours = runningSaldo;
                }
                decimal maxToSaldo = Math.Max(0m, lc.OvertimeBalanceHours + lc.SaldoUsedHours);
                if (lc.OvertimeToSaldoHours > maxToSaldo)
                {
                    lc.OvertimeToSaldoHours = maxToSaldo;
                }
                lc.NetSaldoChangeHours = Math.Round(lc.OvertimeToSaldoHours - lc.SaldoUsedHours, 2);
                lc.PaidOvertimeHours = Math.Round(lc.OvertimeBalanceHours + lc.SaldoUsedHours - lc.OvertimeToSaldoHours, 2);
                runningSaldo = Math.Max(0m, runningSaldo + lc.NetSaldoChangeHours);
            }
            await _context.SaveChangesAsync();
        }

        return Ok(ApiResponse<bool>.Success(true));
    }

    /// <summary>
    /// Pravidlo 8: Automatická uzávěrka – u lidí, kteří v daném měsíci ještě nemají uzávěrku,
    /// automaticky ověří všechny neověřené přítomnosti, potvrdí doklady absencí,
    /// u chybějícího času vezme ze salda pouze doplnění času (pokud saldo existuje) a kladný přesčas celý převede do konta salda.
    /// </summary>
    [HttpPost("monthly/auto")]
    public async Task<ActionResult<ApiResponse<int>>> AutoCloseMonth([FromBody] AutoCloseMonthDto dto)
    {
        await EnsureMonthlyClosuresTableAsync();

        var callerId = dto.ClosedByUserId ?? GetCurrentUserId() ?? FallbackOfficerId;
        var caller = await _context.Users.FindAsync(callerId);
        if (caller == null || (caller.Role != UserRole.office_manager && caller.Role != UserRole.admin))
        {
            return StatusCode(403, ApiResponse<int>.Failure(
                "ERR_FORBIDDEN",
                "Automatickou uzávěrku může provést pouze Office Manager (nebo Administrátor)."));
        }

        var nowUtc = DateTimeOffset.UtcNow;
        var nowLocal = nowUtc.ToLocalTime();

        if (dto.Month < 1 || dto.Month > 12 || dto.Year < 2000 || dto.Year > 2100)
        {
            return BadRequest(ApiResponse<int>.Failure("ERR_INVALID_PERIOD", "Neplatný měsíc nebo rok uzávěrky."));
        }

        if (dto.Year > nowLocal.Year || (dto.Year == nowLocal.Year && dto.Month >= nowLocal.Month))
        {
            return BadRequest(ApiResponse<int>.Failure(
                "ERR_MONTH_NOT_ENDED",
                "Měsíční uzávěrku lze provést až po skončení daného měsíce."));
        }

        if (AttendanceController.IsMonthObmesicLocked(dto.Year, dto.Month, nowLocal))
        {
            return BadRequest(ApiResponse<int>.Failure(
                "ERR_CLOSURE_LOCKED",
                "Uzávěrky starší než předchozí měsíc (obměsíc) jsou automaticky uzamčeny a nelze je měnit."));
        }

        int daysInMonth = DateTime.DaysInMonth(dto.Year, dto.Month);
        var monthStart = new DateTime(dto.Year, dto.Month, 1);
        var monthEnd = new DateTime(dto.Year, dto.Month, daysInMonth);

        var allTimeEntries = await _context.TimeEntries
            .Where(t => !t.IsDeleted)
            .ToListAsync();

        var allAbsences = await _context.AbsenceRequests
            .Where(r => !r.IsDeleted && (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending))
            .ToListAsync();

        bool hasPresenceInMonth = allTimeEntries.Any(t =>
        {
            var d = GetShiftOriginLocalDate(t);
            return d.Year == dto.Year && d.Month == dto.Month;
        });

        var monthAbsences = allAbsences
            .Where(r => r.PlannedStart.Date <= monthEnd && r.PlannedEnd.Date >= monthStart)
            .ToList();

        if (!hasPresenceInMonth && monthAbsences.Count == 0)
        {
            return BadRequest(ApiResponse<int>.Failure(
                "ERR_MONTH_EMPTY",
                "V daném měsíci neexistuje žádná přítomnost ani absence."));
        }

        var activeUsers = await _context.Users
            .Where(u => u.IsApproved && u.IsActive)
            .OrderBy(u => u.LastName)
            .ThenBy(u => u.FirstName)
            .ToListAsync();

        var existingClosuresInYear = await _context.MonthlyClosures
            .Where(mc => mc.Year == dto.Year)
            .ToListAsync();

        var alreadyClosedUserIds = existingClosuresInYear
            .Where(mc => mc.Month == dto.Month)
            .Select(mc => mc.UserId)
            .ToHashSet();

        var eligibleUnclosedUsers = activeUsers.Where(u =>
        {
            if (alreadyClosedUserIds.Contains(u.Id)) return false;
            if (u.EmploymentStartDate.HasValue && u.EmploymentStartDate.Value.Date > monthEnd)
            {
                bool hasEntry = allTimeEntries.Any(t => t.UserId == u.Id && GetShiftOriginLocalDate(t).Year == dto.Year && GetShiftOriginLocalDate(t).Month == dto.Month);
                bool hasAbs = monthAbsences.Any(a => a.UserId == u.Id);
                return hasEntry || hasAbs;
            }
            return true;
        }).ToList();

        if (eligibleUnclosedUsers.Count == 0)
        {
            return Ok(ApiResponse<int>.Success(0));
        }

        var defaultWp = await _context.Workplaces
            .Where(w => w.IsActive && w.NfcIdentifier != "setup-0")
            .OrderBy(w => w.Name)
            .FirstOrDefaultAsync()
            ?? await _context.Workplaces.FirstOrDefaultAsync(w => w.IsActive);

        var absenceTypesById = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var contractTypesByCode = (await _context.ContractTypes.ToListAsync())
            .GroupBy(ct => ct.Code.ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First());
        var companySetting = await _context.CompanySettings.FirstOrDefaultAsync();
        decimal baseDailyHours = companySetting?.DailyHours ?? 8.00m;
        var allHolidays = await _context.Holidays.ToListAsync();
        var holidayDates = Dochazka.Api.Services.HolidayService.GetResolvedHolidaysForYear(allHolidays, dto.Year)
            .Select(h => h.DateOnlyValue)
            .ToHashSet();

        bool isFemCaller = caller.IsFemale || caller.DisplayName.Trim().EndsWith("á");
        string verifySummary = isFemCaller ? "ověřila přítomnost v kanceláři" : "ověřil přítomnost v kanceláři";

        int closedCount = 0;

        foreach (var u in eligibleUnclosedUsers)
        {
            var uMonthEntries = allTimeEntries
                .Where(t => t.UserId == u.Id)
                .Where(t =>
                {
                    var d = GetShiftOriginLocalDate(t);
                    return d.Year == dto.Year && d.Month == dto.Month;
                })
                .ToList();

            // 1. Automatické ověření všech neověřených přítomností v kanceláři a podezřelých záznamů
            foreach (var entry in uMonthEntries)
            {
                bool isUnverifiedOffice = entry.LocationType == LocationType.office && !entry.WorkplaceId.HasValue;
                bool isSusp = AttendanceController.IsSuspiciousEntry(entry);
                if (isUnverifiedOffice || isSusp)
                {
                    if (isUnverifiedOffice && defaultWp != null)
                    {
                        entry.WorkplaceId = defaultWp.Id;
                    }
                    if (string.Equals(entry.EditReason, "AUTO_CUTOFF_0500", StringComparison.OrdinalIgnoreCase))
                    {
                        entry.EditReason = null;
                    }
                    entry.IsManual = true;
                    entry.EditedBy = caller.Id;
                    entry.EditedAt = nowUtc;

                    _context.TimeEntryEditLogs.Add(new TimeEntryEditLog
                    {
                        Id = Guid.NewGuid(),
                        TimeEntryId = entry.Id,
                        EditedByUserId = caller.Id,
                        EditedByName = caller.DisplayName,
                        EditedAt = nowUtc,
                        Summary = verifySummary
                    });
                }
            }

            // 2. Automatické ověření dokladů absencí v kompetenci officera
            var uMonthAbsences = monthAbsences.Where(r => r.UserId == u.Id).ToList();
            var verifiedIds = new List<string>();
            foreach (var abs in uMonthAbsences)
            {
                if (!absenceTypesById.TryGetValue(abs.AbsenceTypeId, out var absType)) continue;
                var code = absType.Code.ToLowerInvariant();
                if (code == "illness" || code == "doctor" || code == "ocr")
                {
                    verifiedIds.Add(abs.Id.ToString());
                    if (abs.Status == AbsenceStatus.pending)
                    {
                        abs.Status = AbsenceStatus.completed;
                        abs.ApprovedBy = caller.Id;
                        abs.ApprovedAt = nowUtc;
                    }
                }
            }

            // 3. Výpočet odpracovaných hodin, fondu, přesčasového balance a převodu salda
            var cTypeCode = UserDisplayHelper.GetContractTypeCode(u);
            contractTypesByCode.TryGetValue(cTypeCode.ToLowerInvariant(), out var ctSetting);
            decimal coeff = ctSetting?.Coefficient ?? (u.ContractType == ContractType.half_time ? 0.50m : u.ContractType == ContractType.part_time ? 0.25m : 1.00m);
            decimal dailyTarget = Math.Round(baseDailyHours * coeff, 2);

            double totalSeconds = 0;
            foreach (var e in uMonthEntries)
            {
                var end = e.EndTime ?? nowUtc;
                totalSeconds += Math.Max(0, (end - e.StartTime).TotalSeconds);
            }

            int workDays = 0;
            decimal deductedHours = 0m;
            for (int d = 1; d <= daysInMonth; d++)
            {
                var dt = new DateOnly(dto.Year, dto.Month, d);
                var dayDate = new DateTime(dto.Year, dto.Month, d);
                var dow = dayDate.DayOfWeek;
                if (dow != DayOfWeek.Saturday && dow != DayOfWeek.Sunday && !holidayDates.Contains(dt))
                {
                    workDays++;
                    decimal dayDed = 0m;
                    foreach (var req in uMonthAbsences.Where(r => r.Status == AbsenceStatus.completed))
                    {
                        if (req.PlannedStart.Date <= dayDate && req.PlannedEnd.Date >= dayDate &&
                            absenceTypesById.TryGetValue(req.AbsenceTypeId, out var absType) &&
                            absType.IsPaid && !absType.IsWorkMode)
                        {
                            if (absType.DurationMode == DurationMode.hours)
                            {
                                dayDed += (decimal)Math.Max(0, (req.PlannedEnd - req.PlannedStart).TotalHours);
                            }
                            else
                            {
                                dayDed += dailyTarget;
                            }
                        }
                    }
                    if (dayDed > dailyTarget) dayDed = dailyTarget;
                    deductedHours += dayDed;
                }
            }

            decimal fullFundHours = Math.Max(0m, Math.Round(workDays * dailyTarget - deductedHours, 2));
            decimal workedHoursDec = (decimal)Math.Round(totalSeconds / 3600.0, 2);
            decimal overtimeBalanceDec = Math.Round(workedHoursDec - fullFundHours, 2);

            decimal availableSaldo = existingClosuresInYear
                .Where(mc => mc.UserId == u.Id && mc.Month < dto.Month)
                .OrderBy(mc => mc.Month)
                .Sum(mc => mc.NetSaldoChangeHours);
            if (availableSaldo < 0m) availableSaldo = 0m;

            decimal saldoUsed = 0m;
            decimal overtimeToSaldo = 0m;

            if (overtimeBalanceDec < 0m)
            {
                // U chybějícího času se ze salda vezme jen doplnění času, pokud nějaké saldo existuje
                saldoUsed = Math.Min(Math.Abs(overtimeBalanceDec), availableSaldo);
                overtimeToSaldo = 0m;
            }
            else if (overtimeBalanceDec > 0m)
            {
                // Přesčas do plusu se celý převede do konta salda
                saldoUsed = 0m;
                overtimeToSaldo = overtimeBalanceDec;
            }

            decimal netSaldoChange = Math.Round(overtimeToSaldo - saldoUsed, 2);
            decimal paidOvertime = Math.Round(overtimeBalanceDec + saldoUsed - overtimeToSaldo, 2);

            _context.MonthlyClosures.Add(new MonthlyClosure
            {
                Id = Guid.NewGuid(),
                UserId = u.Id,
                Year = dto.Year,
                Month = dto.Month,
                WorkedHours = workedHoursDec,
                FundHours = fullFundHours,
                OvertimeBalanceHours = overtimeBalanceDec,
                SaldoUsedHours = saldoUsed,
                OvertimeToSaldoHours = overtimeToSaldo,
                NetSaldoChangeHours = netSaldoChange,
                PaidOvertimeHours = paidOvertime,
                VerifiedAbsenceIdsJson = JsonSerializer.Serialize(verifiedIds),
                ClosedByUserId = caller.Id,
                ClosedAt = nowUtc,
                UpdatedAt = nowUtc
            });

            closedCount++;
        }

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<int>.Success(closedCount));
    }

    /// <summary>
    /// Pravidlo 8: V daném roce jsou uzávěrky plovoucí – pokud se dodatečně upraví přítomnost nebo absence v již uzavřeném měsíci,
    /// automaticky aktualizujeme odpracované hodiny, fond a navazující saldo v daném roce.
    /// </summary>
    private async Task RecalculateYearFloatingClosuresAsync(
        int year,
        List<User> users,
        List<TimeEntry> allTimeEntries,
        List<AbsenceRequest> allAbsences,
        List<MonthlyClosure> allClosures,
        Dictionary<Guid, AbsenceType> absenceTypesById,
        Dictionary<string, ContractTypeSetting> contractTypesByCode,
        List<Holiday> allHolidays,
        decimal baseDailyHours,
        DateTimeOffset nowLocal,
        DateTimeOffset nowUtc)
    {
        var yearClosures = allClosures.Where(mc => mc.Year == year).ToList();
        if (yearClosures.Count == 0) return;

        var holidayDates = Dochazka.Api.Services.HolidayService.GetResolvedHolidaysForYear(allHolidays, year)
            .Select(h => h.DateOnlyValue)
            .ToHashSet();

        bool anyUpdated = false;

        foreach (var u in users)
        {
            var uClosures = yearClosures
                .Where(mc => mc.UserId == u.Id)
                .OrderBy(mc => mc.Month)
                .ToList();
            if (uClosures.Count == 0) continue;

            var cTypeCode = UserDisplayHelper.GetContractTypeCode(u);
            contractTypesByCode.TryGetValue(cTypeCode.ToLowerInvariant(), out var ctSetting);
            decimal coeff = ctSetting?.Coefficient ?? (u.ContractType == ContractType.half_time ? 0.50m : u.ContractType == ContractType.part_time ? 0.25m : 1.00m);
            decimal dailyTarget = Math.Round(baseDailyHours * coeff, 2);

            decimal runningSaldo = 0m;

            foreach (var mc in uClosures)
            {
                int daysInM = DateTime.DaysInMonth(year, mc.Month);
                var mStart = new DateTime(year, mc.Month, 1);
                var mEnd = new DateTime(year, mc.Month, daysInM);
                bool isCurrentM = year == nowLocal.Year && mc.Month == nowLocal.Month;
                bool isPastM = year < nowLocal.Year || (year == nowLocal.Year && mc.Month < nowLocal.Month);
                int cutoffDay = isCurrentM ? nowLocal.Day : (isPastM ? daysInM : 0);

                var mEntries = allTimeEntries.Where(t =>
                {
                    if (t.UserId != u.Id) return false;
                    var d = GetShiftOriginLocalDate(t);
                    return d.Year == year && d.Month == mc.Month;
                }).ToList();

                double totalSecs = 0;
                double cutoffSecs = 0;
                foreach (var e in mEntries)
                {
                    var d = GetShiftOriginLocalDate(e);
                    var end = e.EndTime ?? nowUtc;
                    var s = Math.Max(0, (end - e.StartTime).TotalSeconds);
                    totalSecs += s;
                    if (d.Day <= cutoffDay) cutoffSecs += s;
                }

                var mApprovedAbs = allAbsences.Where(r =>
                    r.UserId == u.Id &&
                    r.Status == AbsenceStatus.completed &&
                    r.PlannedStart.Date <= mEnd &&
                    r.PlannedEnd.Date >= mStart).ToList();

                int workDays = 0;
                decimal deducted = 0m;
                int cutoffWorkDays = 0;
                decimal cutoffDeducted = 0m;

                for (int d = 1; d <= daysInM; d++)
                {
                    var dt = new DateOnly(year, mc.Month, d);
                    var dayDate = new DateTime(year, mc.Month, d);
                    var dow = dayDate.DayOfWeek;
                    if (dow != DayOfWeek.Saturday && dow != DayOfWeek.Sunday && !holidayDates.Contains(dt))
                    {
                        workDays++;
                        decimal dayDed = 0m;
                        foreach (var req in mApprovedAbs)
                        {
                            if (req.PlannedStart.Date <= dayDate && req.PlannedEnd.Date >= dayDate &&
                                absenceTypesById.TryGetValue(req.AbsenceTypeId, out var absType) &&
                                absType.IsPaid && !absType.IsWorkMode)
                            {
                                if (absType.DurationMode == DurationMode.hours)
                                {
                                    dayDed += (decimal)Math.Max(0, (req.PlannedEnd - req.PlannedStart).TotalHours);
                                }
                                else
                                {
                                    dayDed += dailyTarget;
                                }
                            }
                        }
                        if (dayDed > dailyTarget) dayDed = dailyTarget;
                        deducted += dayDed;
                        if (d <= cutoffDay)
                        {
                            cutoffWorkDays++;
                            cutoffDeducted += dayDed;
                        }
                    }
                }

                decimal fullFund = Math.Max(0m, Math.Round(workDays * dailyTarget - deducted, 2));
                decimal cutoffFund = Math.Max(0m, Math.Round(cutoffWorkDays * dailyTarget - cutoffDeducted, 2));
                decimal workedDec = (decimal)Math.Round(totalSecs / 3600.0, 2);
                decimal cutoffWorkedDec = (decimal)Math.Round(cutoffSecs / 3600.0, 2);

                decimal effFund = isCurrentM ? cutoffFund : fullFund;
                decimal effWorked = isCurrentM ? cutoffWorkedDec : workedDec;
                decimal newBalance = Math.Round(effWorked - effFund, 2);

                decimal newSaldoUsed = mc.SaldoUsedHours;
                if (newSaldoUsed > runningSaldo) newSaldoUsed = runningSaldo;

                decimal maxToSaldo = Math.Max(0m, newBalance + newSaldoUsed);
                decimal newToSaldo = mc.OvertimeToSaldoHours;
                if (newToSaldo > maxToSaldo) newToSaldo = maxToSaldo;

                decimal newNetChange = Math.Round(newToSaldo - newSaldoUsed, 2);
                decimal newPaidOvertime = Math.Round(newBalance + newSaldoUsed - newToSaldo, 2);

                if (mc.WorkedHours != workedDec ||
                    mc.FundHours != fullFund ||
                    mc.OvertimeBalanceHours != newBalance ||
                    mc.SaldoUsedHours != newSaldoUsed ||
                    mc.OvertimeToSaldoHours != newToSaldo ||
                    mc.NetSaldoChangeHours != newNetChange ||
                    mc.PaidOvertimeHours != newPaidOvertime)
                {
                    mc.WorkedHours = workedDec;
                    mc.FundHours = fullFund;
                    mc.OvertimeBalanceHours = newBalance;
                    mc.SaldoUsedHours = newSaldoUsed;
                    mc.OvertimeToSaldoHours = newToSaldo;
                    mc.NetSaldoChangeHours = newNetChange;
                    mc.PaidOvertimeHours = newPaidOvertime;
                    anyUpdated = true;
                }

                runningSaldo = Math.Max(0m, runningSaldo + newNetChange);
            }
        }

        if (anyUpdated)
        {
            await _context.SaveChangesAsync();
        }
    }
}
