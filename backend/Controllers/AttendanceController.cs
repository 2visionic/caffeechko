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

    private static DateTimeOffset GetLocalNow() => TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.Local);

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
    /// Rozdělí směny přesahující lokální půlnoc (ukončené i právě probíhající noční směny)
    /// na samostatné denní záznamy (první den do 23:59:59, další den od 00:00:00).
    /// </summary>
    private async Task EnsureCrossMidnightShiftsSplitAsync(Guid userId)
    {
        var entries = (await _context.TimeEntries
            .Where(t => t.UserId == userId)
            .ToListAsync())
            .OrderBy(t => t.StartTime)
            .ToList();

        var nowUtc = DateTimeOffset.UtcNow;
        bool changed = false;

        foreach (var entry in entries)
        {
            var localStart = entry.StartTime.ToLocalTime();
            var effectiveEndUtc = entry.EndTime ?? nowUtc;
            var localEnd = effectiveEndUtc.ToLocalTime();

            if (localStart.Date < localEnd.Date)
            {
                var originalEndUtc = entry.EndTime;

                // Ukončit první část na konci prvního lokálního dne (23:59:59)
                var firstDayEndLocal = localStart.Date.AddDays(1).AddSeconds(-1);
                var firstDayEndOffset = TimeZoneInfo.Local.GetUtcOffset(firstDayEndLocal);
                entry.EndTime = new DateTimeOffset(firstDayEndLocal, firstDayEndOffset).ToUniversalTime();
                changed = true;

                var curDate = localStart.Date.AddDays(1);
                while (curDate <= localEnd.Date)
                {
                    var segStartLocal = curDate; // 00:00:00 lokálního času
                    var segStartOffset = TimeZoneInfo.Local.GetUtcOffset(segStartLocal);
                    var segStartUtc = new DateTimeOffset(segStartLocal, segStartOffset).ToUniversalTime();

                    DateTimeOffset? segEndUtc;
                    if (curDate < localEnd.Date)
                    {
                        var segEndLocal = curDate.AddDays(1).AddSeconds(-1);
                        var segEndOffset = TimeZoneInfo.Local.GetUtcOffset(segEndLocal);
                        segEndUtc = new DateTimeOffset(segEndLocal, segEndOffset).ToUniversalTime();
                    }
                    else
                    {
                        segEndUtc = originalEndUtc;
                    }

                    // Přidat navazující část (pokud nejde o nulový úsek přesně o půlnoci)
                    if (segEndUtc == null || (segEndUtc.Value - segStartUtc).TotalSeconds >= 1)
                    {
                        _context.TimeEntries.Add(new TimeEntry
                        {
                            Id = Guid.NewGuid(),
                            UserId = entry.UserId,
                            WorkplaceId = entry.WorkplaceId,
                            StartTime = segStartUtc,
                            EndTime = segEndUtc,
                            LocationType = entry.LocationType,
                            IsManual = entry.IsManual,
                            EditedBy = entry.EditedBy,
                            EditedAt = entry.EditedAt,
                            EditReason = entry.EditReason
                        });
                    }

                    curDate = curDate.AddDays(1);
                }
            }
        }

        if (changed)
        {
            await _context.SaveChangesAsync();
        }
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

        await EnsureCrossMidnightShiftsSplitAsync(targetUserId);

        var nowLocal = GetLocalNow();
        var todayLocal = nowLocal.Date;

        var userEntries = await _context.TimeEntries
            .Where(t => t.UserId == targetUserId)
            .ToListAsync();

        var activeShift = userEntries
            .Where(t => t.EndTime == null)
            .OrderByDescending(t => t.StartTime)
            .FirstOrDefault();

        var todayEntries = userEntries
            .Where(t => t.StartTime.ToLocalTime().Date == todayLocal)
            .OrderBy(t => t.StartTime)
            .ToList();

        double totalSeconds = 0;
        foreach (var entry in todayEntries)
        {
            var end = entry.EndTime ?? DateTimeOffset.UtcNow;
            totalSeconds += Math.Max(0, (end - entry.StartTime).TotalSeconds);
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

        // Přidat dnešní schválené hodinové propustky (DurationMode.hours, např. lékař) do TodayShifts pro zobrazení v timeline
        var hourTypes = await _context.AbsenceTypes
            .Where(t => t.DurationMode == DurationMode.hours)
            .ToDictionaryAsync(t => t.Id, t => t);

        if (hourTypes.Count > 0)
        {
            var hourTypeIds = hourTypes.Keys.ToList();
            var userHourAbsences = await _context.AbsenceRequests
                .Where(r => r.UserId == targetUserId && hourTypeIds.Contains(r.AbsenceTypeId) && r.Status == AbsenceStatus.completed)
                .ToListAsync();

            var todayHourAbsences = userHourAbsences
                .Where(r => r.PlannedStart.Date == todayLocal)
                .ToList();

            foreach (var doc in todayHourAbsences)
            {
                var docHours = Math.Max(0, Math.Round((doc.PlannedEnd - doc.PlannedStart).TotalHours, 2));
                string? note = !string.IsNullOrWhiteSpace(doc.Note) ? doc.Note : null;

                todayShifts.Add(new TimeEntryDetailDto
                {
                    Id = $"doc-{doc.Id}",
                    Date = doc.PlannedStart.ToString("yyyy-MM-dd"),
                    StartTime = doc.PlannedStart.ToString("HH:mm"),
                    EndTime = doc.PlannedEnd.ToString("HH:mm"),
                    Hours = docHours,
                    LocationType = "doctor",
                    WorkplaceId = null,
                    WorkplaceName = note
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

    private async Task<string?> GetActiveFullDayAbsenceTodayAsync(Guid userId)
    {
        var todayLocal = GetLocalNow().Date;

        var types = await _context.AbsenceTypes
            .Where(t => t.IsActive && t.DurationMode != DurationMode.hours && t.Code != "home_office")
            .ToDictionaryAsync(t => t.Id, t => t.Code);

        if (types.Count == 0) return null;

        var userAbsences = await _context.AbsenceRequests
            .Where(r => r.UserId == userId && r.Status == AbsenceStatus.completed)
            .ToListAsync();

        var activeToday = userAbsences.FirstOrDefault(r =>
            types.ContainsKey(r.AbsenceTypeId) &&
            r.PlannedStart.Date <= todayLocal && r.PlannedEnd.Date >= todayLocal
        );

        return activeToday != null && types.TryGetValue(activeToday.AbsenceTypeId, out var code) ? code : null;
    }

    /// <summary>
    /// Záznam příchodu (NFC čip pobočky, Kancelář bez ověření nebo Home Office).
    /// </summary>
    [HttpPost("clock-in")]
    public async Task<ActionResult<ApiResponse<TimeEntryDto>>> ClockIn([FromBody] ClockInRequestDto request)
    {
        var callerUserId = request.EditedByUserId ?? GetCurrentUserId();
        var targetUserId = request.UserId ?? callerUserId ?? CurrentUserId;
        var user = await _context.Users.FindAsync(targetUserId);

        if (user != null && !user.IsApproved)
        {
            return StatusCode(403, ApiResponse<TimeEntryDto>.Failure(
                "ERR_ACCOUNT_PENDING_APPROVAL",
                "Uživatelský účet čeká na schválení úvazku Office Managerem."
            ));
        }

        // Kontrola celodenní absence v aktuální den (dovolená, sick day, neplacené volno, nemoc)
        var absenceToday = await GetActiveFullDayAbsenceTodayAsync(targetUserId);
        if (absenceToday != null)
        {
            return BadRequest(ApiResponse<TimeEntryDto>.Failure(
                "ERR_ON_ABSENCE_TODAY",
                "V aktuální den je čerpána celodenní absence (dovolená, sick day, neplacené volno nebo nemoc), proto nelze zaznamenat příchod."
            ));
        }

        await EnsureCrossMidnightShiftsSplitAsync(targetUserId);

        var userEntries = await _context.TimeEntries
            .Where(t => t.UserId == targetUserId)
            .ToListAsync();

        // Kontrola již otevřené aktivní směny
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

        var nowUtc = DateTimeOffset.UtcNow;
        bool isEnteredByOther = callerUserId.HasValue && callerUserId.Value != targetUserId;
        string? editReason = null;
        if (isEnteredByOther)
        {
            var editorUser = await _context.Users.FindAsync(callerUserId!.Value);
            var editorName = !string.IsNullOrWhiteSpace(request.EditedByUserName)
                ? request.EditedByUserName
                : (editorUser?.DisplayName ?? "Oprávněná osoba");
            editReason = $"Příchod zapsán ručně {editorName}";
        }

        var entry = new TimeEntry
        {
            Id = Guid.NewGuid(),
            UserId = targetUserId,
            WorkplaceId = workplaceId,
            StartTime = nowUtc,
            EndTime = null,
            LocationType = locationType,
            IsManual = isEnteredByOther,
            EditedBy = isEnteredByOther ? callerUserId : null,
            EditedAt = isEnteredByOther ? nowUtc : null,
            EditReason = editReason
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
            WorkplaceId = entry.WorkplaceId,
            IsManual = entry.IsManual,
            EditedBy = entry.EditedBy,
            EditedAt = entry.EditedAt,
            EditReason = entry.EditReason
        }));
    }

    /// <summary>
    /// Záznam odchodu (definitivní nebo pauza na Home Office s orientačním návratem).
    /// </summary>
    [HttpPost("clock-out")]
    public async Task<ActionResult<ApiResponse<TimeEntryDto>>> ClockOut([FromBody] ClockOutRequestDto request)
    {
        var callerUserId = request.EditedByUserId ?? GetCurrentUserId();
        var targetUserId = request.UserId ?? callerUserId ?? CurrentUserId;
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
        var localStart = activeShift.StartTime.ToLocalTime();
        bool isContinuationAtMidnight = localStart.TimeOfDay == TimeSpan.Zero;

        // Pokud je rozmezí mezi příchodem a odchodem menší než 1 minuta (< 60 s, tedy i 59 s) a nejde o pokračování noční směny po půlnoci, záznam rovnou vymazat
        if (!isContinuationAtMidnight && durationSeconds < 60.0)
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

        bool isEnteredByOther = callerUserId.HasValue && callerUserId.Value != targetUserId;
        if (isEnteredByOther)
        {
            var editorUser = await _context.Users.FindAsync(callerUserId!.Value);
            var editorName = !string.IsNullOrWhiteSpace(request.EditedByUserName)
                ? request.EditedByUserName
                : (editorUser?.DisplayName ?? "Oprávněná osoba");
            activeShift.IsManual = true;
            activeShift.EditedBy = callerUserId;
            activeShift.EditedAt = nowUtc;
            if (string.IsNullOrWhiteSpace(activeShift.EditReason))
            {
                activeShift.EditReason = $"Příchod zapsán ručně {editorName}";
            }
        }

        // Konečné vyhodnocení ověření pracoviště:
        // Jakmile je příchod NEBO odchod bez NFC karty (a nejde o ruční zápis oprávněnou osobou v Detailu osoby),
        // celý worklog je automaticky neověřený (WorkplaceId = null -> "Kancelář (bez ověření)").
        if (activeShift.LocationType == LocationType.office && !isEnteredByOther)
        {
            bool clockInVerified = activeShift.WorkplaceId.HasValue;
            bool clockOutVerified = false;

            if (!string.IsNullOrEmpty(request.NfcIdentifier))
            {
                var workplace = await _context.Workplaces
                    .FirstOrDefaultAsync(w => w.NfcIdentifier == request.NfcIdentifier && w.IsActive);
                clockOutVerified = workplace != null;
            }

            if (!clockInVerified || !clockOutVerified)
            {
                activeShift.WorkplaceId = null;
            }
        }

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
        await EnsureCrossMidnightShiftsSplitAsync(targetUserId);

        return Ok(ApiResponse<TimeEntryDto>.Success(new TimeEntryDto
        {
            Id = activeShift.Id,
            StartTime = activeShift.StartTime,
            EndTime = activeShift.EndTime,
            LocationType = activeShift.LocationType.ToString(),
            WorkplaceId = activeShift.WorkplaceId,
            IsManual = activeShift.IsManual,
            EditedBy = activeShift.EditedBy,
            EditedAt = activeShift.EditedAt,
            EditReason = activeShift.EditReason
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
        var absenceTypes = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var contractTypes = await _context.ContractTypes.ToDictionaryAsync(c => c.Code, c => c.Name);
        var hoAbsenceTypeName = absenceTypes.Values.FirstOrDefault(t => t.Code == "home_office")?.NameEmployee ?? "Home Office";
        var nowLocal = GetLocalNow();
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
                    status = hoAbsenceTypeName;
                    color = "sky";
                    locationType = "home_office";
                }
            }
            else
            {
                var userTodayAbs = todayAbsences.FirstOrDefault(a =>
                {
                    if (a.UserId != user.Id) return false;
                    if (!absenceTypes.TryGetValue(a.AbsenceTypeId, out var absType)) return false;
                    if (absType.DurationMode == DurationMode.hours)
                    {
                        // Časová propustka se v "Kdo je kde" zobrazuje pouze pokud právě probíhá (od–do)
                        return nowTimeOfDay >= a.PlannedStart.TimeOfDay && nowTimeOfDay <= a.PlannedEnd.TimeOfDay;
                    }
                    return true;
                });
                if (userTodayAbs != null && absenceTypes.TryGetValue(userTodayAbs.AbsenceTypeId, out var typeObj))
                {
                    var typeCode = typeObj.Code;
                    var typeLabel = typeObj.NameEmployee;
                    if (typeObj.DurationMode == DurationMode.hours)
                    {
                        status = $"{typeLabel} ({userTodayAbs.PlannedStart:HH:mm} – {userTodayAbs.PlannedEnd:HH:mm})";
                        color = "indigo";
                        locationType = "doctor";
                    }
                    else
                    {
                        switch (typeCode)
                        {
                            case "sick_day":
                                status = typeLabel;
                                color = "rose";
                                locationType = "sick_day";
                                break;
                            case "illness":
                                status = typeLabel;
                                color = "red";
                                locationType = "illness";
                                break;
                            case "unpaid_leave":
                                status = typeLabel;
                                color = "purple";
                                locationType = "unpaid_leave";
                                break;
                            case "home_office":
                                status = typeLabel;
                                color = "sky";
                                locationType = "home_office";
                                break;
                            default:
                                status = typeLabel;
                                color = "amber";
                                locationType = "vacation";
                                break;
                        }
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
                RoleLabel = UserDisplayHelper.GetRoleLabelCzech(user.Role),
                PhoneNumber = user.PhoneNumber,
                ContractKind = user.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
                ContractType = user.ContractType.ToString().ToLowerInvariant(),
                ContractTypeName = UserDisplayHelper.GetContractDisplayLabel(user.ContractKind, user.ContractType, contractTypes),
                ManagerId = user.ManagerId,
                ManagerName = user.ManagerId.HasValue && userNamesById.TryGetValue(user.ManagerId.Value, out var mName) ? mName : null,
                ParentPersonId = user.ParentPersonId,
                ParentPersonName = user.ParentPersonId.HasValue && userNamesById.TryGetValue(user.ParentPersonId.Value, out var pName) ? pName : null,
                LocationType = locationType,
                StatusText = status,
                StatusColor = color,
                ExpectedReturnAt = user.ExpectedReturnAt,
                IsPermanentHomeOffice = user.IsPermanentHomeOffice
            });
        }

        return Ok(ApiResponse<List<RadarUserDto>>.Success(list));
    }

    /// <summary>
    /// Vrátí lokální datum, ke kterému se směna započítává v kalendáři a při ověřování překryvů.
    /// Pokud záznam začíná přesně o půlnoci (00:00:00), jde o pokračování směny přes půlnoc ze včerejšího dne.
    /// </summary>
    public static DateTime GetShiftOriginLocalDate(TimeEntry entry)
    {
        var localStart = entry.StartTime.ToLocalTime();
        if (localStart.TimeOfDay == TimeSpan.Zero)
        {
            return localStart.Date.AddDays(-1);
        }
        return localStart.Date;
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

        await EnsureCrossMidnightShiftsSplitAsync(targetUserId);

        var todayLocal = GetLocalNow().Date;
        var monday = todayLocal.AddDays(-(int)(todayLocal.DayOfWeek == DayOfWeek.Sunday ? 6 : todayLocal.DayOfWeek - DayOfWeek.Monday));

        var userEntries = await _context.TimeEntries
            .Where(t => t.UserId == targetUserId)
            .ToListAsync();

        var days = new List<DaySummaryDto>();
        for (int i = 0; i < 7; i++)
        {
            var dayDate = monday.AddDays(i);

            var dayEntries = userEntries
                .Where(e => GetShiftOriginLocalDate(e) == dayDate)
                .ToList();

            double hours = 0;
            foreach (var e in dayEntries)
            {
                var end = e.EndTime ?? DateTimeOffset.UtcNow;
                hours += Math.Max(0, (end - e.StartTime).TotalHours);
            }

            days.Add(new DaySummaryDto
            {
                Date = DateOnly.FromDateTime(dayDate),
                DayName = dayDate.ToString("ddd", new System.Globalization.CultureInfo("cs-CZ")),
                HoursWorked = Math.Round(hours, 2),
                HasActiveShift = dayEntries.Any(e => e.EndTime == null),
                IsToday = dayDate == todayLocal
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

        await EnsureCrossMidnightShiftsSplitAsync(targetUserId);

        var nowLocal = GetLocalNow();
        var nowUtc = DateTimeOffset.UtcNow;
        int targetYear = year ?? nowLocal.Year;
        int targetMonth = month ?? nowLocal.Month;

        var allEntries = await _context.TimeEntries
            .Where(t => t.UserId == targetUserId)
            .ToListAsync();

        var userEntries = allEntries
            .Where(t =>
            {
                var originDate = GetShiftOriginLocalDate(t);
                return originDate.Year == targetYear && originDate.Month == targetMonth;
            })
            .ToList();

        double totalSeconds = 0;
        var hoDays = new HashSet<DateOnly>();

        foreach (var entry in userEntries)
        {
            var originDate = GetShiftOriginLocalDate(entry);
            var end = entry.EndTime ?? nowUtc;
            totalSeconds += Math.Max(0, (end - entry.StartTime).TotalSeconds);
            if (entry.LocationType == LocationType.home_office)
            {
                hoDays.Add(DateOnly.FromDateTime(originDate));
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
        decimal coefficient = contractTypeSetting?.Coefficient ?? 1.00m;
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
        int targetYear = year ?? GetLocalNow().Year;
        var holidays = await _context.Holidays.ToListAsync();
        var resolved = Dochazka.Api.Services.HolidayService.GetResolvedHolidaysForYear(holidays, targetYear);
        return Ok(ApiResponse<List<Dochazka.Api.Services.ResolvedHolidayDto>>.Success(resolved));
    }

    /// <summary>
    /// Získá reálné časové záznamy (směny) uživatele pro zadaný rok a měsíc z databáze.
    /// Směny přes půlnoc se započítávají do předchozího dne, kdy byl záznam započat.
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

        await EnsureCrossMidnightShiftsSplitAsync(targetUserId);

        var nowLocal = GetLocalNow();
        var nowUtc = DateTimeOffset.UtcNow;
        int targetYear = year ?? nowLocal.Year;
        int targetMonth = month ?? nowLocal.Month;

        var allEntries = (await _context.TimeEntries
            .Where(t => t.UserId == targetUserId)
            .ToListAsync())
            .OrderBy(t => t.StartTime)
            .ToList();

        var monthEntries = allEntries
            .Where(t =>
            {
                var originDate = GetShiftOriginLocalDate(t);
                return originDate.Year == targetYear && originDate.Month == targetMonth;
            })
            .ToList();

        var workplaces = await _context.Workplaces.ToDictionaryAsync(w => w.Id, w => w.Name);
        var result = new List<TimeEntryDetailDto>();

        foreach (var e in monthEntries)
        {
            var localStart = e.StartTime.ToLocalTime();
            var localEnd = e.EndTime?.ToLocalTime();
            var effectiveEnd = e.EndTime ?? nowUtc;
            var hours = Math.Max(0, Math.Round((effectiveEnd - e.StartTime).TotalHours, 2));
            var originDateStr = GetShiftOriginLocalDate(e).ToString("yyyy-MM-dd");

            // Pokud jde o půlnoční pokračování směny (začátek v 00:00:00), sloučíme ho s předchozí částí směny v daném dni
            if (localStart.TimeOfDay == TimeSpan.Zero)
            {
                var prevDto = result.LastOrDefault(r => r.Date == originDateStr && r.EndTime == "23:59");
                if (prevDto != null)
                {
                    prevDto.EndTime = localEnd?.ToString("HH:mm");
                    prevDto.Hours = Math.Round(prevDto.Hours + hours, 2);
                    continue;
                }
            }

            result.Add(new TimeEntryDetailDto
            {
                Id = e.Id.ToString(),
                Date = originDateStr,
                StartTime = localStart.ToString("HH:mm"),
                EndTime = localEnd?.ToString("HH:mm"),
                Hours = hours,
                LocationType = e.LocationType == LocationType.office ? "office" : "home_office",
                WorkplaceId = e.WorkplaceId?.ToString(),
                WorkplaceName = e.WorkplaceId.HasValue && workplaces.TryGetValue(e.WorkplaceId.Value, out var wpName) ? wpName : null,
                IsManual = e.IsManual,
                EditedBy = e.EditedBy?.ToString(),
                EditedAt = e.EditedAt,
                EditReason = e.EditReason
            });
        }

        return Ok(ApiResponse<List<TimeEntryDetailDto>>.Success(result));
    }
}
