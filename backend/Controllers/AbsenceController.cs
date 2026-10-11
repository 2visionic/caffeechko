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
public class AbsenceController : ControllerBase
{
    private readonly DochazkaDbContext _context;

    public AbsenceController(DochazkaDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Získá všechny žádosti o volno / lékaře přihlášeného uživatele.
    /// </summary>
    [HttpGet("my-requests")]
    public async Task<ActionResult<ApiResponse<List<AbsenceRequestItemDto>>>> GetMyRequests([FromQuery] Guid userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound(ApiResponse<List<AbsenceRequestItemDto>>.Failure("ERR_USER_NOT_FOUND", "Uživatel nebyl nalezen."));
        }

        var types = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);

        var rawRequests = await _context.AbsenceRequests
            .Where(r => r.UserId == userId)
            .ToListAsync();
        var requests = rawRequests.OrderByDescending(r => r.PlannedStart).ToList();

        var managerRelation = await _context.UserManagers.FirstOrDefaultAsync(um => um.UserId == userId);
        string managerName = "Vedení společnosti";
        if (managerRelation != null)
        {
            var mgr = await _context.Users.FindAsync(managerRelation.ManagerId);
            if (mgr != null) managerName = mgr.DisplayName;
        }

        var result = requests.Select(r =>
        {
            var type = types.TryGetValue(r.AbsenceTypeId, out var t) ? t : null;
            var typeCode = type?.Code ?? "vacation";
            var typeName = user.ContractKind == ContractKind.osvc ? (type?.NameOsvc ?? "Volno") : (type?.NameEmployee ?? "Dovolená");

            int days = Math.Max(1, (int)Math.Round((r.PlannedEnd.Date - r.PlannedStart.Date).TotalDays) + 1);

            return new AbsenceRequestItemDto
            {
                Id = r.Id.ToString(),
                ApplicantId = r.UserId.ToString(),
                UserName = user.DisplayName,
                UserRole = user.Role.ToString(),
                Department = GetDepartmentName(user.Role),
                ManagerId = managerRelation?.ManagerId.ToString(),
                ManagerName = managerName,
                Type = typeCode,
                TypeName = typeName,
                StartDate = r.PlannedStart.ToString("yyyy-MM-dd"),
                EndDate = r.PlannedEnd.ToString("yyyy-MM-dd"),
                DaysCount = days,
                StartTime = r.PlannedStart.ToString("HH:mm"),
                EndTime = r.PlannedEnd.ToString("HH:mm"),
                Note = r.Note,
                RejectionReason = r.RejectionReason,
                Status = r.Status.ToString().ToLowerInvariant()
            };
        }).ToList();

        return Ok(ApiResponse<List<AbsenceRequestItemDto>>.Success(result));
    }

    /// <summary>
    /// Získá žádosti čekající na schválení pro daného vedoucího (dle RBAC).
    /// Admin a Office Manager vidí celou firmu, Team Lead vidí pouze své podřízené.
    /// </summary>
    [HttpGet("pending-approvals")]
    public async Task<ActionResult<ApiResponse<List<AbsenceRequestItemDto>>>> GetPendingApprovals([FromQuery] Guid managerId)
    {
        var manager = await _context.Users.FindAsync(managerId);
        if (manager == null)
        {
            return NotFound(ApiResponse<List<AbsenceRequestItemDto>>.Failure("ERR_MANAGER_NOT_FOUND", "Manažer nebyl nalezen."));
        }

        IQueryable<AbsenceRequest> query = _context.AbsenceRequests
            .Where(r => r.Status == AbsenceStatus.pending);

        if (manager.Role == UserRole.team_lead)
        {
            var subordinateIds = await _context.UserManagers
                .Where(um => um.ManagerId == managerId)
                .Select(um => um.UserId)
                .ToListAsync();

            query = query.Where(r => subordinateIds.Contains(r.UserId));
        }

        var raw = await query.ToListAsync();
        var requests = raw.OrderBy(r => r.PlannedStart).ToList();
        var userIds = requests.Select(r => r.UserId).Distinct().ToList();
        var users = await _context.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u);
        var types = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);

        var result = requests.Select(r =>
        {
            var applicant = users.TryGetValue(r.UserId, out var u) ? u : null;
            var type = types.TryGetValue(r.AbsenceTypeId, out var t) ? t : null;
            var typeCode = type?.Code ?? "vacation";
            var typeName = (applicant?.ContractKind == ContractKind.osvc) ? (type?.NameOsvc ?? "Volno") : (type?.NameEmployee ?? "Dovolená");
            int days = Math.Max(1, (int)Math.Round((r.PlannedEnd.Date - r.PlannedStart.Date).TotalDays) + 1);

            return new AbsenceRequestItemDto
            {
                Id = r.Id.ToString(),
                ApplicantId = r.UserId.ToString(),
                UserName = applicant?.DisplayName ?? "Neznámý uživatel",
                UserRole = applicant?.Role.ToString() ?? "colleague",
                Department = GetDepartmentName(applicant?.Role ?? UserRole.colleague),
                ManagerId = managerId.ToString(),
                ManagerName = manager.DisplayName,
                Type = typeCode,
                TypeName = typeName,
                StartDate = r.PlannedStart.ToString("yyyy-MM-dd"),
                EndDate = r.PlannedEnd.ToString("yyyy-MM-dd"),
                DaysCount = days,
                StartTime = r.PlannedStart.ToString("HH:mm"),
                EndTime = r.PlannedEnd.ToString("HH:mm"),
                FacilityName = r.Note?.Contains("Ordinace:") == true ? r.Note.Split("Ordinace:").Last().Trim() : "Zdravotnické zařízení",
                HasConfirmationDocument = true,
                Note = r.Note,
                RejectionReason = r.RejectionReason,
                Status = r.Status.ToString().ToLowerInvariant(),
                RemainingDays = 12,
                TotalDays = 20
            };
        }).ToList();

        return Ok(ApiResponse<List<AbsenceRequestItemDto>>.Success(result));
    }

    /// <summary>
    /// Vytvoří novou žádost o dovolenou, lékaře, sick day nebo home office.
    /// </summary>
    [HttpPost("request")]
    public async Task<ActionResult<ApiResponse<AbsenceRequestItemDto>>> CreateRequest([FromBody] CreateAbsenceRequestDto dto)
    {
        var user = await _context.Users.FindAsync(dto.UserId);
        if (user == null)
        {
            return NotFound(ApiResponse<AbsenceRequestItemDto>.Failure("ERR_USER_NOT_FOUND", "Uživatel nebyl nalezen."));
        }

        var type = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == dto.TypeCode);
        if (type == null)
        {
            type = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "vacation");
        }

        DateTimeOffset start;
        DateTimeOffset end;

        if (dto.TypeCode == "doctor")
        {
            var date = DateTime.Parse(dto.StartDate);
            var startTimeParts = (dto.StartTime ?? "08:30").Split(':');
            var endTimeParts = (dto.EndTime ?? "11:30").Split(':');

            start = new DateTimeOffset(new DateTime(date.Year, date.Month, date.Day, int.Parse(startTimeParts[0]), int.Parse(startTimeParts[1]), 0), TimeSpan.Zero);
            end = new DateTimeOffset(new DateTime(date.Year, date.Month, date.Day, int.Parse(endTimeParts[0]), int.Parse(endTimeParts[1]), 0), TimeSpan.Zero);
        }
        else
        {
            start = new DateTimeOffset(DateTime.Parse(dto.StartDate), TimeSpan.Zero);
            end = new DateTimeOffset(DateTime.Parse(dto.EndDate), TimeSpan.Zero);
        }

        string fullNote = dto.Note ?? "";
        if (!string.IsNullOrEmpty(dto.FacilityName))
        {
            fullNote = string.IsNullOrEmpty(fullNote) ? $"Ordinace: {dto.FacilityName}" : $"{fullNote} (Ordinace: {dto.FacilityName})";
        }

        var req = new AbsenceRequest
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            AbsenceTypeId = type!.Id,
            Status = AbsenceStatus.pending,
            PlannedStart = start,
            PlannedEnd = end,
            Note = fullNote
        };

        _context.AbsenceRequests.Add(req);
        await _context.SaveChangesAsync();

        var managerRelation = await _context.UserManagers.FirstOrDefaultAsync(um => um.UserId == user.Id);
        string managerName = "Vedení společnosti";
        if (managerRelation != null)
        {
            var mgr = await _context.Users.FindAsync(managerRelation.ManagerId);
            if (mgr != null) managerName = mgr.DisplayName;
        }

        var responseDto = new AbsenceRequestItemDto
        {
            Id = req.Id.ToString(),
            ApplicantId = user.Id.ToString(),
            UserName = user.DisplayName,
            UserRole = user.Role.ToString(),
            Department = GetDepartmentName(user.Role),
            ManagerId = managerRelation?.ManagerId.ToString(),
            ManagerName = managerName,
            Type = type.Code,
            TypeName = type.NameEmployee,
            StartDate = req.PlannedStart.ToString("yyyy-MM-dd"),
            EndDate = req.PlannedEnd.ToString("yyyy-MM-dd"),
            DaysCount = Math.Max(1, (int)Math.Round((req.PlannedEnd.Date - req.PlannedStart.Date).TotalDays) + 1),
            StartTime = req.PlannedStart.ToString("HH:mm"),
            EndTime = req.PlannedEnd.ToString("HH:mm"),
            FacilityName = dto.FacilityName,
            HasConfirmationDocument = dto.HasConfirmationDocument,
            Note = req.Note,
            Status = "pending"
        };

        return Ok(ApiResponse<AbsenceRequestItemDto>.Success(responseDto));
    }

    /// <summary>
    /// Schválí žádost o dovolenou nebo propustku k lékaři.
    /// </summary>
    [HttpPost("{id}/approve")]
    public async Task<ActionResult<ApiResponse<bool>>> ApproveRequest([FromRoute] Guid id, [FromBody] ApproveAbsenceDto dto)
    {
        var req = await _context.AbsenceRequests.FindAsync(id);
        if (req == null)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_REQUEST_NOT_FOUND", "Žádost nebyla nalezena."));
        }

        req.Status = AbsenceStatus.completed;
        req.ApprovedBy = dto.ManagerId;
        req.ApprovedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Success(true));
    }

    /// <summary>
    /// Zamítne žádost s uvedením důvodu.
    /// </summary>
    [HttpPost("{id}/reject")]
    public async Task<ActionResult<ApiResponse<bool>>> RejectRequest([FromRoute] Guid id, [FromBody] RejectAbsenceDto dto)
    {
        var req = await _context.AbsenceRequests.FindAsync(id);
        if (req == null)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_REQUEST_NOT_FOUND", "Žádost nebyla nalezena."));
        }

        req.Status = AbsenceStatus.rejected;
        req.ApprovedBy = dto.ManagerId;
        req.ApprovedAt = DateTimeOffset.UtcNow;
        req.RejectionReason = dto.Reason;

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Success(true));
    }

    private static string GetDepartmentName(UserRole role)
    {
        return role switch
        {
            UserRole.admin => "Vedení společnosti",
            UserRole.office_manager => "Provoz a lidské zdroje",
            UserRole.team_lead => "Vývoj a technologie",
            _ => "Vývoj a technologie"
        };
    }
}

public class AbsenceRequestItemDto
{
    public string Id { get; set; } = string.Empty;
    public string ApplicantId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string UserRole { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string? ManagerId { get; set; }
    public string? ManagerName { get; set; }
    public string Type { get; set; } = string.Empty;
    public string TypeName { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public int DaysCount { get; set; } = 1;
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? FacilityName { get; set; }
    public bool HasConfirmationDocument { get; set; } = false;
    public string? Note { get; set; }
    public string? RejectionReason { get; set; }
    public string Status { get; set; } = "pending";
    public int RemainingDays { get; set; } = 12;
    public int TotalDays { get; set; } = 20;
}

public class CreateAbsenceRequestDto
{
    public Guid UserId { get; set; }
    public string TypeCode { get; set; } = "vacation";
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? FacilityName { get; set; }
    public bool HasConfirmationDocument { get; set; } = false;
    public string? Note { get; set; }
}

public class ApproveAbsenceDto
{
    public Guid ManagerId { get; set; }
}

public class RejectAbsenceDto
{
    public Guid ManagerId { get; set; }
    public string Reason { get; set; } = string.Empty;
}
