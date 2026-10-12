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

        var dto = new AttendanceStatusDto
        {
            IsClockedIn = activeShift != null,
            ActiveShiftId = activeShift?.Id,
            StartTime = activeShift?.StartTime,
            LocationType = activeShift?.LocationType.ToString(),
            TotalHoursWorkedToday = Math.Round(totalSeconds / 3600.0, 2),
            ExpectedReturnAt = user?.ExpectedReturnAt
        };

        return Ok(ApiResponse<AttendanceStatusDto>.Success(dto));
    }

    /// <summary>
    /// Záznam příchodu (NFC čip pobočky nebo Home Office).
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

        // 3. Hardware Workplace Guard: workplace_id lze přiřadit POUZE při ověřeném NFC pípnutí
        Guid? workplaceId = null;
        var locationType = LocationType.home_office;

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

        activeShift.EndTime = DateTimeOffset.UtcNow;

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
    /// Kdo je kde – živý přehled přítomnosti všech kolegů v reálném čase.
    /// </summary>
    [HttpGet("who-is-where")]
    [HttpGet("team-presence")]
    [HttpGet("radar")]
    public async Task<ActionResult<ApiResponse<List<RadarUserDto>>>> GetLiveRadar()
    {
        var users = await _context.Users.Where(u => u.IsActive && u.IsApproved).ToListAsync();
        var activeShifts = await _context.TimeEntries
            .Where(t => t.EndTime == null)
            .ToListAsync();
        var workplaces = await _context.Workplaces.ToDictionaryAsync(w => w.Id, w => w.Name);

        var list = new List<RadarUserDto>();

        foreach (var user in users)
        {
            var shift = activeShifts.FirstOrDefault(s => s.UserId == user.Id);
            string status = "Nepřítomen";
            string color = "slate"; // default gray

            if (shift != null)
            {
                if (shift.LocationType == LocationType.office)
                {
                    string wpName = shift.WorkplaceId.HasValue && workplaces.TryGetValue(shift.WorkplaceId.Value, out var n) ? n : "Kancelář";
                    status = $"V kanceláři ({wpName})";
                    color = "emerald";
                }
                else if (shift.LocationType == LocationType.home_office)
                {
                    status = "Home Office";
                    color = "sky";
                }
            }
            else if (user.ExpectedReturnAt.HasValue)
            {
                status = $"Pauza (návrat cca {user.ExpectedReturnAt.Value.ToLocalTime():HH:mm})";
                color = "amber";
            }

            list.Add(new RadarUserDto
            {
                UserId = user.Id,
                DisplayName = user.DisplayName,
                Role = user.Role.ToString(),
                PhoneNumber = user.PhoneNumber,
                StatusText = status,
                StatusColor = color
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
}

public class AttendanceStatusDto
{
    public bool IsClockedIn { get; set; }
    public Guid? ActiveShiftId { get; set; }
    public DateTimeOffset? StartTime { get; set; }
    public string? LocationType { get; set; }
    public double TotalHoursWorkedToday { get; set; }
    public DateTimeOffset? ExpectedReturnAt { get; set; }
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
}

public class RadarUserDto
{
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string StatusText { get; set; } = string.Empty;
    public string StatusColor { get; set; } = string.Empty;
}

public class DaySummaryDto
{
    public DateOnly Date { get; set; }
    public string DayName { get; set; } = string.Empty;
    public double HoursWorked { get; set; }
    public bool HasActiveShift { get; set; }
    public bool IsToday { get; set; }
}
