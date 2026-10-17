using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Dochazka.Api.Data;
using Dochazka.Api.Models;

namespace Dochazka.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AttendanceController : ControllerBase
{
    private readonly DochazkaDbContext _context;

    public AttendanceController(DochazkaDbContext context)
    {
        _context = context;
    }

    // Default dev user (Admin Petr Kulhánek)
    private Guid CurrentUserId => Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    private Guid? GetCurrentUserId()
    {
        if (Request.Headers.TryGetValue("Authorization", out var authHeader) && authHeader.ToString().StartsWith("Bearer "))
        {
            var token = authHeader.ToString().Substring("Bearer ".Length).Trim();
            try
            {
                var decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(token));
                var parts = decoded.Split(':');
                if (parts.Length > 0 && Guid.TryParse(parts[0], out var guidFromToken))
                {
                    return guidFromToken;
                }
            }
            catch { }
        }

        if (Request.Headers.TryGetValue("X-User-Id", out var headerVal) && Guid.TryParse(headerVal, out var parsed))
        {
            return parsed;
        }

        return null;
    }

    /// <summary>
    /// Získá aktuální stav docházky uživatele (dnešní směny a aktivní přítomnost).
    /// </summary>
    [HttpGet("status")]
    public async Task<ActionResult<ApiResponse<AttendanceStatusDto>>> GetStatus([FromQuery] Guid? userId)
    {
        var targetUserId = userId ?? GetCurrentUserId() ?? CurrentUserId;
        var user = await _context.Users.FindAsync(targetUserId);

        if (user != null && !user.IsApproved)
        {
            return StatusCode(403, ApiResponse<AttendanceStatusDto>.Failure(
                "ERR_ACCOUNT_PENDING_APPROVAL",
                "Uživatelský účet čeká na schválení úvazku Office Managerem."
            ));
        }

        var nowLocal = DateTimeOffset.Now;
        var todayLocal = nowLocal.Date;
        var today = DateTimeOffset.UtcNow.Date;
        var todayUtc = new DateTimeOffset(today, TimeSpan.Zero);

        var userEntries = await _context.TimeEntries
            .Where(t => t.UserId == targetUserId)
            .ToListAsync();

        var activeShift = userEntries
            .Where(t => t.EndTime == null)
            .OrderByDescending(t => t.StartTime)
            .FirstOrDefault();

        var todayEntries = userEntries
            .Where(t => t.StartTime >= todayUtc)
            .OrderBy(t => t.StartTime)
            .ToList();

        double totalSeconds = 0;
        foreach (var entry in todayEntries)
        {
            var end = entry.EndTime ?? DateTimeOffset.UtcNow;
            totalSeconds += (end - entry.StartTime).TotalSeconds;
        }

        var workplaces = await _context.Workplaces.ToDictionaryAsync(w => w.Id, w => w.Name);
        string? workplaceName = null;
        if (activeShift?.WorkplaceId != null && workplaces.TryGetValue(activeShift.WorkplaceId.Value, out var activeWpName))
        {
            workplaceName = activeWpName;
        }

        var todayShifts = todayEntries.Select(e =>
        {
            var localStart = e.StartTime.ToLocalTime();
            var localEnd = e.EndTime?.ToLocalTime();
            var effectiveEnd = e.EndTime ?? DateTimeOffset.UtcNow;
            var hours = Math.Max(0, Math.Round((effectiveEnd - e.StartTime).TotalHours, 2));

            return new TimeEntryDetailDto
            {
                Id = e.Id.ToString(),
                Date = localStart.ToString("yyyy-MM-dd"),
                StartTime = localStart.ToString("HH:mm"),
                EndTime = localEnd?.ToString("HH:mm"),
                Hours = hours,
                LocationType = e.LocationType == LocationType.office ? "office" : "home_office",
                WorkplaceId = e.WorkplaceId?.ToString(),
                WorkplaceName = e.WorkplaceId.HasValue && workplaces.TryGetValue(e.WorkplaceId.Value, out var wpName) ? wpName : null
            };
        }).ToList();

        // Přidat dnešní schválené návštěvy lékaře (časové úseky od-do) do TodayShifts pro zobrazení v timeline
        var docType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "doctor");
        if (docType != null)
        {
            var userDocAbsences = await _context.AbsenceRequests
                .Where(r => r.UserId == targetUserId && r.AbsenceTypeId == docType.Id && r.Status == AbsenceStatus.completed)
                .ToListAsync();

            var todayDocs = userDocAbsences
                .Where(r => r.PlannedStart.Date == todayLocal || r.PlannedStart.Date == today)
                .ToList();

            foreach (var doc in todayDocs)
            {
                var docHours = Math.Max(0, Math.Round((doc.PlannedEnd - doc.PlannedStart).TotalHours, 2));
                string facility = "Zdravotnické zařízení / Ordinace";
                if (!string.IsNullOrEmpty(doc.Note) && doc.Note.Contains("Ordinace:"))
                {
                    facility = doc.Note.Split("Ordinace:").Last().Trim().TrimEnd(')');
                }
                else if (!string.IsNullOrEmpty(doc.Note))
                {
                    facility = doc.Note;
                }

                todayShifts.Add(new TimeEntryDetailDto
                {
                    Id = $"doc-{doc.Id}",
                    Date = doc.PlannedStart.ToString("yyyy-MM-dd"),
                    StartTime = doc.PlannedStart.ToString("HH:mm"),
                    EndTime = doc.PlannedEnd.ToString("HH:mm"),
                    Hours = docHours,
                    LocationType = "doctor",
                    WorkplaceId = null,
                    WorkplaceName = facility
                });
            }

            todayShifts = todayShifts.OrderBy(s => s.StartTime).ToList();
        }

        var dto = new AttendanceStatusDto
        {
            IsClockedIn = activeShift != null,
            ActiveShiftId = activeShift?.Id,
            StartTime = activeShift?.StartTime,
            LocationType = activeShift?.LocationType.ToString(),
            WorkplaceId = activeShift?.WorkplaceId,
            WorkplaceName = workplaceName,
            TotalHoursWorkedToday = Math.Round(totalSeconds / 3600.0, 2),
            ExpectedReturnAt = user?.ExpectedReturnAt,
            TodayShifts = todayShifts
        };

        return Ok(ApiResponse<AttendanceStatusDto>.Success(dto));
    }

    /// <summary>
    /// Záznam příchodu (NFC čip pobočky, Kancelář bez ověření nebo Home Office).
    /// </summary>
    [HttpPost("clock-in")]
    public async Task<ActionResult<ApiResponse<TimeEntryDto>>> ClockIn([FromBody] ClockInRequestDto request)
    {
        var targetUserId = request.UserId ?? GetCurrentUserId() ?? CurrentUserId;
        var user = await _context.Users.FindAsync(targetUserId);

        if (user != null && !user.IsApproved)
        {
            return StatusCode(403, ApiResponse<TimeEntryDto>.Failure(
                "ERR_ACCOUNT_PENDING_APPROVAL",
                "Uživatelský účet čeká na schválení úvazku Office Managerem."
            ));
        }

        var today = DateTimeOffset.UtcNow.Date;
        var todayUtc = new DateTimeOffset(today, TimeSpan.Zero);

        var userEntries = await _context.TimeEntries
            .Where(t => t.UserId == targetUserId)
            .ToListAsync();

        // 1. Edge Case TC-ATT-02: Kontrola zapomenutého odchodu z předchozího dne
        var yesterdayUnclosed = userEntries
            .FirstOrDefault(t => t.StartTime < todayUtc && t.EndTime == null);

        if (yesterdayUnclosed != null)
        {
            return BadRequest(ApiResponse<TimeEntryDto>.Failure(
                "ERR_MISSING_CLOCK_OUT",
                "Chybí čas včerejšího odchodu. Před novým příchodem musíte doplnit a nechat schválit korekci odchodu.",
                new { unclosedShiftId = yesterdayUnclosed.Id, shiftDate = yesterdayUnclosed.StartTime }
            ));
        }

        // 2. Již otevřená dnešní směna
        var activeShift = userEntries.FirstOrDefault(t => t.EndTime == null);

        if (activeShift != null)
        {
            return Conflict(ApiResponse<TimeEntryDto>.Failure(
                "ERR_ALREADY_CLOCKED_IN",
                "Už máte otevřenou aktivní směnu."
            ));
        }

        // 3. Hardware Workplace Guard:
        // - Při ověřeném NFC pípnutí: LocationType = office, WorkplaceId = Id pobočky
        // - Při volbě "Jsem v kanceláři (bez ověření)": LocationType = office, WorkplaceId = null (pro následné dohledání a ověření Officerem)
        // - Při volbě "Jsem doma (Home Office)": LocationType = home_office, WorkplaceId = null
        Guid? workplaceId = null;
        var locationType = request.IsHomeOffice ? LocationType.home_office : LocationType.office;

        if (!string.IsNullOrEmpty(request.NfcIdentifier))
        {
            var workplace = await _context.Workplaces
                .FirstOrDefaultAsync(w => w.NfcIdentifier == request.NfcIdentifier && w.IsActive);

            if (workplace != null)
            {
                workplaceId = workplace.Id;
                locationType = LocationType.office;
            }
        }

        var entry = new TimeEntry
        {
            Id = Guid.NewGuid(),
            UserId = targetUserId,
            WorkplaceId = workplaceId,
            StartTime = DateTimeOffset.UtcNow,
            EndTime = null,
            LocationType = locationType,
            IsManual = false
        };

        // Reset expected return time if returning
        if (user != null && user.ExpectedReturnAt != null)
        {
            user.ExpectedReturnAt = null;
        }

        _context.TimeEntries.Add(entry);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<TimeEntryDto>.Success(new TimeEntryDto
        {
            Id = entry.Id,
            StartTime = entry.StartTime,
            LocationType = entry.LocationType.ToString(),
            WorkplaceId = entry.WorkplaceId
        }));
    }

    /// <summary>
    /// Záznam odchodu (definitivní nebo pauza na Home Office s orientačním návratem).
    /// </summary>
    [HttpPost("clock-out")]
    public async Task<ActionResult<ApiResponse<TimeEntryDto>>> ClockOut([FromBody] ClockOutRequestDto request)
    {
        var targetUserId = request.UserId ?? GetCurrentUserId() ?? CurrentUserId;
        var user = await _context.Users.FindAsync(targetUserId);

        if (user != null && !user.IsApproved)
        {
            return StatusCode(403, ApiResponse<TimeEntryDto>.Failure(
                "ERR_ACCOUNT_PENDING_APPROVAL",
                "Uživatelský účet čeká na schválení úvazku Office Managerem."
            ));
        }

        var activeShifts = await _context.TimeEntries
            .Where(t => t.UserId == targetUserId && t.EndTime == null)
            .ToListAsync();
        var activeShift = activeShifts.OrderByDescending(t => t.StartTime).FirstOrDefault();

        if (activeShift == null)
        {
            return BadRequest(ApiResponse<TimeEntryDto>.Failure(
                "ERR_NO_ACTIVE_SHIFT",
                "Nemáte žádnou aktivní směnu k ukončení."
            ));
        }

        var nowUtc = DateTimeOffset.UtcNow;
        var durationSeconds = (nowUtc - activeShift.StartTime).TotalSeconds;

        // Pokud je rozmezí mezi příchodem a odchodem menší než 1 minuta (< 60 s, tedy i 59 s), záznam rovnou vymazat
        if (durationSeconds < 60.0)
        {
            var deletedId = activeShift.Id;
            var deletedStart = activeShift.StartTime;
            _context.TimeEntries.Remove(activeShift);
            if (user != null)
            {
                user.ExpectedReturnAt = null;
            }
            await _context.SaveChangesAsync();

            return Ok(ApiResponse<TimeEntryDto>.Success(new TimeEntryDto
            {
                Id = deletedId,
                StartTime = deletedStart,
                EndTime = null,
                LocationType = "deleted_under_1min",
                DeletedUnderOneMinute = true
            }));
        }

        activeShift.EndTime = nowUtc;

        if (user != null)
        {
            if (request.IsPause && request.ExpectedReturnAt.HasValue)
            {
                user.ExpectedReturnAt = request.ExpectedReturnAt;
            }
            else
            {
                user.ExpectedReturnAt = null;
            }
        }

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<TimeEntryDto>.Success(new TimeEntryDto
        {
            Id = activeShift.Id,
            StartTime = activeShift.StartTime,
            EndTime = activeShift.EndTime,
            LocationType = activeShift.LocationType.ToString()
        }));
    }

    /// <summary>
    /// Vrátí seznam aktivních pracovišť (poboček).
    /// </summary>
    [HttpGet("workplaces")]
    public async Task<ActionResult<ApiResponse<List<WorkplaceDto>>>> GetWorkplaces()
    {
        var workplaces = await _context.Workplaces
            .Where(w => w.IsActive && w.NfcIdentifier != "setup-0")
            .OrderBy(w => w.Name)
            .Select(w => new WorkplaceDto
            {
                Id = w.Id,
                Name = w.Name,
                NfcIdentifier = w.NfcIdentifier,
                Address = w.Address
            })
            .ToListAsync();

        return Ok(ApiResponse<List<WorkplaceDto>>.Success(workplaces));
    }

    /// <summary>
    /// Kdo je kde – živý přehled přítomnosti všech kolegů v reálném čase.
    /// </summary>
    [HttpGet("who-is-where")]
    [HttpGet("team-presence")]
    [HttpGet("radar")]
    public async Task<ActionResult<ApiResponse<List<RadarUserDto>>>> GetLiveRadar()
    {
        var users = await _context.Users.Where(u => u.IsActive && u.IsApproved).ToListAsync();
        var userNamesById = users.ToDictionary(u => u.Id, u => u.DisplayName);
        var activeShifts = await _context.TimeEntries
            .Where(t => t.EndTime == null)
            .ToListAsync();
        var workplaces = await _context.Workplaces.ToDictionaryAsync(w => w.Id, w => w.Name);
        var absenceTypes = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t.Code);
        var nowLocal = DateTimeOffset.Now;
        var todayDate = nowLocal.Date;
        var nowTimeOfDay = nowLocal.TimeOfDay;
        var allCompletedAbsences = await _context.AbsenceRequests
            .Where(r => r.Status == AbsenceStatus.completed)
            .ToListAsync();
        var todayAbsences = allCompletedAbsences
            .Where(r => r.PlannedStart.Date <= todayDate && r.PlannedEnd.Date >= todayDate)
            .ToList();

        var list = new List<RadarUserDto>();

        foreach (var user in users)
        {
            var shift = activeShifts.FirstOrDefault(s => s.UserId == user.Id);
            string status = "Nepřítomen";
            string color = "slate"; // default gray
            string locationType = "offline";

            if (shift != null)
            {
                if (shift.LocationType == LocationType.office)
                {
                    string wpName = shift.WorkplaceId.HasValue && workplaces.TryGetValue(shift.WorkplaceId.Value, out var n) ? n : "bez ověření";
                    status = $"V kanceláři ({wpName})";
                    color = "emerald";
                    locationType = "office";
                }
                else if (shift.LocationType == LocationType.home_office)
                {
                    status = "Home Office";
                    color = "sky";
                    locationType = "home_office";
                }
            }
            else
            {
                var userTodayAbs = todayAbsences.FirstOrDefault(a =>
                {
                    if (a.UserId != user.Id) return false;
                    if (!absenceTypes.TryGetValue(a.AbsenceTypeId, out var code)) return false;
                    if (code == "doctor")
                    {
                        // Časová propustka k lékaři se v "Kdo je kde" zobrazuje pouze pokud právě probíhá (od–do)
                        return nowTimeOfDay >= a.PlannedStart.TimeOfDay && nowTimeOfDay <= a.PlannedEnd.TimeOfDay;
                    }
                    return true;
                });
                if (userTodayAbs != null && absenceTypes.TryGetValue(userTodayAbs.AbsenceTypeId, out var typeCode))
                {
                    switch (typeCode)
                    {
                        case "doctor":
                            status = $"U lékaře ({userTodayAbs.PlannedStart:HH:mm} – {userTodayAbs.PlannedEnd:HH:mm})";
                            color = "indigo";
                            locationType = "doctor";
                            break;
                        case "sick_day":
                            status = "Sick day";
                            color = "rose";
                            locationType = "sick_day";
                            break;
                        case "illness":
                            status = "Nemoc";
                            color = "red";
                            locationType = "illness";
                            break;
                        case "unpaid_leave":
                            status = "Neplacené volno";
                            color = "purple";
                            locationType = "unpaid_leave";
                            break;
                        case "home_office":
                            status = "Home Office";
                            color = "sky";
                            locationType = "home_office";
                            break;
                        default:
                            status = "Dovolená";
                            color = "amber";
                            locationType = "vacation";
                            break;
                    }
                }
                else if (user.ExpectedReturnAt.HasValue)
                {
                    status = $"Pauza (návrat cca {user.ExpectedReturnAt.Value.ToLocalTime():HH:mm})";
                    color = "amber";
                    locationType = "offline";
                }
            }

            list.Add(new RadarUserDto
            {
                UserId = user.Id,
                DisplayName = user.DisplayName,
                Email = user.Email,
                Role = user.Role.ToString(),
                PhoneNumber = user.PhoneNumber,
                ContractKind = user.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
                ManagerId = user.ManagerId,
                ManagerName = user.ManagerId.HasValue && userNamesById.TryGetValue(user.ManagerId.Value, out var mName) ? mName : null,
                ParentPersonId = user.ParentPersonId,
                ParentPersonName = user.ParentPersonId.HasValue && userNamesById.TryGetValue(user.ParentPersonId.Value, out var pName) ? pName : null,
                LocationType = locationType,
                StatusText = status,
                StatusColor = color,
                ExpectedReturnAt = user.ExpectedReturnAt
            });
        }

        return Ok(ApiResponse<List<RadarUserDto>>.Success(list));
    }

    /// <summary>
    /// Týdenní přehled docházky přihlášeného uživatele.
    /// </summary>
    [HttpGet("week")]
    public async Task<ActionResult<ApiResponse<List<DaySummaryDto>>>> GetWeeklySummary([FromQuery] string? startDay, [FromQuery] Guid? userId)
    {
        var targetUserId = userId ?? GetCurrentUserId() ?? CurrentUserId;
        var user = await _context.Users.FindAsync(targetUserId);

        if (user != null && !user.IsApproved)
        {
            return StatusCode(403, ApiResponse<List<DaySummaryDto>>.Failure(
                "ERR_ACCOUNT_PENDING_APPROVAL",
                "Uživatelský účet čeká na schválení úvazku Office Managerem."
            ));
        }

        var today = DateTimeOffset.UtcNow.Date;
        var monday = today.AddDays(-(int)(today.DayOfWeek == DayOfWeek.Sunday ? 6 : today.DayOfWeek - DayOfWeek.Monday));
        var mondayUtc = new DateTimeOffset(monday, TimeSpan.Zero);

        var userEntries = await _context.TimeEntries
            .Where(t => t.UserId == targetUserId)
            .ToListAsync();

        var entries = userEntries
            .Where(t => t.StartTime >= mondayUtc && t.StartTime < mondayUtc.AddDays(7))
            .ToList();

        var days = new List<DaySummaryDto>();
        for (int i = 0; i < 7; i++)
        {
            var dayDate = monday.AddDays(i);
            var dayUtc = new DateTimeOffset(dayDate, TimeSpan.Zero);
            var nextDayUtc = dayUtc.AddDays(1);

            var dayEntries = entries.Where(e => e.StartTime >= dayUtc && e.StartTime < nextDayUtc).ToList();
            double hours = 0;
            foreach (var e in dayEntries)
            {
                var end = e.EndTime ?? (dayDate == today ? DateTimeOffset.UtcNow : e.StartTime);
                hours += (end - e.StartTime).TotalHours;
            }

            days.Add(new DaySummaryDto
            {
                Date = DateOnly.FromDateTime(dayDate),
                DayName = dayDate.ToString("ddd", new System.Globalization.CultureInfo("cs-CZ")),
                HoursWorked = Math.Round(hours, 2),
                HasActiveShift = dayEntries.Any(e => e.EndTime == null),
                IsToday = dayDate == today
            });
        }

        return Ok(ApiResponse<List<DaySummaryDto>>.Success(days));
    }

    /// <summary>
    /// Měsíční souhrn odpracovaných hodin a docházky přihlášeného uživatele.
    /// </summary>
    [HttpGet("month")]
    public async Task<ActionResult<ApiResponse<MonthSummaryDto>>> GetMonthlySummary([FromQuery] Guid? userId, [FromQuery] int? year = null, [FromQuery] int? month = null)
    {
        var targetUserId = userId ?? GetCurrentUserId() ?? CurrentUserId;
        var user = await _context.Users.FindAsync(targetUserId);

        if (user != null && !user.IsApproved)
        {
            return StatusCode(403, ApiResponse<MonthSummaryDto>.Failure(
                "ERR_ACCOUNT_PENDING_APPROVAL",
                "Uživatelský účet čeká na schválení úvazku Office Managerem."
            ));
        }

        var today = DateTimeOffset.UtcNow;
        int targetYear = year ?? today.Year;
        int targetMonth = month ?? today.Month;

        var startOfMonth = new DateTimeOffset(targetYear, targetMonth, 1, 0, 0, 0, TimeSpan.Zero);
        var endOfMonth = startOfMonth.AddMonths(1);

        var allEntries = await _context.TimeEntries
            .Where(t => t.UserId == targetUserId)
            .ToListAsync();

        var userEntries = allEntries
            .Where(t => t.StartTime >= startOfMonth && t.StartTime < endOfMonth)
            .ToList();

        double totalSeconds = 0;
        var hoDays = new HashSet<DateOnly>();

        foreach (var entry in userEntries)
        {
            var end = entry.EndTime ?? (entry.StartTime.Date == today.Date ? today : entry.StartTime);
            totalSeconds += Math.Max(0, (end - entry.StartTime).TotalSeconds);
            if (entry.LocationType == LocationType.home_office)
            {
                hoDays.Add(DateOnly.FromDateTime(entry.StartTime.Date));
            }
        }

        // Pracovní dny v měsíci (Po-Pá) vyjma svátků (včetně plovoucích dle pravidla Rule)
        var holidays = await _context.Holidays.ToListAsync();
        var resolvedHolidays = Dochazka.Api.Services.HolidayService.GetResolvedHolidaysForYear(holidays, targetYear);
        var holidayDates = resolvedHolidays.Select(h => h.DateOnlyValue).ToHashSet();

        int workDays = 0;
        int daysInMonth = DateTime.DaysInMonth(targetYear, targetMonth);
        for (int d = 1; d <= daysInMonth; d++)
        {
            var dt = new DateOnly(targetYear, targetMonth, d);
            var dayOfWeek = new DateTime(targetYear, targetMonth, d).DayOfWeek;
            if (dayOfWeek != DayOfWeek.Saturday && dayOfWeek != DayOfWeek.Sunday)
            {
                if (!holidayDates.Contains(dt))
                {
                    workDays++;
                }
            }
        }

        var companySetting = await _context.CompanySettings.FirstOrDefaultAsync();
        decimal baseDailyHours = companySetting?.DailyHours ?? 8.00m;

        var cTypeStr = user?.ContractType.ToString() ?? "full_time";
        var contractTypeSetting = await _context.ContractTypes.FirstOrDefaultAsync(ct => ct.Code == cTypeStr);
        decimal coefficient = contractTypeSetting?.Coefficient ?? (user?.ContractType switch
        {
            ContractType.half_time => 0.50m,
            ContractType.part_time => 0.25m,
            _ => 1.00m
        });
        decimal dailyTargetHours = Math.Round(baseDailyHours * coefficient, 2);
        decimal fundHours = Math.Round(workDays * dailyTargetHours, 1);

        double hoursWorked = Math.Round(totalSeconds / 3600.0, 1);
        double overtime = hoursWorked > (double)fundHours ? Math.Round(hoursWorked - (double)fundHours, 1) : 0;

        return Ok(ApiResponse<MonthSummaryDto>.Success(new MonthSummaryDto
        {
            Year = targetYear,
            Month = targetMonth,
            HoursWorked = hoursWorked,
            FundHours = (double)fundHours,
            DailyTargetHours = (double)dailyTargetHours,
            FteCoefficient = (double)coefficient,
            OvertimeHours = overtime,
            HomeOfficeDays = hoDays.Count
        }));
    }

    /// <summary>
    /// Vrátí vyhodnocené svátky z databáze pro daný rok (včetně plovoucích svátků vypočtených dle sloupce Rule).
    /// </summary>
    [HttpGet("holidays")]
    public async Task<ActionResult<ApiResponse<List<Dochazka.Api.Services.ResolvedHolidayDto>>>> GetHolidays([FromQuery] int? year)
    {
        int targetYear = year ?? DateTimeOffset.UtcNow.Year;
        var holidays = await _context.Holidays.ToListAsync();
        var resolved = Dochazka.Api.Services.HolidayService.GetResolvedHolidaysForYear(holidays, targetYear);
        return Ok(ApiResponse<List<Dochazka.Api.Services.ResolvedHolidayDto>>.Success(resolved));
    }

    /// <summary>
    /// Získá reálné časové záznamy (směny) uživatele pro zadaný rok a měsíc z databáze.
    /// </summary>
    [HttpGet("entries")]
    public async Task<ActionResult<ApiResponse<List<TimeEntryDetailDto>>>> GetMonthlyEntries(
        [FromQuery] Guid? userId,
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        var targetUserId = userId ?? GetCurrentUserId() ?? CurrentUserId;
        var user = await _context.Users.FindAsync(targetUserId);

        if (user != null && !user.IsApproved)
        {
            return StatusCode(403, ApiResponse<List<TimeEntryDetailDto>>.Failure(
                "ERR_ACCOUNT_PENDING_APPROVAL",
                "Uživatelský účet čeká na schválení úvazku Office Managerem."
            ));
        }

        var today = DateTimeOffset.UtcNow;
        int targetYear = year ?? today.Year;
        int targetMonth = month ?? today.Month;

        var startOfMonth = new DateTimeOffset(targetYear, targetMonth, 1, 0, 0, 0, TimeSpan.Zero);
        var endOfMonth = startOfMonth.AddMonths(1);

        var allEntries = await _context.TimeEntries
            .Where(t => t.UserId == targetUserId)
            .ToListAsync();

        var monthEntries = allEntries
            .Where(t => t.StartTime >= startOfMonth && t.StartTime < endOfMonth)
            .OrderBy(t => t.StartTime)
            .ToList();

        var workplaces = await _context.Workplaces.ToDictionaryAsync(w => w.Id, w => w.Name);

        var result = monthEntries.Select(e =>
        {
            var localStart = e.StartTime.ToLocalTime();
            var localEnd = e.EndTime?.ToLocalTime();
            var effectiveEnd = e.EndTime ?? (e.StartTime.Date == today.Date ? today : e.StartTime);
            var hours = Math.Max(0, Math.Round((effectiveEnd - e.StartTime).TotalHours, 2));

            return new TimeEntryDetailDto
            {
                Id = e.Id.ToString(),
                Date = localStart.ToString("yyyy-MM-dd"),
                StartTime = localStart.ToString("HH:mm"),
                EndTime = localEnd?.ToString("HH:mm"),
                Hours = hours,
                LocationType = e.LocationType == LocationType.office ? "office" : "home_office",
                WorkplaceId = e.WorkplaceId?.ToString(),
                WorkplaceName = e.WorkplaceId.HasValue && workplaces.TryGetValue(e.WorkplaceId.Value, out var wpName) ? wpName : null
            };
        }).ToList();

        return Ok(ApiResponse<List<TimeEntryDetailDto>>.Success(result));
    }
}

public class TimeEntryDetailDto
{
    public string Id { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string StartTime { get; set; } = string.Empty;
    public string? EndTime { get; set; }
    public double Hours { get; set; }
    public string LocationType { get; set; } = "office";
    public string? WorkplaceId { get; set; }
    public string? WorkplaceName { get; set; }
}

public class MonthSummaryDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public double HoursWorked { get; set; }
    public double FundHours { get; set; }
    public double DailyTargetHours { get; set; } = 8.0;
    public double FteCoefficient { get; set; } = 1.0;
    public double OvertimeHours { get; set; }
    public int HomeOfficeDays { get; set; }
}

public class AttendanceStatusDto
{
    public bool IsClockedIn { get; set; }
    public Guid? ActiveShiftId { get; set; }
    public DateTimeOffset? StartTime { get; set; }
    public string? LocationType { get; set; }
    public Guid? WorkplaceId { get; set; }
    public string? WorkplaceName { get; set; }
    public double TotalHoursWorkedToday { get; set; }
    public DateTimeOffset? ExpectedReturnAt { get; set; }
    public List<TimeEntryDetailDto> TodayShifts { get; set; } = new();
}

public class ClockInRequestDto
{
    public Guid? UserId { get; set; }
    public string? NfcIdentifier { get; set; }
    public bool IsHomeOffice { get; set; } = false;
}

public class ClockOutRequestDto
{
    public Guid? UserId { get; set; }
    public bool IsPause { get; set; } = false;
    public DateTimeOffset? ExpectedReturnAt { get; set; }
}

public class TimeEntryDto
{
    public Guid Id { get; set; }
    public DateTimeOffset StartTime { get; set; }
    public DateTimeOffset? EndTime { get; set; }
    public string LocationType { get; set; } = string.Empty;
    public Guid? WorkplaceId { get; set; }
    public bool DeletedUnderOneMinute { get; set; } = false;
}

public class WorkplaceDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string NfcIdentifier { get; set; } = string.Empty;
    public string? Address { get; set; }
}

public class RadarUserDto
{
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string ContractKind { get; set; } = "HPP";
    public Guid? ManagerId { get; set; }
    public string? ManagerName { get; set; }
    public Guid? ParentPersonId { get; set; }
    public string? ParentPersonName { get; set; }
    public string LocationType { get; set; } = "offline";
    public string StatusText { get; set; } = string.Empty;
    public string StatusColor { get; set; } = string.Empty;
    public DateTimeOffset? ExpectedReturnAt { get; set; }
}

public class DaySummaryDto
{
    public DateOnly Date { get; set; }
    public string DayName { get; set; } = string.Empty;
    public double HoursWorked { get; set; }
    public bool HasActiveShift { get; set; }
    public bool IsToday { get; set; }
}
