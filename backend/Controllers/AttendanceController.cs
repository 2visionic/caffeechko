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
        if (Request.Headers.TryGetValue("X-User-Id", out var headerVal) && Guid.TryParse(headerVal, out var parsed))
        {
            return parsed;
        }

        if (Request.Headers.TryGetValue("X-Dev-User-Id", out var devVal) && Guid.TryParse(devVal, out var devParsed))
        {
            return devParsed;
        }

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

        return null;
    }

    /// <summary>
    /// Sloučí případné dříve rozdělené půlnoční pokračovací záznamy (začínající v 00:00:00)
    /// zpět do původní směny ze včerejšího dne, aby směna přes půlnoc tvořila jeden celistvý záznam (např. 12:56 – 02:01).
    /// </summary>
    private async Task EnsureCrossMidnightShiftsSplitAsync(Guid userId)
    {
        var entries = (await _context.TimeEntries
            .Where(t => !t.IsDeleted && t.UserId == userId)
            .ToListAsync())
            .OrderBy(t => t.StartTime)
            .ToList();

        var continuations = entries
            .Where(t => t.StartTime.ToLocalTime().TimeOfDay == TimeSpan.Zero)
            .ToList();

        if (continuations.Count == 0)
        {
            return;
        }

        bool changed = false;
        foreach (var cont in continuations)
        {
            var contLocalStart = cont.StartTime.ToLocalTime();
            var originDate = contLocalStart.Date.AddDays(-1);

            var baseEntry = entries
                .Where(t => t.Id != cont.Id &&
                            t.StartTime.ToLocalTime().TimeOfDay != TimeSpan.Zero &&
                            t.StartTime.ToLocalTime().Date == originDate)
                .OrderByDescending(t => t.StartTime)
                .FirstOrDefault();

            if (baseEntry != null)
            {
                if (cont.EndTime == null)
                {
                    baseEntry.EndTime = null;
                }
                else if (baseEntry.EndTime != null && cont.EndTime.Value > baseEntry.EndTime.Value)
                {
                    baseEntry.EndTime = cont.EndTime;
                }

                _context.TimeEntries.Remove(cont);
                changed = true;
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
            .Where(t => !t.IsDeleted && t.UserId == targetUserId)
            .ToListAsync();

        var activeShift = userEntries
            .Where(t => t.EndTime == null)
            .OrderByDescending(t => t.StartTime)
            .FirstOrDefault();

        var todayEntries = userEntries
            .Where(t => t.StartTime.ToLocalTime().Date == todayLocal || t.EndTime == null)
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
                .Where(r => !r.IsDeleted && r.UserId == targetUserId && hourTypeIds.Contains(r.AbsenceTypeId) && r.Status == AbsenceStatus.completed)
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
            .Where(t => t.IsActive && t.DurationMode != DurationMode.hours && !t.IsWorkMode)
            .ToDictionaryAsync(t => t.Id, t => t.Code);

        if (types.Count == 0) return null;

        var userAbsences = await _context.AbsenceRequests
            .Where(r => !r.IsDeleted && r.UserId == userId && r.Status == AbsenceStatus.completed)
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
            .Where(t => !t.IsDeleted && t.UserId == targetUserId)
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
            .Where(t => !t.IsDeleted && t.UserId == targetUserId && t.EndTime == null)
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
    /// Vrátí seznam pracovišť (poboček).
    /// </summary>
    [HttpGet("workplaces")]
    public async Task<ActionResult<ApiResponse<List<WorkplaceDto>>>> GetWorkplaces([FromQuery] bool includeInactive = false)
    {
        var query = _context.Workplaces.Where(w => w.NfcIdentifier != "setup-0");
        if (!includeInactive)
        {
            query = query.Where(w => w.IsActive);
        }

        var list = await query
            .OrderBy(w => w.Name)
            .Select(w => new WorkplaceDto
            {
                Id = w.Id,
                Name = w.Name,
                NfcIdentifier = w.NfcIdentifier,
                NfcHardwareUid = w.NfcHardwareUid,
                Address = w.Address,
                IsActive = w.IsActive,
                HasCardPassword = !string.IsNullOrWhiteSpace(w.NfcKeyEncrypted)
            })
            .ToListAsync();

        return Ok(ApiResponse<List<WorkplaceDto>>.Success(list));
    }

    /// <summary>
    /// Přidá nové pracoviště (pouze Admin).
    /// </summary>
    [HttpPost("workplaces")]
    public async Task<ActionResult<ApiResponse<List<WorkplaceDto>>>> CreateWorkplace([FromBody] WorkplaceDto dto)
    {
        var name = (dto.Name ?? string.Empty).Trim();
        var nfcId = (dto.NfcIdentifier ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(nfcId))
        {
            return BadRequest(ApiResponse<List<WorkplaceDto>>.Failure("ERR_INVALID_INPUT", "Název pracoviště a NFC identifikátor jsou povinné."));
        }

        var exists = await _context.Workplaces.AnyAsync(w => w.NfcIdentifier.ToLower() == nfcId);
        if (exists)
        {
            return BadRequest(ApiResponse<List<WorkplaceDto>>.Failure("ERR_DUPLICATE_NFC_ID", $"Pracoviště s NFC identifikátorem '{nfcId}' již existuje."));
        }

        _context.Workplaces.Add(new Workplace
        {
            Id = Guid.NewGuid(),
            Name = name,
            NfcIdentifier = nfcId,
            NfcHardwareUid = string.IsNullOrWhiteSpace(dto.NfcHardwareUid) ? null : dto.NfcHardwareUid.Trim(),
            Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim(),
            IsActive = dto.IsActive
        });

        await _context.SaveChangesAsync();
        return await GetWorkplaces(includeInactive: true);
    }

    /// <summary>
    /// Upraví existující pracoviště (pouze Admin).
    /// </summary>
    [HttpPut("workplaces/{id}")]
    public async Task<ActionResult<ApiResponse<List<WorkplaceDto>>>> UpdateWorkplace([FromRoute] Guid id, [FromBody] WorkplaceDto dto)
    {
        var wp = await _context.Workplaces.FindAsync(id);
        if (wp == null || wp.NfcIdentifier == "setup-0")
        {
            return NotFound(ApiResponse<List<WorkplaceDto>>.Failure("ERR_NOT_FOUND", "Pracoviště nebylo nalezeno."));
        }

        var name = (dto.Name ?? string.Empty).Trim();
        var nfcId = string.IsNullOrWhiteSpace(dto.NfcIdentifier) ? wp.NfcIdentifier : dto.NfcIdentifier.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(ApiResponse<List<WorkplaceDto>>.Failure("ERR_INVALID_INPUT", "Název pracoviště je povinný."));
        }

        if (!string.Equals(wp.NfcIdentifier, nfcId, StringComparison.OrdinalIgnoreCase))
        {
            var duplicate = await _context.Workplaces.AnyAsync(w => w.Id != id && w.NfcIdentifier.ToLower() == nfcId);
            if (duplicate)
            {
                return BadRequest(ApiResponse<List<WorkplaceDto>>.Failure("ERR_DUPLICATE_NFC_ID", $"Pracoviště s NFC identifikátorem '{nfcId}' již existuje."));
            }
        }

        wp.Name = name;
        wp.NfcIdentifier = nfcId;
        wp.NfcHardwareUid = string.IsNullOrWhiteSpace(dto.NfcHardwareUid) ? null : dto.NfcHardwareUid.Trim();
        wp.Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim();
        wp.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();
        return await GetWorkplaces(includeInactive: true);
    }

    /// <summary>
    /// Smaže pracoviště (pouze Admin).
    /// </summary>
    [HttpDelete("workplaces/{id}")]
    public async Task<ActionResult<ApiResponse<List<WorkplaceDto>>>> DeleteWorkplace([FromRoute] Guid id)
    {
        var wp = await _context.Workplaces.FindAsync(id);
        if (wp == null || wp.NfcIdentifier == "setup-0")
        {
            return NotFound(ApiResponse<List<WorkplaceDto>>.Failure("ERR_NOT_FOUND", "Pracoviště nebylo nalezeno."));
        }

        var entriesWithWp = await _context.TimeEntries.Where(t => t.WorkplaceId == id).ToListAsync();
        foreach (var e in entriesWithWp)
        {
            e.WorkplaceId = null;
        }

        _context.Workplaces.Remove(wp);
        await _context.SaveChangesAsync();
        return await GetWorkplaces(includeInactive: true);
    }

    /// <summary>
    /// Nahraje profil pracoviště na NFC kartu a uloží zašifrované heslo karty (pouze Admin).
    /// </summary>
    [HttpPost("workplaces/{id}/encode-card")]
    public async Task<ActionResult<ApiResponse<WorkplaceDto>>> EncodeWorkplaceCard([FromRoute] Guid id, [FromBody] EncodeWorkplaceCardDto dto)
    {
        var wp = await _context.Workplaces.FindAsync(id);
        if (wp == null || wp.NfcIdentifier == "setup-0")
        {
            return NotFound(ApiResponse<WorkplaceDto>.Failure("ERR_NOT_FOUND", "Pracoviště nebylo nalezeno."));
        }

        if (string.IsNullOrWhiteSpace(dto.Password))
        {
            return BadRequest(ApiResponse<WorkplaceDto>.Failure("ERR_PASSWORD_REQUIRED", "Pro uzamčení zápisu na NFC kartu je nutné zadat heslo."));
        }

        using var sha = System.Security.Cryptography.SHA256.Create();
        var hashBytes = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(dto.Password.Trim()));
        wp.NfcKeyEncrypted = Convert.ToHexString(hashBytes);

        if (!string.IsNullOrWhiteSpace(dto.NfcHardwareUid))
        {
            wp.NfcHardwareUid = dto.NfcHardwareUid.Trim();
        }
        else if (string.IsNullOrWhiteSpace(wp.NfcHardwareUid))
        {
            wp.NfcHardwareUid = $"04{Guid.NewGuid().ToString("N")[..12].ToUpperInvariant()}";
        }

        var callerId = GetCurrentUserId() ?? CurrentUserId;
        _context.Logs.Add(new SystemLog
        {
            Id = Guid.NewGuid(),
            UserId = callerId.ToString(),
            Type = LogType.nfc,
            Status = $"NFC WRITE CARD '{wp.Name}' (nfc:{wp.NfcIdentifier}, uid:{wp.NfcHardwareUid})",
            DateTime = DateTimeOffset.UtcNow
        });

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<WorkplaceDto>.Success(new WorkplaceDto
        {
            Id = wp.Id,
            Name = wp.Name,
            NfcIdentifier = wp.NfcIdentifier,
            NfcHardwareUid = wp.NfcHardwareUid,
            Address = wp.Address,
            IsActive = wp.IsActive,
            HasCardPassword = !string.IsNullOrWhiteSpace(wp.NfcKeyEncrypted)
        }));
    }

    /// <summary>
    /// Kdo je kde – živý přehled přítomnosti všech kolegů v reálném čase.
    /// </summary>
    [HttpGet("who-is-where")]
    [HttpGet("team-presence")]
    [HttpGet("radar")]
    public async Task<ActionResult<ApiResponse<List<RadarUserDto>>>> GetLiveRadar([FromQuery] bool includeInactive = false)
    {
        var martinaId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        var martinaDb = await _context.Users.FindAsync(martinaId);
        if (martinaDb != null && martinaDb.ManagerId != null)
        {
            martinaDb.ManagerId = null;
            var martinaLinks = await _context.UserManagers.Where(um => um.UserId == martinaId).ToListAsync();
            if (martinaLinks.Count > 0) _context.UserManagers.RemoveRange(martinaLinks);
            await _context.SaveChangesAsync();
        }

        var users = await _context.Users.Where(u => u.IsApproved && (includeInactive || u.IsActive)).ToListAsync();
        var callerId = GetCurrentUserId();
        var viewerUser = callerId.HasValue ? users.FirstOrDefault(u => u.Id == callerId.Value) ?? await _context.Users.FindAsync(callerId.Value) : null;
        var userNamesById = users.ToDictionary(u => u.Id, u => u.DisplayName);
        var activeShifts = await _context.TimeEntries
            .Where(t => !t.IsDeleted && t.EndTime == null)
            .ToListAsync();
        var workplaces = await _context.Workplaces.ToDictionaryAsync(w => w.Id, w => w.Name);
        var absenceTypes = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var contractTypes = await _context.ContractTypes.ToDictionaryAsync(c => c.Code, c => c.Name);
        var hoAbsenceType = absenceTypes.Values.FirstOrDefault(t => t.Code == "home_office");
        var nowLocal = GetLocalNow();
        var todayDate = nowLocal.Date;
        var nowTimeOfDay = nowLocal.TimeOfDay;
        await GdprController.EnsureGdprTablesAsync(_context);
        var gdprDocs = await _context.GdprDocuments.ToListAsync();
        var gdprSends = await _context.GdprSends.ToListAsync();
        var activeGdpr = GdprHelper.GetActiveDocument(gdprDocs, todayDate.ToString("yyyy-MM-dd"));
        var allCompletedAbsences = await _context.AbsenceRequests
            .Where(r => !r.IsDeleted && r.Status == AbsenceStatus.completed)
            .ToListAsync();
        var todayAbsences = allCompletedAbsences
            .Where(r => r.PlannedStart.Date <= todayDate && r.PlannedEnd.Date >= todayDate)
            .ToList();

        var list = new List<RadarUserDto>();

        foreach (var user in users)
        {
            var userGdprStatus = GdprHelper.ResolveUserStatus(user.Id, activeGdpr?.Id, gdprSends);
            var shift = activeShifts.FirstOrDefault(s => s.UserId == user.Id);
            string status = "Mimo práci";
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
                    status = hoAbsenceType?.GetDisplayName(user.ContractKind) ?? "Home Office";
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
                    // Home Office se v "Kdo je kde" zobrazuje pouze při aktivním logování směny (shift != null).
                    // Pokud člověk na Home Office neloguje, zůstává ve stavu "Mimo práci" (offline).
                    if (string.Equals(absType.Code, "home_office", StringComparison.OrdinalIgnoreCase))
                    {
                        return false;
                    }
                    if (absType.DurationMode == DurationMode.hours)
                    {
                        // Časová propustka se v "Kdo je kde" zobrazuje pouze pokud právě probíhá (od–do)
                        return nowTimeOfDay >= a.PlannedStart.TimeOfDay && nowTimeOfDay <= a.PlannedEnd.TimeOfDay;
                    }
                    return true;
                });
                if (userTodayAbs != null && absenceTypes.TryGetValue(userTodayAbs.AbsenceTypeId, out var typeObj))
                {
                    if (typeObj.IsPrivate && !AbsenceController.CanViewerSeePrivateAbsence(viewerUser, user, userGdprStatus == "granted"))
                    {
                        status = "Nedostupný";
                        color = "red";
                        locationType = "unavailable";
                    }
                    else
                    {
                        var typeCode = typeObj.Code;
                        var typeLabel = typeObj.GetDisplayName(user.ContractKind);
                        var dbColor = !string.IsNullOrWhiteSpace(typeObj.Color) ? typeObj.Color : null;
                        if (typeObj.DurationMode == DurationMode.hours)
                        {
                            status = $"{typeLabel} ({userTodayAbs.PlannedStart:HH:mm} – {userTodayAbs.PlannedEnd:HH:mm})";
                            color = dbColor ?? "indigo";
                            locationType = "doctor";
                        }
                        else
                        {
                            switch (typeCode)
                            {
                                case "sick_day":
                                    status = typeLabel;
                                    color = dbColor ?? "rose";
                                    locationType = "sick_day";
                                    break;
                                case "illness":
                                    status = typeLabel;
                                    color = dbColor ?? "red";
                                    locationType = "illness";
                                    break;
                                case "unpaid_leave":
                                    status = typeLabel;
                                    color = dbColor ?? "purple";
                                    locationType = "unpaid_leave";
                                    break;
                                case "home_office":
                                    status = typeLabel;
                                    color = dbColor ?? "sky";
                                    locationType = "home_office";
                                    break;
                                default:
                                    status = typeLabel;
                                    color = dbColor ?? "amber";
                                    locationType = typeCode;
                                    break;
                            }
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
                FirstName = user.FirstName,
                LastName = user.LastName,
                IsActive = user.IsActive,
                Email = user.Email,
                Role = user.Role.ToString(),
                RoleLabel = UserDisplayHelper.GetRoleLabelCzech(user.Role),
                PhoneNumber = user.PhoneNumber,
                ContractKind = user.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
                ContractType = UserDisplayHelper.GetContractTypeCode(user),
                ContractTypeName = UserDisplayHelper.GetContractDisplayLabel(user.ContractKind, user.ContractType, contractTypes, user.ContractTypeCode),
                ManagerId = user.ManagerId,
                ManagerName = user.ManagerId.HasValue && userNamesById.TryGetValue(user.ManagerId.Value, out var mName) ? mName : null,
                ParentPersonId = user.ParentPersonId,
                ParentPersonName = user.ParentPersonId.HasValue && userNamesById.TryGetValue(user.ParentPersonId.Value, out var pName) ? pName : null,
                LocationType = locationType,
                StatusText = !user.IsActive ? "Deaktivován" : status,
                StatusColor = !user.IsActive ? "zinc" : color,
                ExpectedReturnAt = user.ExpectedReturnAt,
                IsPermanentHomeOffice = user.IsPermanentHomeOffice,
                IsFemale = user.IsFemale,
                EmploymentStartDate = user.EmploymentStartDate?.ToString("yyyy-MM-dd"),
                GdprStatus = userGdprStatus,
                ActiveGdprDocumentId = activeGdpr?.Id
            });
        }

        return Ok(ApiResponse<List<RadarUserDto>>.Success(list));
    }

    /// <summary>
    /// Úprava profilu osoby (Administrátor, Office Manager, Vedoucí).
    /// </summary>
    [HttpPost("users/{id}/update")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateUserProfile([FromRoute] Guid id, [FromBody] UpdateUserProfileDto dto)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_USER_NOT_FOUND", "Uživatel nebyl nalezen."));
        }

        user.FirstName = (dto.FirstName ?? string.Empty).Trim();
        user.LastName = (dto.LastName ?? string.Empty).Trim();
        user.DisplayName = !string.IsNullOrWhiteSpace(dto.DisplayName)
            ? dto.DisplayName.Trim()
            : $"{user.FirstName} {user.LastName}".Trim();

        if (!string.IsNullOrWhiteSpace(dto.Email)) user.Email = dto.Email.Trim();
        if (dto.PhoneNumber != null) user.PhoneNumber = dto.PhoneNumber.Trim();

        if (Enum.TryParse<UserRole>(dto.Role, true, out var parsedRole))
        {
            user.Role = parsedRole;
        }

        var oldContractCode = UserDisplayHelper.GetContractTypeCode(user);
        var oldStartDate = user.EmploymentStartDate;

        if (Enum.TryParse<ContractKind>(dto.ContractKind, true, out var parsedKind))
        {
            user.ContractKind = parsedKind;
        }

        if (!string.IsNullOrWhiteSpace(dto.ContractTypeCode))
        {
            user.ContractTypeCode = dto.ContractTypeCode.Trim();
            if (Enum.TryParse<ContractType>(dto.ContractTypeCode, true, out var parsedType))
            {
                user.ContractType = parsedType;
            }
        }

        var effectiveCtCode = UserDisplayHelper.GetContractTypeCode(user);
        var ctSetting = await _context.ContractTypes.FirstOrDefaultAsync(c => c.Code.ToLower() == effectiveCtCode.ToLower());
        decimal coeff = ctSetting?.Coefficient ?? (user.ContractType == ContractType.half_time ? 0.50m : user.ContractType == ContractType.part_time ? 0.25m : 1.00m);
        var compSettings = await _context.CompanySettings.FirstOrDefaultAsync();
        decimal dailyHrs = compSettings?.DailyHours ?? 8.00m;
        int weeklyDaysCount = compSettings?.WeeklyWorkDays ?? 5;
        user.WeeklyHoursBudget = Math.Round(dailyHrs * weeklyDaysCount * coeff, 2);

        user.ManagerId = dto.ManagerId;
        user.ParentPersonId = dto.ParentPersonId;
        user.IsFemale = dto.IsFemale;
        user.IsPermanentHomeOffice = dto.IsPermanentHomeOffice;
        if (!string.IsNullOrWhiteSpace(dto.EmploymentStartDate) && DateTime.TryParse(dto.EmploymentStartDate, out var parsedStart))
        {
            user.EmploymentStartDate = new DateTimeOffset(parsedStart.Year, parsedStart.Month, parsedStart.Day, 0, 0, 0, TimeSpan.Zero);
        }
        else if (string.IsNullOrWhiteSpace(dto.EmploymentStartDate))
        {
            user.EmploymentStartDate = null;
        }
        user.UpdatedAt = DateTimeOffset.UtcNow;

        // Synchronizace tabulky user_managers
        var existingManagers = await _context.UserManagers.Where(um => um.UserId == user.Id).ToListAsync();
        if (existingManagers.Count > 0)
        {
            _context.UserManagers.RemoveRange(existingManagers);
        }
        if (user.ManagerId.HasValue)
        {
            _context.UserManagers.Add(new UserManager
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                ManagerId = user.ManagerId.Value,
                ParentPersonId = user.ParentPersonId,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        // Pokud se změnilo datum nástupu nebo úvazek, přepočítáme neuzavřený roční nárok dovolené a sick day
        bool startChanged = oldStartDate?.Date != user.EmploymentStartDate?.Date;
        bool contractChanged = !string.Equals(oldContractCode, effectiveCtCode, StringComparison.OrdinalIgnoreCase);
        if (startChanged || contractChanged)
        {
            int currentYr = DateTimeOffset.UtcNow.Year;
            int targetYr = user.EmploymentStartDate?.Year ?? currentYr;
            int monthsInYr = (user.EmploymentStartDate.HasValue && user.EmploymentStartDate.Value.Year == targetYr)
                ? (12 - user.EmploymentStartDate.Value.Month + 1)
                : 12;

            var absTypes = await _context.AbsenceTypes
                .Where(t => t.Code == "vacation" || t.Code == "sick_day")
                .ToListAsync();
            var userSettings = await _context.UserAbsenceSettings
                .Where(s => s.UserId == user.Id && s.Year == targetYr && !s.IsClosed)
                .ToListAsync();

            foreach (var aType in absTypes)
            {
                decimal baseDef = aType.DefaultAllowance ?? (aType.Code == "vacation" ? 20m : 3m);
                decimal effCoeff = (user.ContractKind == ContractKind.osvc && !aType.AllowOsvc) ? 0m : coeff;
                decimal prorated = Math.Round((baseDef * effCoeff * monthsInYr) / 12.0m, 0, MidpointRounding.AwayFromZero);

                var existingSetting = userSettings.FirstOrDefault(s => s.AbsenceTypeId == aType.Id);
                if (existingSetting != null)
                {
                    existingSetting.AllocatedCapacity = prorated;
                }
                else
                {
                    _context.UserAbsenceSettings.Add(new UserAbsenceSetting
                    {
                        Id = Guid.NewGuid(),
                        UserId = user.Id,
                        AbsenceTypeId = aType.Id,
                        Year = targetYr,
                        BudgetPeriod = BudgetPeriod.yearly,
                        AllocatedCapacity = prorated,
                        CarriedOverDays = 0m,
                        IsPaid = user.ContractKind != ContractKind.osvc
                    });
                }
            }
        }

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Success(true));
    }

    /// <summary>
    /// Vytvoří nového uživatele a inicializuje jeho úvazek a počáteční fondy absencí (Admin a Office Manager).
    /// </summary>
    [HttpPost("users/create")]
    public async Task<ActionResult<ApiResponse<RadarUserDto>>> CreateUser([FromBody] CreateUserDto dto)
    {
        var fName = (dto.FirstName ?? string.Empty).Trim();
        var lName = (dto.LastName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(fName) || string.IsNullOrWhiteSpace(lName))
        {
            return BadRequest(ApiResponse<RadarUserDto>.Failure("ERR_INVALID_NAME", "Jméno a příjmení jsou povinné."));
        }

        var dispName = !string.IsNullOrWhiteSpace(dto.DisplayName)
            ? dto.DisplayName.Trim()
            : $"{fName} {lName}".Trim();

        var email = !string.IsNullOrWhiteSpace(dto.Email)
            ? dto.Email.Trim()
            : $"{fName.ToLowerInvariant()}.{lName.ToLowerInvariant()}@firma.cz";

        if (Enum.TryParse<UserRole>(dto.Role, true, out var parsedRole) == false)
        {
            parsedRole = UserRole.colleague;
        }

        if (Enum.TryParse<ContractKind>(dto.ContractKind, true, out var parsedKind) == false)
        {
            parsedKind = ContractKind.employee;
        }

        var ctCode = string.IsNullOrWhiteSpace(dto.ContractTypeCode) ? "full_time" : dto.ContractTypeCode.Trim();
        var contractTypeSetting = await _context.ContractTypes.FirstOrDefaultAsync(c => c.Code.ToLower() == ctCode.ToLower());
        decimal coeff = contractTypeSetting?.Coefficient ?? 1.00m;

        var cs = await _context.CompanySettings.FirstOrDefaultAsync();
        decimal dailyHours = cs?.DailyHours ?? 8.00m;
        int weeklyDays = cs?.WeeklyWorkDays ?? 5;
        decimal weeklyHoursBudget = Math.Round(dailyHours * weeklyDays * coeff, 2);

        DateTimeOffset? empStartDate = null;
        if (!string.IsNullOrWhiteSpace(dto.EmploymentStartDate) && DateTime.TryParse(dto.EmploymentStartDate, out var parsedEmpStart))
        {
            empStartDate = new DateTimeOffset(parsedEmpStart.Year, parsedEmpStart.Month, parsedEmpStart.Day, 0, 0, 0, TimeSpan.Zero);
        }

        var newUser = new User
        {
            Id = Guid.NewGuid(),
            FirstName = fName,
            LastName = lName,
            DisplayName = dispName,
            Email = email,
            PhoneNumber = dto.PhoneNumber?.Trim(),
            Role = parsedRole,
            ContractKind = parsedKind,
            ContractTypeCode = ctCode,
            ContractType = Enum.TryParse<ContractType>(ctCode, true, out var pt) ? pt : ContractType.full_time,
            WeeklyHoursBudget = weeklyHoursBudget,
            ManagerId = dto.ManagerId,
            ParentPersonId = dto.ParentPersonId,
            IsFemale = dto.IsFemale,
            IsPermanentHomeOffice = dto.IsPermanentHomeOffice,
            EmploymentStartDate = empStartDate,
            IsActive = true,
            IsApproved = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.Users.Add(newUser);

        if (dto.ManagerId.HasValue)
        {
            _context.UserManagers.Add(new UserManager
            {
                Id = Guid.NewGuid(),
                UserId = newUser.Id,
                ManagerId = dto.ManagerId.Value,
                ParentPersonId = dto.ParentPersonId,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        int targetYear = empStartDate?.Year ?? DateTimeOffset.UtcNow.Year;

        // Vytvoření počátečních absencí v user_absence_settings
        var vacType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "vacation");
        var sickType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "sick_day");
        var hoType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "home_office");

        if (vacType != null)
        {
            _context.UserAbsenceSettings.Add(new UserAbsenceSetting
            {
                Id = Guid.NewGuid(),
                UserId = newUser.Id,
                AbsenceTypeId = vacType.Id,
                Year = targetYear,
                BudgetPeriod = BudgetPeriod.yearly,
                AllocatedCapacity = dto.VacationBase,
                CarriedOverDays = dto.VacationCarriedOver,
                IsPaid = true
            });
        }

        if (sickType != null)
        {
            _context.UserAbsenceSettings.Add(new UserAbsenceSetting
            {
                Id = Guid.NewGuid(),
                UserId = newUser.Id,
                AbsenceTypeId = sickType.Id,
                Year = targetYear,
                BudgetPeriod = BudgetPeriod.yearly,
                AllocatedCapacity = dto.SickDaysTotal,
                CarriedOverDays = 0m,
                MaxPerMonthOverride = sickType.MaxPerMonthLimit,
                IsPaid = true
            });
        }

        if (hoType != null)
        {
            BudgetPeriod hoPeriod = BudgetPeriod.unlimited;
            decimal? hoCap = null;
            if (dto.HomeOfficePeriod == "disabled")
            {
                hoPeriod = BudgetPeriod.yearly;
                hoCap = 0m;
            }
            else if (dto.HomeOfficePeriod == "weekly")
            {
                hoPeriod = BudgetPeriod.weekly;
                hoCap = dto.HomeOfficeDaysLimit ?? 5m;
            }
            else if (dto.HomeOfficePeriod == "yearly")
            {
                hoPeriod = BudgetPeriod.yearly;
                hoCap = dto.HomeOfficeDaysLimit ?? 20m;
            }

            _context.UserAbsenceSettings.Add(new UserAbsenceSetting
            {
                Id = Guid.NewGuid(),
                UserId = newUser.Id,
                AbsenceTypeId = hoType.Id,
                Year = targetYear,
                BudgetPeriod = hoPeriod,
                AllocatedCapacity = hoCap,
                CarriedOverDays = 0m,
                IsPaid = true
            });
        }

        await _context.SaveChangesAsync();

        var mgrUser = newUser.ManagerId.HasValue ? await _context.Users.FindAsync(newUser.ManagerId.Value) : null;
        var parentUser = newUser.ParentPersonId.HasValue ? await _context.Users.FindAsync(newUser.ParentPersonId.Value) : null;

        var createdDto = new RadarUserDto
        {
            UserId = newUser.Id,
            DisplayName = newUser.DisplayName,
            FirstName = newUser.FirstName,
            LastName = newUser.LastName,
            IsActive = newUser.IsActive,
            Email = newUser.Email,
            Role = newUser.Role.ToString(),
            RoleLabel = UserDisplayHelper.GetRoleLabelCzech(newUser.Role),
            PhoneNumber = newUser.PhoneNumber,
            ContractKind = newUser.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
            ContractType = ctCode,
            ContractTypeName = contractTypeSetting?.Name ?? ctCode,
            ManagerId = newUser.ManagerId,
            ManagerName = mgrUser?.DisplayName,
            ParentPersonId = newUser.ParentPersonId,
            ParentPersonName = parentUser?.DisplayName,
            LocationType = "offline",
            StatusText = "Mimo kancelář",
            StatusColor = "zinc",
            IsPermanentHomeOffice = newUser.IsPermanentHomeOffice,
            IsFemale = newUser.IsFemale,
            EmploymentStartDate = newUser.EmploymentStartDate?.ToString("yyyy-MM-dd")
        };

        return Ok(ApiResponse<RadarUserDto>.Success(createdDto));
    }

    /// <summary>
    /// Přepne stav aktivity uživatele (aktivní / deaktivovaný).
    /// </summary>
    [HttpPost("users/{id}/toggle-active")]
    public async Task<ActionResult<ApiResponse<object>>> ToggleUserActive([FromRoute] Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            return NotFound(ApiResponse<object>.Failure("ERR_USER_NOT_FOUND", "Uživatel nebyl nalezen."));
        }

        user.IsActive = !user.IsActive;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(ApiResponse<object>.Success(new
        {
            isActive = user.IsActive,
            message = user.IsActive
                ? $"Osoba {user.DisplayName} byla aktivována."
                : $"Osoba {user.DisplayName} byla deaktivována."
        }));
    }

    /// <summary>
    /// Seznam známých křestních jmen ze slovníku name_declensions.
    /// </summary>
    [HttpGet("name-declensions")]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetNameDeclensions()
    {
        var names = await _context.NameDeclensions
            .Select(d => d.Nominative.ToLower())
            .Distinct()
            .ToListAsync();
        return Ok(ApiResponse<List<string>>.Success(names));
    }

    /// <summary>
    /// Přidá záznam křestního jména do name_declensions.
    /// </summary>
    [HttpPost("name-declensions")]
    public async Task<ActionResult<ApiResponse<bool>>> AddNameDeclension([FromBody] NameDeclensionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nominative))
        {
            return BadRequest(ApiResponse<bool>.Failure("ERR_NAME_REQUIRED", "Křestní jméno je povinné."));
        }

        var nomLower = dto.Nominative.Trim().ToLower();
        var existing = await _context.NameDeclensions.FirstOrDefaultAsync(d => d.Nominative.ToLower() == nomLower);
        if (existing == null)
        {
            var firstUpper = char.ToUpper(nomLower[0]) + nomLower[1..];
            _context.NameDeclensions.Add(new NameDeclension
            {
                Id = Guid.NewGuid(),
                Nominative = nomLower,
                Genitive = dto.Genitive ?? firstUpper,
                Dative = dto.Dative ?? firstUpper,
                Accusative = dto.Accusative ?? firstUpper,
                Vocative = dto.Vocative ?? firstUpper,
                Locative = dto.Locative ?? firstUpper,
                Instrumental = dto.Instrumental ?? firstUpper
            });
            await _context.SaveChangesAsync();
        }

        return Ok(ApiResponse<bool>.Success(true));
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
            .Where(t => !t.IsDeleted && t.UserId == targetUserId)
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
            .Where(t => !t.IsDeleted && t.UserId == targetUserId)
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

        var companySetting = await _context.CompanySettings.FirstOrDefaultAsync();
        decimal baseDailyHours = companySetting?.DailyHours ?? 8.00m;

        var cTypeStr = user != null ? UserDisplayHelper.GetContractTypeCode(user) : "full_time";
        var contractTypeSetting = await _context.ContractTypes.FirstOrDefaultAsync(ct => ct.Code.ToLower() == cTypeStr.ToLower());
        decimal coefficient = contractTypeSetting?.Coefficient ?? (user?.ContractType == ContractType.half_time ? 0.50m : user?.ContractType == ContractType.part_time ? 0.25m : 1.00m);
        decimal dailyTargetHours = Math.Round(baseDailyHours * coefficient, 2);

        int daysInMonth = DateTime.DaysInMonth(targetYear, targetMonth);
        var monthStartDate = new DateTime(targetYear, targetMonth, 1);
        var monthEndDate = new DateTime(targetYear, targetMonth, daysInMonth);

        var absenceTypesById = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var userApprovedAbsences = (await _context.AbsenceRequests
            .Where(r => !r.IsDeleted && r.UserId == targetUserId && r.Status == AbsenceStatus.completed)
            .ToListAsync())
            .Where(r => r.PlannedStart.Date <= monthEndDate && r.PlannedEnd.Date >= monthStartDate)
            .ToList();

        int workDays = 0;
        decimal deductedAbsenceHours = 0m;
        int workDaysUpToCutoff = 0;
        decimal deductedAbsenceHoursUpToCutoff = 0m;
        double secondsWorkedUpToCutoff = 0;

        bool isCurrentMonth = targetYear == nowLocal.Year && targetMonth == nowLocal.Month;
        bool isPastMonth = targetYear < nowLocal.Year || (targetYear == nowLocal.Year && targetMonth < nowLocal.Month);
        int cutoffDay = isCurrentMonth ? nowLocal.Day : (isPastMonth ? daysInMonth : 0);

        foreach (var entry in userEntries)
        {
            var originDate = GetShiftOriginLocalDate(entry);
            if (originDate.Day <= cutoffDay)
            {
                var end = entry.EndTime ?? nowUtc;
                secondsWorkedUpToCutoff += Math.Max(0, (end - entry.StartTime).TotalSeconds);
            }
        }

        for (int d = 1; d <= daysInMonth; d++)
        {
            var dt = new DateOnly(targetYear, targetMonth, d);
            var dayDate = new DateTime(targetYear, targetMonth, d);
            var dayOfWeek = dayDate.DayOfWeek;
            if (dayOfWeek != DayOfWeek.Saturday && dayOfWeek != DayOfWeek.Sunday && !holidayDates.Contains(dt))
            {
                workDays++;

                decimal dayDeducted = 0m;
                foreach (var req in userApprovedAbsences)
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
                            dayDeducted += dailyTargetHours;
                        }
                    }
                }
                if (dayDeducted > dailyTargetHours)
                {
                    dayDeducted = dailyTargetHours;
                }
                deductedAbsenceHours += dayDeducted;

                if (d <= cutoffDay)
                {
                    workDaysUpToCutoff++;
                    deductedAbsenceHoursUpToCutoff += dayDeducted;
                }
            }
        }

        decimal baseFundHours = Math.Round(workDays * dailyTargetHours, 2);
        decimal fundHours = Math.Max(0m, Math.Round(baseFundHours - deductedAbsenceHours, 2));

        decimal baseFundUpToCutoff = Math.Round(workDaysUpToCutoff * dailyTargetHours, 2);
        decimal fundUpToCutoff = Math.Max(0m, Math.Round(baseFundUpToCutoff - deductedAbsenceHoursUpToCutoff, 2));

        double hoursWorked = Math.Round(totalSeconds / 3600.0, 2);
        double hoursWorkedUpToCutoff = Math.Round(secondsWorkedUpToCutoff / 3600.0, 2);

        // Přesčas balance: v aktuálním měsíci vždy k dnešnímu dni (do mínusu i do plusu), v minulých měsících za celý měsíc
        double overtimeBalance = cutoffDay > 0
            ? Math.Round(hoursWorkedUpToCutoff - (double)fundUpToCutoff, 2)
            : 0;

        // Saldo převedených přesčasů z měsíčních uzávěrek daného člověka v daném roce (pokud záznam neexistuje, nic nesčítáme = 0)
        var userYearClosures = await _context.MonthlyClosures
            .Where(mc => mc.UserId == targetUserId && mc.Year == targetYear && mc.Month <= targetMonth)
            .OrderBy(mc => mc.Month)
            .ToListAsync();

        decimal carriedOverSaldo = 0m;
        foreach (var mc in userYearClosures)
        {
            carriedOverSaldo += mc.NetSaldoChangeHours;
        }
        if (carriedOverSaldo < 0m) carriedOverSaldo = 0m;

        var currentMonthClosure = userYearClosures.FirstOrDefault(mc => mc.Month == targetMonth);
        if (currentMonthClosure != null && !isCurrentMonth)
        {
            // Pokud je minulý měsíc již uzavřen, zohledníme případné čerpání/převod salda provedené v uzávěrce
            overtimeBalance = Math.Round(overtimeBalance + (double)currentMonthClosure.SaldoUsedHours - (double)currentMonthClosure.OvertimeToSaldoHours, 2);
        }

        return Ok(ApiResponse<MonthSummaryDto>.Success(new MonthSummaryDto
        {
            Year = targetYear,
            Month = targetMonth,
            HoursWorked = Math.Round(hoursWorked, 1),
            FundHours = (double)Math.Round(fundHours, 1),
            DailyTargetHours = (double)dailyTargetHours,
            FteCoefficient = (double)coefficient,
            OvertimeHours = overtimeBalance,
            CarriedOverSaldoHours = (double)Math.Round(carriedOverSaldo, 2),
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
            .Where(t => !t.IsDeleted && t.UserId == targetUserId)
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

        var entryIds = monthEntries.Select(e => e.Id).ToList();
        var editLogsList = (await _context.TimeEntryEditLogs
            .Where(l => entryIds.Contains(l.TimeEntryId))
            .ToListAsync())
            .OrderByDescending(l => l.EditedAt)
            .ToList();

        var editLogsByEntry = editLogsList
            .GroupBy(l => l.TimeEntryId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(l => new RecordEditLogDto
                {
                    Id = l.Id.ToString(),
                    EditedByUserId = l.EditedByUserId.ToString(),
                    EditedByName = l.EditedByName,
                    EditedAt = l.EditedAt.ToString("O"),
                    Summary = l.Summary
                }).ToList()
            );

        var workplaces = await _context.Workplaces.ToDictionaryAsync(w => w.Id, w => w.Name);
        var result = new List<TimeEntryDetailDto>();

        foreach (var e in monthEntries)
        {
            var localStart = e.StartTime.ToLocalTime();
            var localEnd = e.EndTime?.ToLocalTime();
            var effectiveEnd = e.EndTime ?? nowUtc;
            var hours = Math.Max(0, Math.Round((effectiveEnd - e.StartTime).TotalHours, 2));
            var originDateStr = GetShiftOriginLocalDate(e).ToString("yyyy-MM-dd");
            var entryLogs = editLogsByEntry.TryGetValue(e.Id, out var logs) ? logs : new List<RecordEditLogDto>();

            // Pokud jde o půlnoční pokračování směny (začátek v 00:00:00), sloučíme ho s předchozí částí směny v daném dni
            if (localStart.TimeOfDay == TimeSpan.Zero)
            {
                var prevDto = result.LastOrDefault(r => r.Date == originDateStr && r.EndTime == "23:59");
                if (prevDto != null)
                {
                    prevDto.EndTime = localEnd?.ToString("HH:mm");
                    prevDto.Hours = Math.Round(prevDto.Hours + hours, 2);
                    if (entryLogs.Count > 0)
                    {
                        prevDto.EditLogs = prevDto.EditLogs.Concat(entryLogs).OrderByDescending(l => l.EditedAt).ToList();
                    }
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
                EditReason = e.EditReason,
                EditLogs = entryLogs
            });
        }

        return Ok(ApiResponse<List<TimeEntryDetailDto>>.Success(result));
    }

    /// <summary>
    /// Upraví záznam přítomnosti (směnu) ve výkazech (pouze Administrátor a Office Manager) a zapíše log úpravy.
    /// </summary>
    [HttpPost("entries/{id}/update")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateTimeEntry([FromRoute] Guid id, [FromBody] UpdateTimeEntryDto dto)
    {
        var entry = await _context.TimeEntries.FindAsync(id);
        if (entry == null || entry.IsDeleted)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_ENTRY_NOT_FOUND", "Záznam přítomnosti nebyl nalezen."));
        }

        var callerId = dto.EditedByUserId ?? GetCurrentUserId() ?? CurrentUserId;
        var caller = await _context.Users.FindAsync(callerId);
        if (caller == null || (caller.Role != UserRole.admin && caller.Role != UserRole.office_manager))
        {
            return StatusCode(403, ApiResponse<bool>.Failure("ERR_FORBIDDEN", "Upravovat výkazy mohou pouze role Administrátor a Office Manager."));
        }

        var localStart = entry.StartTime.ToLocalTime();
        var prevStartStr = localStart.ToString("HH:mm");
        var prevEndStr = entry.EndTime.HasValue ? entry.EndTime.Value.ToLocalTime().ToString("HH:mm") : "probíhá";
        var prevLocationType = entry.LocationType;
        var prevWorkplaceId = entry.WorkplaceId;
        var baseDate = !string.IsNullOrWhiteSpace(dto.Date) && DateTime.TryParse(dto.Date, out var parsedDate)
            ? parsedDate.Date
            : GetShiftOriginLocalDate(entry);

        bool removedContinuation = false;
        // Pokud měl tento záznam navazující půlnoční pokračování (protože končil ve 23:59:59), odstraníme navazující půlnoční část před přepočtem
        if (entry.EndTime.HasValue)
        {
            var prevLocalEnd = entry.EndTime.Value.ToLocalTime();
            if (prevLocalEnd.Hour == 23 && prevLocalEnd.Minute == 59)
            {
                var nextMidnightLocal = prevLocalEnd.Date.AddDays(1);
                var userEntries = await _context.TimeEntries
                    .Where(t => !t.IsDeleted && t.UserId == entry.UserId && t.Id != entry.Id)
                    .ToListAsync();
                var continuation = userEntries.FirstOrDefault(t => t.StartTime.ToLocalTime() == nextMidnightLocal);
                if (continuation != null)
                {
                    if (continuation.EndTime.HasValue)
                    {
                        prevEndStr = continuation.EndTime.Value.ToLocalTime().ToString("HH:mm");
                    }
                    _context.TimeEntries.Remove(continuation);
                    removedContinuation = true;
                }
            }
        }

        var startTimeParts = (dto.StartTime ?? localStart.ToString("HH:mm")).Split(':');
        var newStartLocal = new DateTime(baseDate.Year, baseDate.Month, baseDate.Day, int.Parse(startTimeParts[0]), int.Parse(startTimeParts[1]), 0);
        var startOffset = TimeZoneInfo.Local.GetUtcOffset(newStartLocal);
        entry.StartTime = new DateTimeOffset(newStartLocal, startOffset).ToUniversalTime();

        if (!string.IsNullOrWhiteSpace(dto.EndTime) && dto.EndTime.Contains(':'))
        {
            var endTimeParts = dto.EndTime.Split(':');
            var newEndLocal = new DateTime(baseDate.Year, baseDate.Month, baseDate.Day, int.Parse(endTimeParts[0]), int.Parse(endTimeParts[1]), 0);
            if (newEndLocal < newStartLocal)
            {
                newEndLocal = newEndLocal.AddDays(1);
            }
            var endOffset = TimeZoneInfo.Local.GetUtcOffset(newEndLocal);
            entry.EndTime = new DateTimeOffset(newEndLocal, endOffset).ToUniversalTime();
        }

        if (!string.IsNullOrWhiteSpace(dto.LocationType))
        {
            if (dto.LocationType == "home_office")
            {
                entry.LocationType = LocationType.home_office;
                entry.WorkplaceId = null;
            }
            else
            {
                entry.LocationType = LocationType.office;
                // Zachovat stav ověřené kanceláře (WorkplaceId), pokud nebylo předáno jiné pracoviště
                entry.WorkplaceId = dto.WorkplaceId ?? entry.WorkplaceId;
            }
        }

        if (entry.LocationType == LocationType.office && entry.WorkplaceId == null && (dto.VerifyOffice == true || dto.LocationType == "office"))
        {
            var defaultWp = await _context.Workplaces
                .Where(w => w.IsActive && w.NfcIdentifier != "setup-0")
                .OrderBy(w => w.Name)
                .FirstOrDefaultAsync()
                ?? await _context.Workplaces.FirstOrDefaultAsync(w => w.IsActive);
            if (defaultWp != null)
            {
                entry.WorkplaceId = defaultWp.Id;
            }
        }

        var nextStartStr = entry.StartTime.ToLocalTime().ToString("HH:mm");
        var nextEndStr = entry.EndTime.HasValue ? entry.EndTime.Value.ToLocalTime().ToString("HH:mm") : "probíhá";
        if (!removedContinuation &&
            nextStartStr == prevStartStr &&
            nextEndStr == prevEndStr &&
            entry.LocationType == prevLocationType &&
            entry.WorkplaceId == prevWorkplaceId)
        {
            return Ok(ApiResponse<bool>.Success(true));
        }

        var nowUtc = DateTimeOffset.UtcNow;
        var editorName = !string.IsNullOrWhiteSpace(dto.EditedByUserName) ? dto.EditedByUserName : caller.DisplayName;
        entry.IsManual = true;
        entry.EditedBy = caller.Id;
        entry.EditedAt = nowUtc;
        if (!string.IsNullOrWhiteSpace(dto.EditReason))
        {
            entry.EditReason = dto.EditReason;
        }

        bool isFem = caller.IsFemale || editorName.Trim().EndsWith("á");
        string verb = isFem ? "změnila z" : "změnil z";
        bool onlyVerifiedOffice = prevWorkplaceId == null && entry.WorkplaceId != null &&
                                  nextStartStr == prevStartStr && nextEndStr == prevEndStr &&
                                  entry.LocationType == prevLocationType;
        string summaryText = onlyVerifiedOffice
            ? (isFem ? "ověřila přítomnost v kanceláři" : "ověřil přítomnost v kanceláři")
            : $"{verb} {prevStartStr} – {prevEndStr}";

        _context.TimeEntryEditLogs.Add(new TimeEntryEditLog
        {
            Id = Guid.NewGuid(),
            TimeEntryId = entry.Id,
            EditedByUserId = caller.Id,
            EditedByName = editorName,
            EditedAt = nowUtc,
            Summary = summaryText
        });

        await _context.SaveChangesAsync();
        await EnsureCrossMidnightShiftsSplitAsync(entry.UserId);

        return Ok(ApiResponse<bool>.Success(true));
    }

    /// <summary>
    /// Soft-delete záznamu přítomnosti (směny) ve výkazech (IsDeleted = true) pro Administrátora nebo Office Managera.
    /// </summary>
    [HttpPost("entries/{id}/delete")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteTimeEntry([FromRoute] Guid id, [FromBody] DeleteRecordRequestDto? dto)
    {
        var entry = await _context.TimeEntries.FindAsync(id);
        if (entry == null || entry.IsDeleted)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_ENTRY_NOT_FOUND", "Záznam přítomnosti nebyl nalezen."));
        }

        var callerId = dto?.DeletedByUserId ?? GetCurrentUserId() ?? CurrentUserId;
        var caller = await _context.Users.FindAsync(callerId);
        if (caller == null || (caller.Role != UserRole.admin && caller.Role != UserRole.office_manager))
        {
            return StatusCode(403, ApiResponse<bool>.Failure("ERR_FORBIDDEN", "Mazat záznamy výkazů mohou pouze role Administrátor a Office Manager."));
        }

        var nowUtc = DateTimeOffset.UtcNow;
        entry.IsDeleted = true;
        entry.DeletedAt = nowUtc;
        entry.DeletedBy = caller.Id;

        bool isFem = caller.IsFemale || caller.DisplayName.Trim().EndsWith("á");
        _context.TimeEntryEditLogs.Add(new TimeEntryEditLog
        {
            Id = Guid.NewGuid(),
            TimeEntryId = entry.Id,
            EditedByUserId = caller.Id,
            EditedByName = caller.DisplayName,
            EditedAt = nowUtc,
            Summary = isFem ? "smazala záznam" : "smazal záznam"
        });

        // Pokud šlo o směnu přes půlnoc (končící ve 23:59), označit jako smazanou i navazující půlnoční část
        if (entry.EndTime.HasValue)
        {
            var prevLocalEnd = entry.EndTime.Value.ToLocalTime();
            if (prevLocalEnd.Hour == 23 && prevLocalEnd.Minute == 59)
            {
                var nextMidnightLocal = prevLocalEnd.Date.AddDays(1);
                var userEntries = await _context.TimeEntries
                    .Where(t => !t.IsDeleted && t.UserId == entry.UserId && t.Id != entry.Id)
                    .ToListAsync();
                var continuation = userEntries.FirstOrDefault(t => t.StartTime.ToLocalTime() == nextMidnightLocal);
                if (continuation != null)
                {
                    continuation.IsDeleted = true;
                    continuation.DeletedAt = nowUtc;
                    continuation.DeletedBy = caller.Id;
                }
            }
        }

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Success(true));
    }

    /// <summary>
    /// Vrátí všechny smazané záznamy docházky (IsDeleted == true) pro Odpadkový koš (pouze Administrátor a Office Manager).
    /// </summary>
    [HttpGet("entries/deleted")]
    public async Task<ActionResult<ApiResponse<List<DeletedTimeEntryDto>>>> GetDeletedTimeEntries()
    {
        var deletedEntries = await _context.TimeEntries
            .Where(t => t.IsDeleted)
            .ToListAsync();

        var users = await _context.Users.ToDictionaryAsync(u => u.Id, u => u);
        var workplaces = await _context.Workplaces.ToDictionaryAsync(w => w.Id, w => w.Name);

        var entryIds = deletedEntries.Select(e => e.Id).ToList();
        var editLogsList = entryIds.Count > 0
            ? await _context.TimeEntryEditLogs
                .Where(l => entryIds.Contains(l.TimeEntryId))
                .ToListAsync()
            : new List<TimeEntryEditLog>();

        var editLogsByEntry = editLogsList
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
                    .ToList()
            );

        // Vynecháme půlnoční pokračování (začínající 00:00:00), pokud existuje hlavní předpůlnoční část, abychom v koši neukazovali jeden log 2x
        var result = new List<DeletedTimeEntryDto>();
        foreach (var e in deletedEntries.OrderByDescending(x => x.DeletedAt ?? x.StartTime))
        {
            var localStart = e.StartTime.ToLocalTime();
            var localEnd = e.EndTime?.ToLocalTime();

            if (localStart.TimeOfDay == TimeSpan.Zero)
            {
                var prevDate = localStart.Date.AddDays(-1);
                var hasOriginDeleted = deletedEntries.Any(p =>
                    p.UserId == e.UserId &&
                    p.Id != e.Id &&
                    p.EndTime.HasValue &&
                    p.EndTime.Value.ToLocalTime().Date == prevDate &&
                    p.EndTime.Value.ToLocalTime().Hour == 23 &&
                    p.EndTime.Value.ToLocalTime().Minute == 59);
                if (hasOriginDeleted)
                {
                    continue;
                }
            }

            DateTimeOffset? displayEnd = e.EndTime;
            if (localEnd.HasValue && localEnd.Value.Hour == 23 && localEnd.Value.Minute == 59)
            {
                var nextMidnight = localEnd.Value.Date.AddDays(1);
                var continuation = deletedEntries.FirstOrDefault(c =>
                    c.UserId == e.UserId &&
                    c.Id != e.Id &&
                    c.StartTime.ToLocalTime() == nextMidnight);
                if (continuation != null)
                {
                    displayEnd = continuation.EndTime;
                }
            }

            var effectiveEnd = displayEnd ?? DateTimeOffset.UtcNow;
            var hours = Math.Max(0, Math.Round((effectiveEnd - e.StartTime).TotalHours, 2));
            users.TryGetValue(e.UserId, out var u);
            string? deletedByName = null;
            if (e.DeletedBy.HasValue && users.TryGetValue(e.DeletedBy.Value, out var delUser))
            {
                deletedByName = delUser.DisplayName;
            }

            result.Add(new DeletedTimeEntryDto
            {
                Id = e.Id.ToString(),
                UserId = e.UserId.ToString(),
                UserName = u?.DisplayName ?? "Neznámý uživatel",
                IsPermanentHomeOffice = u?.IsPermanentHomeOffice ?? false,
                Date = localStart.ToString("yyyy-MM-dd"),
                StartTime = localStart.ToString("HH:mm"),
                EndTime = displayEnd?.ToLocalTime().ToString("HH:mm"),
                Hours = hours,
                LocationType = e.LocationType.ToString(),
                WorkplaceId = e.WorkplaceId?.ToString(),
                WorkplaceName = e.WorkplaceId.HasValue && workplaces.TryGetValue(e.WorkplaceId.Value, out var wpName) ? wpName : null,
                IsManual = e.IsManual,
                EditedBy = e.EditedBy?.ToString(),
                EditedAt = e.EditedAt,
                EditReason = e.EditReason,
                DeletedAt = e.DeletedAt,
                DeletedByName = deletedByName,
                EditLogs = editLogsByEntry.TryGetValue(e.Id, out var logs) ? logs : new List<RecordEditLogDto>()
            });
        }

        return Ok(ApiResponse<List<DeletedTimeEntryDto>>.Success(result));
    }

    /// <summary>
    /// Obnoví smazaný záznam docházky z Odpadkového koše (IsDeleted = false) pro Administrátora nebo Office Managera.
    /// Před obnovením zkontroluje kolizi s aktivní absencí nebo jiným záznamem přítomnosti.
    /// </summary>
    [HttpPost("entries/{id}/restore")]
    public async Task<ActionResult<ApiResponse<bool>>> RestoreTimeEntry([FromRoute] Guid id, [FromBody] DeleteRecordRequestDto? dto)
    {
        var entry = await _context.TimeEntries.FindAsync(id);
        if (entry == null || !entry.IsDeleted)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_ENTRY_NOT_FOUND", "Smazaný záznam nebyl nalezen."));
        }

        var callerId = dto?.DeletedByUserId ?? GetCurrentUserId() ?? CurrentUserId;
        var caller = await _context.Users.FindAsync(callerId);
        if (caller == null || (caller.Role != UserRole.admin && caller.Role != UserRole.office_manager))
        {
            return StatusCode(403, ApiResponse<bool>.Failure("ERR_FORBIDDEN", "Obnovovat záznamy z koše mohou pouze role Administrátor a Office Manager."));
        }

        var originDate = GetShiftOriginLocalDate(entry);
        var entryStartLocal = entry.StartTime.ToLocalTime();
        var entryEndLocal = (entry.EndTime ?? DateTimeOffset.UtcNow).ToLocalTime();

        // 1. Kontrola kolize s aktivními absencemi daného uživatele
        var allTypes = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var activeAbsences = await _context.AbsenceRequests
            .Where(r => !r.IsDeleted && r.UserId == entry.UserId && (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending))
            .ToListAsync();

        foreach (var abs in activeAbsences)
        {
            if (originDate >= abs.PlannedStart.Date && originDate <= abs.PlannedEnd.Date)
            {
                allTypes.TryGetValue(abs.AbsenceTypeId, out var absType);
                if (absType?.IsWorkMode == true) continue;

                var typeName = absType?.NameEmployee ?? "Absence";
                if (absType?.DurationMode == DurationMode.hours)
                {
                    if (entryStartLocal.TimeOfDay == TimeSpan.Zero) continue;
                    var shiftStartTod = entryStartLocal.TimeOfDay;
                    var shiftEndTod = entryEndLocal.Date > originDate ? TimeSpan.FromHours(24) : entryEndLocal.TimeOfDay;
                    if (abs.PlannedStart.TimeOfDay < shiftEndTod && abs.PlannedEnd.TimeOfDay > shiftStartTod)
                    {
                        return BadRequest(ApiResponse<bool>.Failure("ERR_OVERLAP_ABSENCE", $"Nelze obnovit záznam docházky: čas koliduje s evidovanou absencí ({typeName}, {abs.PlannedStart:dd.MM.yyyy} {abs.PlannedStart:HH:mm}–{abs.PlannedEnd:HH:mm})."));
                    }
                }
                else
                {
                    return BadRequest(ApiResponse<bool>.Failure("ERR_OVERLAP_ABSENCE", $"Nelze obnovit záznam docházky: dne {originDate:dd.MM.yyyy} je evidována celodenní absence ({typeName})."));
                }
            }
        }

        // 2. Kontrola kolize s jiným aktivním záznamem přítomnosti
        var activeEntries = await _context.TimeEntries
            .Where(t => !t.IsDeleted && t.UserId == entry.UserId && t.Id != entry.Id)
            .ToListAsync();

        var entryEffEnd = entry.EndTime ?? DateTimeOffset.UtcNow;
        foreach (var other in activeEntries)
        {
            var otherEffEnd = other.EndTime ?? DateTimeOffset.UtcNow;
            if (entry.StartTime < otherEffEnd && entryEffEnd > other.StartTime)
            {
                var oStart = other.StartTime.ToLocalTime();
                var oEnd = otherEffEnd.ToLocalTime();
                return BadRequest(ApiResponse<bool>.Failure("ERR_OVERLAP_PRESENCE", $"Nelze obnovit záznam docházky: čas se překrývá s jiným záznamem přítomnosti ({oStart:dd.MM.yyyy} {oStart:HH:mm}–{oEnd:HH:mm})."));
            }
        }

        var nowUtc = DateTimeOffset.UtcNow;
        entry.IsDeleted = false;
        entry.DeletedAt = null;
        entry.DeletedBy = null;

        bool isFem = caller.IsFemale || caller.DisplayName.Trim().EndsWith("á");
        _context.TimeEntryEditLogs.Add(new TimeEntryEditLog
        {
            Id = Guid.NewGuid(),
            TimeEntryId = entry.Id,
            EditedByUserId = caller.Id,
            EditedByName = caller.DisplayName,
            EditedAt = nowUtc,
            Summary = isFem ? "obnovila záznam" : "obnovil záznam"
        });

        if (entry.EndTime.HasValue)
        {
            var prevLocalEnd = entry.EndTime.Value.ToLocalTime();
            if (prevLocalEnd.Hour == 23 && prevLocalEnd.Minute == 59)
            {
                var nextMidnightLocal = prevLocalEnd.Date.AddDays(1);
                var userDeletedEntries = await _context.TimeEntries
                    .Where(t => t.IsDeleted && t.UserId == entry.UserId && t.Id != entry.Id)
                    .ToListAsync();
                var continuation = userDeletedEntries.FirstOrDefault(t => t.StartTime.ToLocalTime() == nextMidnightLocal);
                if (continuation != null)
                {
                    continuation.IsDeleted = false;
                    continuation.DeletedAt = null;
                    continuation.DeletedBy = null;
                }
            }
        }

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Success(true));
    }
}
