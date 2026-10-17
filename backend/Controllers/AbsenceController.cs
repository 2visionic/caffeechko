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
    /// Získá reálné zůstatky dovolené a sick days pro daného uživatele a zadaný rok z DB.
    /// Pokud pro daný rok u zaměstnance ještě neproběhla uzávěrka (neexistuje konfigurace), vrací IsConfigured = false a 0 dní.
    /// </summary>
    [HttpGet("balances")]
    public async Task<ActionResult<ApiResponse<AbsenceBalancesDto>>> GetBalances([FromQuery] Guid userId, [FromQuery] int? year = null)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound(ApiResponse<AbsenceBalancesDto>.Failure("ERR_USER_NOT_FOUND", "Uživatel nebyl nalezen."));
        }

        int targetYear = year ?? DateTimeOffset.UtcNow.Year;

        var vacType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "vacation");
        var sickType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "sick_day");
        var hoType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "home_office");

        var vacSetting = vacType != null
            ? await _context.UserAbsenceSettings.FirstOrDefaultAsync(s => s.UserId == userId && s.AbsenceTypeId == vacType.Id && s.Year == targetYear)
            : null;

        var sickSetting = sickType != null
            ? await _context.UserAbsenceSettings.FirstOrDefaultAsync(s => s.UserId == userId && s.AbsenceTypeId == sickType.Id && s.Year == targetYear)
            : null;

        var hoSetting = hoType != null
            ? await _context.UserAbsenceSettings.FirstOrDefaultAsync(s => s.UserId == userId && s.AbsenceTypeId == hoType.Id && s.Year == targetYear)
            : null;

        bool isConfigured = (vacSetting != null || sickSetting != null || hoSetting != null);

        var yearStart = new DateTimeOffset(targetYear, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var yearEnd = new DateTimeOffset(targetYear, 12, 31, 23, 59, 59, 999, TimeSpan.Zero);

        int? vacBase = null;
        int? vacCarriedOver = null;
        int? vacTotal = null;
        int? vacRemaining = null;

        if (vacSetting != null)
        {
            decimal vb = vacSetting.AllocatedCapacity ?? 0m;
            decimal vc = vacSetting.CarriedOverDays;
            decimal vt = vb + vc;

            decimal vacUsed = 0;
            if (vacType != null)
            {
                var allVac = await _context.AbsenceRequests
                    .Where(r => r.UserId == userId && r.AbsenceTypeId == vacType.Id)
                    .ToListAsync();

                var vacRequests = allVac
                    .Where(r => (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending) &&
                                r.PlannedStart >= yearStart && r.PlannedStart <= yearEnd)
                    .ToList();

                vacUsed = vacRequests.Sum(r => Math.Max(1, (int)Math.Round((r.PlannedEnd.Date - r.PlannedStart.Date).TotalDays) + 1));
            }

            vacBase = (int)vb;
            vacCarriedOver = (int)vc;
            vacTotal = (int)vt;
            vacRemaining = (int)Math.Max(0, vt - vacUsed);
        }

        int? sickTotal = null;
        int? sickRemaining = null;

        if (sickSetting != null)
        {
            decimal st = sickSetting.AllocatedCapacity ?? 0m;

            decimal sickUsed = 0;
            if (sickType != null)
            {
                var allSick = await _context.AbsenceRequests
                    .Where(r => r.UserId == userId && r.AbsenceTypeId == sickType.Id)
                    .ToListAsync();

                var sickRequests = allSick
                    .Where(r => (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending) &&
                                r.PlannedStart >= yearStart && r.PlannedStart <= yearEnd)
                    .ToList();

                sickUsed = sickRequests.Sum(r => Math.Max(1, (int)Math.Round((r.PlannedEnd.Date - r.PlannedStart.Date).TotalDays) + 1));
            }

            sickTotal = (int)st;
            sickRemaining = (int)Math.Max(0, st - sickUsed);
        }

        int? hoWeeklyDays = hoSetting != null ? (int)(hoSetting.AllocatedCapacity ?? 0m) : null;

        decimal unpaidUsed = 0;
        var unpaidType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "unpaid_leave");
        if (unpaidType != null)
        {
            var allUnpaid = await _context.AbsenceRequests
                .Where(r => r.UserId == userId && r.AbsenceTypeId == unpaidType.Id)
                .ToListAsync();

            var unpaidRequests = allUnpaid
                .Where(r => (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending) &&
                            r.PlannedStart >= yearStart && r.PlannedStart <= yearEnd)
                .ToList();

            unpaidUsed = unpaidRequests.Sum(r => Math.Max(1, (int)Math.Round((r.PlannedEnd.Date - r.PlannedStart.Date).TotalDays) + 1));
        }

        var result = new AbsenceBalancesDto
        {
            UserId = userId.ToString(),
            Year = targetYear,
            IsConfigured = isConfigured,
            VacationBase = vacBase,
            VacationCarriedOver = vacCarriedOver,
            VacationTotal = vacTotal,
            VacationRemaining = vacRemaining,
            SickDaysTotal = sickTotal,
            SickDaysRemaining = sickRemaining,
            HomeOfficeWeeklyDays = hoWeeklyDays,
            UnpaidLeaveDays = (int)unpaidUsed
        };

        return Ok(ApiResponse<AbsenceBalancesDto>.Success(result));
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
        if (!user.IsApproved)
        {
            return StatusCode(403, ApiResponse<List<AbsenceRequestItemDto>>.Failure("ERR_ACCOUNT_PENDING_APPROVAL", "Váš uživatelský účet čeká na schválení úvazku Office Managerem."));
        }

        var types = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);

        var rawRequests = await _context.AbsenceRequests
            .Where(r => r.UserId == userId)
            .ToListAsync();
        var requests = rawRequests.OrderByDescending(r => r.PlannedStart).ToList();

        var managerRelation = await _context.UserManagers.FirstOrDefaultAsync(um => um.UserId == userId);
        var effectiveManagerId = user.ManagerId ?? managerRelation?.ManagerId;
        var effectiveParentId = user.ParentPersonId ?? managerRelation?.ParentPersonId;

        string managerName = "Vedení společnosti";
        if (effectiveManagerId.HasValue)
        {
            var mgr = await _context.Users.FindAsync(effectiveManagerId.Value);
            if (mgr != null) managerName = mgr.DisplayName;
        }

        string? parentName = null;
        if (effectiveParentId.HasValue)
        {
            var parent = await _context.Users.FindAsync(effectiveParentId.Value);
            if (parent != null) parentName = parent.DisplayName;
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
                UserRole = GetRoleLabelCzech(user.Role),
                Contract = user.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
                ManagerId = effectiveManagerId?.ToString(),
                ManagerName = managerName,
                ParentPersonId = effectiveParentId?.ToString(),
                ParentPersonName = parentName,
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
                IsRead = r.IsRead
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

        var nowUtc = DateTimeOffset.UtcNow;
        var startOfMonth = new DateTimeOffset(new DateTime(nowUtc.Year, nowUtc.Month, 1), TimeSpan.Zero);
        var endOfMonth = startOfMonth.AddMonths(1);

        var allRequests = await _context.AbsenceRequests.ToListAsync();
        IEnumerable<AbsenceRequest> filtered = allRequests
            .Where(r => r.Status == AbsenceStatus.pending || (r.PlannedStart < endOfMonth && r.PlannedEnd >= startOfMonth));

        if (manager.Role == UserRole.team_lead)
        {
            // Team lead sees requests of members where ParentPersonId == managerId
            var subordinateIds = await _context.Users
                .Where(u => u.ParentPersonId == managerId)
                .Select(u => u.Id)
                .ToListAsync();

            var umSubIds = await _context.UserManagers
                .Where(um => um.ParentPersonId == managerId)
                .Select(um => um.UserId)
                .ToListAsync();

            var allLeadSubIds = subordinateIds.Union(umSubIds).Distinct().ToHashSet();
            filtered = filtered.Where(r => allLeadSubIds.Contains(r.UserId));
        }
        else if (manager.Role == UserRole.manager)
        {
            // Manager sees requests of all colleagues & leads where ManagerId == managerId
            var subordinateIds = await _context.Users
                .Where(u => u.ManagerId == managerId)
                .Select(u => u.Id)
                .ToListAsync();

            var umSubIds = await _context.UserManagers
                .Where(um => um.ManagerId == managerId)
                .Select(um => um.UserId)
                .ToListAsync();

            var allMgrSubIds = subordinateIds.Union(umSubIds).Distinct().ToHashSet();
            filtered = filtered.Where(r => allMgrSubIds.Contains(r.UserId));
        }
        // Office Manager & Admin see all colleagues

        var requests = filtered.OrderBy(r => r.PlannedStart).ToList();
        var userIds = requests.Select(r => r.UserId).Distinct().ToList();
        var users = await _context.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u);
        var types = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);

        var userSettings = await _context.UserAbsenceSettings
            .Where(s => userIds.Contains(s.UserId))
            .ToListAsync();
        var vacTypeObj = types.Values.FirstOrDefault(t => t.Code == "vacation");
        var userCompletedVacs = await _context.AbsenceRequests
            .Where(ar => userIds.Contains(ar.UserId) && (vacTypeObj == null || ar.AbsenceTypeId == vacTypeObj.Id) && ar.Status == AbsenceStatus.completed)
            .ToListAsync();

        var result = requests.Select(r =>
        {
            var applicant = users.TryGetValue(r.UserId, out var u) ? u : null;
            var type = types.TryGetValue(r.AbsenceTypeId, out var t) ? t : null;
            var typeCode = type?.Code ?? "vacation";
            var typeName = (applicant?.ContractKind == ContractKind.osvc) ? (type?.NameOsvc ?? "Volno") : (type?.NameEmployee ?? "Dovolená");
            int days = Math.Max(1, (int)Math.Round((r.PlannedEnd.Date - r.PlannedStart.Date).TotalDays) + 1);

            int reqYear = r.PlannedStart.Year;
            var setting = userSettings.FirstOrDefault(s => s.UserId == r.UserId && (vacTypeObj == null || s.AbsenceTypeId == vacTypeObj.Id) && s.Year == reqYear);
            int carryDays = (int)(setting?.CarriedOverDays ?? 0m);
            int totalDays = setting?.AllocatedCapacity != null ? ((int)setting.AllocatedCapacity.Value + carryDays) : 0;

            int usedDays = userCompletedVacs
                .Where(ar => ar.UserId == r.UserId && ar.PlannedStart.Year == reqYear)
                .Sum(ar => Math.Max(1, (int)Math.Round((ar.PlannedEnd.Date - ar.PlannedStart.Date).TotalDays) + 1));
            int remainingDays = Math.Max(0, totalDays - usedDays);

            var mgrId = applicant?.ManagerId?.ToString() ?? manager.Id.ToString();
            var parentId = applicant?.ParentPersonId?.ToString();

            return new AbsenceRequestItemDto
            {
                Id = r.Id.ToString(),
                ApplicantId = r.UserId.ToString(),
                UserName = applicant?.DisplayName ?? "Neznámý uživatel",
                UserRole = GetRoleLabelCzech(applicant?.Role ?? UserRole.colleague),
                Contract = applicant?.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
                ManagerId = mgrId,
                ManagerName = manager.DisplayName,
                ParentPersonId = parentId,
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
                IsRead = r.IsRead,
                RemainingDays = remainingDays,
                TotalDays = totalDays
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
        if (!user.IsApproved)
        {
            return StatusCode(403, ApiResponse<AbsenceRequestItemDto>.Failure("ERR_ACCOUNT_PENDING_APPROVAL", "Váš uživatelský účet čeká na schválení úvazku Office Managerem."));
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

        var managerRelation = await _context.UserManagers.FirstOrDefaultAsync(um => um.UserId == user.Id);
        var effectiveManagerId = user.ManagerId ?? managerRelation?.ManagerId;
        var effectiveParentId = user.ParentPersonId ?? managerRelation?.ParentPersonId;

        // Automaticky schválená žádost je, pokud daný člověk má sloupeček ManagerId prázdný
        bool isAutoApproved = !effectiveManagerId.HasValue;

        var req = new AbsenceRequest
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            AbsenceTypeId = type!.Id,
            Status = isAutoApproved ? AbsenceStatus.completed : AbsenceStatus.pending,
            ApprovedBy = isAutoApproved ? user.Id : null,
            ApprovedAt = isAutoApproved ? DateTimeOffset.UtcNow : null,
            PlannedStart = start,
            PlannedEnd = end,
            Note = fullNote,
            IsRead = false
        };

        _context.AbsenceRequests.Add(req);
        await _context.SaveChangesAsync();

        string managerName = "Vedení";
        if (effectiveManagerId.HasValue)
        {
            var mgr = await _context.Users.FindAsync(effectiveManagerId.Value);
            if (mgr != null) managerName = mgr.DisplayName;
        }

        string? parentName = null;
        if (effectiveParentId.HasValue)
        {
            var parent = await _context.Users.FindAsync(effectiveParentId.Value);
            if (parent != null) parentName = parent.DisplayName;
        }

        var responseDto = new AbsenceRequestItemDto
        {
            Id = req.Id.ToString(),
            ApplicantId = user.Id.ToString(),
            UserName = user.DisplayName,
            UserRole = GetRoleLabelCzech(user.Role),
            Contract = user.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
            ManagerId = effectiveManagerId?.ToString(),
            ManagerName = managerName,
            ParentPersonId = effectiveParentId?.ToString(),
            ParentPersonName = parentName,
            Type = type.Code,
            TypeName = user.ContractKind == ContractKind.osvc ? type.NameOsvc : type.NameEmployee,
            StartDate = req.PlannedStart.ToString("yyyy-MM-dd"),
            EndDate = req.PlannedEnd.ToString("yyyy-MM-dd"),
            DaysCount = Math.Max(1, (int)Math.Round((req.PlannedEnd.Date - req.PlannedStart.Date).TotalDays) + 1),
            StartTime = req.PlannedStart.ToString("HH:mm"),
            EndTime = req.PlannedEnd.ToString("HH:mm"),
            FacilityName = dto.FacilityName,
            HasConfirmationDocument = dto.HasConfirmationDocument,
            Note = req.Note,
            Status = isAutoApproved ? "approved" : "pending",
            IsRead = req.IsRead
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

        if (!string.IsNullOrEmpty(dto.StartDate) && DateTime.TryParse(dto.StartDate, out var parsedStart))
        {
            if (!string.IsNullOrEmpty(dto.StartTime) && dto.StartTime.Contains(':'))
            {
                var stParts = dto.StartTime.Split(':');
                req.PlannedStart = new DateTimeOffset(new DateTime(parsedStart.Year, parsedStart.Month, parsedStart.Day, int.Parse(stParts[0]), int.Parse(stParts[1]), 0), TimeSpan.Zero);
            }
            else
            {
                req.PlannedStart = new DateTimeOffset(parsedStart.Date, TimeSpan.Zero);
            }
        }
        else if (!string.IsNullOrEmpty(dto.StartTime) && dto.StartTime.Contains(':'))
        {
            var stParts = dto.StartTime.Split(':');
            var d = req.PlannedStart.Date;
            req.PlannedStart = new DateTimeOffset(new DateTime(d.Year, d.Month, d.Day, int.Parse(stParts[0]), int.Parse(stParts[1]), 0), TimeSpan.Zero);
        }

        if (!string.IsNullOrEmpty(dto.EndDate) && DateTime.TryParse(dto.EndDate, out var parsedEnd))
        {
            if (!string.IsNullOrEmpty(dto.EndTime) && dto.EndTime.Contains(':'))
            {
                var etParts = dto.EndTime.Split(':');
                req.PlannedEnd = new DateTimeOffset(new DateTime(parsedEnd.Year, parsedEnd.Month, parsedEnd.Day, int.Parse(etParts[0]), int.Parse(etParts[1]), 0), TimeSpan.Zero);
            }
            else
            {
                req.PlannedEnd = new DateTimeOffset(parsedEnd.Date, TimeSpan.Zero);
            }
        }
        else if (!string.IsNullOrEmpty(dto.EndTime) && dto.EndTime.Contains(':'))
        {
            var etParts = dto.EndTime.Split(':');
            var d = req.PlannedEnd.Date;
            req.PlannedEnd = new DateTimeOffset(new DateTime(d.Year, d.Month, d.Day, int.Parse(etParts[0]), int.Parse(etParts[1]), 0), TimeSpan.Zero);
        }

        if (!string.IsNullOrEmpty(dto.FacilityName))
        {
            req.Note = $"Ordinace: {dto.FacilityName}";
        }

        req.Status = AbsenceStatus.completed;
        req.ApprovedBy = dto.ManagerId;
        req.ApprovedAt = DateTimeOffset.UtcNow;
        req.IsRead = false;

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
        req.IsRead = false;

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Success(true));
    }

    /// <summary>
    /// Označí schválenou nebo zamítnutou žádost jako přečtenou žadatelem.
    /// </summary>
    [HttpPost("{id}/read")]
    public async Task<ActionResult<ApiResponse<bool>>> MarkRequestAsRead([FromRoute] Guid id)
    {
        var req = await _context.AbsenceRequests.FindAsync(id);
        if (req == null)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_REQUEST_NOT_FOUND", "Žádost nebyla nalezena."));
        }

        req.IsRead = true;
        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Success(true));
    }

    /// <summary>
    /// Náhled stavu fondu zaměstnance k roční uzávěrce: spočítá čerpání ve starém roce
    /// a navrhne převod dovolené a fondy pro nový rok.
    /// </summary>
    [HttpGet("user-closure-preview")]
    public async Task<ActionResult<ApiResponse<UserYearClosurePreviewDto>>> GetUserYearClosurePreview(
        [FromQuery] Guid userId,
        [FromQuery] int fromYear = 2026,
        [FromQuery] int targetYear = 2027)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound(ApiResponse<UserYearClosurePreviewDto>.Failure("ERR_USER_NOT_FOUND", "Uživatel nebyl nalezen."));
        }

        var vacType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "vacation");
        var sickType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "sick_day");

        var companySetting = await _context.CompanySettings.FirstOrDefaultAsync();
        decimal defVac = companySetting?.DefaultVacationDays ?? 20m;
        decimal defSick = companySetting?.DefaultSickDays ?? 3m;

        // Starý rok - nastavení
        var oldVacSetting = vacType != null
            ? await _context.UserAbsenceSettings.FirstOrDefaultAsync(s => s.UserId == userId && s.AbsenceTypeId == vacType.Id && s.Year == fromYear)
            : null;
        var oldSickSetting = sickType != null
            ? await _context.UserAbsenceSettings.FirstOrDefaultAsync(s => s.UserId == userId && s.AbsenceTypeId == sickType.Id && s.Year == fromYear)
            : null;

        decimal oldVacBase = oldVacSetting?.AllocatedCapacity ?? 0m;
        decimal oldVacCarried = oldVacSetting?.CarriedOverDays ?? 0m;
        decimal oldVacTotal = oldVacBase + oldVacCarried;
        decimal oldSickTotal = oldSickSetting?.AllocatedCapacity ?? 0m;

        var fromYearStart = new DateTimeOffset(fromYear, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var fromYearEnd = new DateTimeOffset(fromYear, 12, 31, 23, 59, 59, 999, TimeSpan.Zero);

        // Čerpání ve starém roce
        decimal oldVacUsed = 0;
        if (vacType != null)
        {
            var allOldVac = await _context.AbsenceRequests
                .Where(r => r.UserId == userId && r.AbsenceTypeId == vacType.Id)
                .ToListAsync();

            var vacRequests = allOldVac
                .Where(r => (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending) &&
                            r.PlannedStart >= fromYearStart && r.PlannedStart <= fromYearEnd)
                .ToList();
            oldVacUsed = vacRequests.Sum(r => Math.Max(1, (int)Math.Round((r.PlannedEnd.Date - r.PlannedStart.Date).TotalDays) + 1));
        }

        decimal oldSickUsed = 0;
        if (sickType != null)
        {
            var allOldSick = await _context.AbsenceRequests
                .Where(r => r.UserId == userId && r.AbsenceTypeId == sickType.Id)
                .ToListAsync();

            var sickRequests = allOldSick
                .Where(r => (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending) &&
                            r.PlannedStart >= fromYearStart && r.PlannedStart <= fromYearEnd)
                .ToList();
            oldSickUsed = sickRequests.Sum(r => Math.Max(1, (int)Math.Round((r.PlannedEnd.Date - r.PlannedStart.Date).TotalDays) + 1));
        }

        decimal oldVacRemaining = Math.Max(0, oldVacTotal - oldVacUsed);
        decimal oldSickRemaining = Math.Max(0, oldSickTotal - oldSickUsed);

        // Zda v cílovém roce už má existující záznam (již uzavřeno)
        var newVacSetting = vacType != null
            ? await _context.UserAbsenceSettings.FirstOrDefaultAsync(s => s.UserId == userId && s.AbsenceTypeId == vacType.Id && s.Year == targetYear)
            : null;
        var newSickSetting = sickType != null
            ? await _context.UserAbsenceSettings.FirstOrDefaultAsync(s => s.UserId == userId && s.AbsenceTypeId == sickType.Id && s.Year == targetYear)
            : null;

        bool isAlreadyClosed = (newVacSetting != null || newSickSetting != null);

        int targetBaseVac = isAlreadyClosed && newVacSetting?.AllocatedCapacity.HasValue == true
            ? (int)newVacSetting.AllocatedCapacity.Value
            : (int)defVac;

        int targetCarryOver = isAlreadyClosed && newVacSetting != null
            ? (int)newVacSetting.CarriedOverDays
            : (int)oldVacRemaining;

        int targetSickDays = isAlreadyClosed && newSickSetting?.AllocatedCapacity.HasValue == true
            ? (int)newSickSetting.AllocatedCapacity.Value
            : (int)defSick;

        var preview = new UserYearClosurePreviewDto
        {
            UserId = userId.ToString(),
            FullName = user.DisplayName,
            Role = GetRoleLabelCzech(user.Role),
            Contract = user.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
            FromYear = fromYear,
            TargetYear = targetYear,
            IsAlreadyClosed = isAlreadyClosed,

            FromYearVacationBase = (int)oldVacBase,
            FromYearVacationCarriedOver = (int)oldVacCarried,
            FromYearVacationTotal = (int)oldVacTotal,
            FromYearVacationUsed = (int)oldVacUsed,
            FromYearVacationRemaining = (int)oldVacRemaining,
            FromYearSickDaysTotal = (int)oldSickTotal,
            FromYearSickDaysUsed = (int)oldSickUsed,
            FromYearSickDaysRemaining = (int)oldSickRemaining,

            TargetYearBaseVacation = targetBaseVac,
            TargetYearSuggestedCarryOver = targetCarryOver,
            TargetYearTotalVacation = targetBaseVac + targetCarryOver,
            TargetYearSickDays = targetSickDays
        };

        return Ok(ApiResponse<UserYearClosurePreviewDto>.Success(preview));
    }

    /// <summary>
    /// Provede roční uzávěrku fondu pro jednoho konkrétního zaměstnance a založí/upraví jeho fondy pro cílový rok.
    /// </summary>
    [HttpPost("close-user-year")]
    public async Task<ActionResult<ApiResponse<AbsenceBalancesDto>>> CloseUserYear([FromBody] CloseUserYearDto dto)
    {
        var user = await _context.Users.FindAsync(dto.UserId);
        if (user == null)
        {
            return NotFound(ApiResponse<AbsenceBalancesDto>.Failure("ERR_USER_NOT_FOUND", "Uživatel nebyl nalezen."));
        }

        var vacType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "vacation");
        var sickType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "sick_day");
        var hoType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "home_office");

        var company = await _context.CompanySettings.FirstOrDefaultAsync();
        decimal defaultHo = company?.DefaultHomeOfficeWeeklyDays ?? 2m;

        decimal vacBase = dto.NewBaseVacationDays;
        decimal vacCarry = dto.CarriedOverVacationDays;
        decimal sickCap = dto.NewSickDays;

        if (vacType != null)
        {
            var vacSetting = await _context.UserAbsenceSettings
                .FirstOrDefaultAsync(s => s.UserId == dto.UserId && s.AbsenceTypeId == vacType.Id && s.Year == dto.TargetYear);

            if (vacSetting == null)
            {
                vacSetting = new UserAbsenceSetting
                {
                    Id = Guid.NewGuid(),
                    UserId = dto.UserId,
                    AbsenceTypeId = vacType.Id,
                    Year = dto.TargetYear,
                    BudgetPeriod = BudgetPeriod.yearly,
                    AllocatedCapacity = vacBase,
                    CarriedOverDays = vacCarry,
                    IsPaid = true
                };
                _context.UserAbsenceSettings.Add(vacSetting);
            }
            else
            {
                vacSetting.AllocatedCapacity = vacBase;
                vacSetting.CarriedOverDays = vacCarry;
            }
        }

        if (sickType != null)
        {
            var sickSetting = await _context.UserAbsenceSettings
                .FirstOrDefaultAsync(s => s.UserId == dto.UserId && s.AbsenceTypeId == sickType.Id && s.Year == dto.TargetYear);

            if (sickSetting == null)
            {
                sickSetting = new UserAbsenceSetting
                {
                    Id = Guid.NewGuid(),
                    UserId = dto.UserId,
                    AbsenceTypeId = sickType.Id,
                    Year = dto.TargetYear,
                    BudgetPeriod = BudgetPeriod.yearly,
                    AllocatedCapacity = sickCap,
                    CarriedOverDays = 0m,
                    MaxPerMonthOverride = 2,
                    IsPaid = true
                };
                _context.UserAbsenceSettings.Add(sickSetting);
            }
            else
            {
                sickSetting.AllocatedCapacity = sickCap;
            }
        }

        if (hoType != null)
        {
            var hoSetting = await _context.UserAbsenceSettings
                .FirstOrDefaultAsync(s => s.UserId == dto.UserId && s.AbsenceTypeId == hoType.Id && s.Year == dto.TargetYear);

            decimal hoCap = dto.NewHomeOfficeWeeklyDays ?? defaultHo;
            if (hoSetting == null)
            {
                hoSetting = new UserAbsenceSetting
                {
                    Id = Guid.NewGuid(),
                    UserId = dto.UserId,
                    AbsenceTypeId = hoType.Id,
                    Year = dto.TargetYear,
                    BudgetPeriod = BudgetPeriod.weekly,
                    AllocatedCapacity = hoCap,
                    CarriedOverDays = 0m,
                    IsPaid = true
                };
                _context.UserAbsenceSettings.Add(hoSetting);
            }
            else if (dto.NewHomeOfficeWeeklyDays.HasValue)
            {
                hoSetting.AllocatedCapacity = hoCap;
            }
        }

        await _context.SaveChangesAsync();

        return await GetBalances(dto.UserId, dto.TargetYear);
    }

    /// <summary>
    /// Získá výchozí firemní nastavení pro dovolené, sick days a home office.
    /// </summary>
    [HttpGet("company-settings")]
    public async Task<ActionResult<ApiResponse<CompanySettingDto>>> GetCompanySettings()
    {
        var cs = await _context.CompanySettings.FirstOrDefaultAsync();
        if (cs == null)
        {
            return NotFound(ApiResponse<CompanySettingDto>.Failure("ERR_NO_SETTINGS", "Nastavení firmy nebylo nalezeno."));
        }
        return Ok(ApiResponse<CompanySettingDto>.Success(new CompanySettingDto
        {
            DailyHours = cs.DailyHours,
            WeeklyWorkDays = cs.WeeklyWorkDays,
            DefaultVacationDays = cs.DefaultVacationDays,
            DefaultSickDays = cs.DefaultSickDays,
            DefaultHomeOfficeWeeklyDays = cs.DefaultHomeOfficeWeeklyDays
        }));
    }

    /// <summary>
    /// Uloží změny výchozího firemního nastavení (pracovní doba, dovolená, sick days, home office).
    /// </summary>
    [HttpPost("company-settings")]
    public async Task<ActionResult<ApiResponse<CompanySettingDto>>> UpdateCompanySettings([FromBody] CompanySettingDto dto)
    {
        var cs = await _context.CompanySettings.FirstOrDefaultAsync();
        if (cs == null)
        {
            cs = new CompanySetting { Id = Guid.NewGuid() };
            _context.CompanySettings.Add(cs);
        }

        if (dto.DailyHours > 0) cs.DailyHours = dto.DailyHours;
        if (dto.WeeklyWorkDays > 0) cs.WeeklyWorkDays = dto.WeeklyWorkDays;
        if (dto.DefaultVacationDays >= 0) cs.DefaultVacationDays = dto.DefaultVacationDays;
        if (dto.DefaultSickDays >= 0) cs.DefaultSickDays = dto.DefaultSickDays;
        if (dto.DefaultHomeOfficeWeeklyDays >= 0) cs.DefaultHomeOfficeWeeklyDays = dto.DefaultHomeOfficeWeeklyDays;

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<CompanySettingDto>.Success(new CompanySettingDto
        {
            DailyHours = cs.DailyHours,
            WeeklyWorkDays = cs.WeeklyWorkDays,
            DefaultVacationDays = cs.DefaultVacationDays,
            DefaultSickDays = cs.DefaultSickDays,
            DefaultHomeOfficeWeeklyDays = cs.DefaultHomeOfficeWeeklyDays
        }));
    }

    /// <summary>
    /// Vrátí číselník typů úvazků a jejich koeficientů z DB (full_time 1.0, half_time 0.5, part_time 0.25)
    /// </summary>
    [HttpGet("contract-types")]
    public async Task<ActionResult<ApiResponse<List<ContractTypeSettingDto>>>> GetContractTypes()
    {
        var list = (await _context.ContractTypes.ToListAsync()).OrderByDescending(c => c.Coefficient).ToList();
        return Ok(ApiResponse<List<ContractTypeSettingDto>>.Success(list.Select(c => new ContractTypeSettingDto
        {
            Code = c.Code,
            Name = c.Name,
            Coefficient = c.Coefficient
        }).ToList()));
    }

    private static string GetRoleLabelCzech(UserRole role)
    {
        return role switch
        {
            UserRole.admin => "Administrátor",
            UserRole.manager => "Manažer",
            UserRole.office_manager => "Office Manager",
            UserRole.team_lead => "Vedoucí",
            _ => "Kolega"
        };
    }
}

public class AbsenceRequestItemDto
{
    public string Id { get; set; } = string.Empty;
    public string ApplicantId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string UserRole { get; set; } = string.Empty;
    public string Contract { get; set; } = "HPP";
    public string? ManagerId { get; set; }
    public string? ManagerName { get; set; }
    public string? ParentPersonId { get; set; }
    public string? ParentPersonName { get; set; }
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
    public bool IsRead { get; set; } = false;
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
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? FacilityName { get; set; }
    public bool? HasConfirmationDocument { get; set; }
}

public class RejectAbsenceDto
{
    public Guid ManagerId { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class AbsenceBalancesDto
{
    public string UserId { get; set; } = string.Empty;
    public int Year { get; set; } = 2026;
    public bool IsConfigured { get; set; } = true;
    public int? VacationBase { get; set; }
    public int? VacationCarriedOver { get; set; }
    public int? VacationTotal { get; set; }
    public int? VacationRemaining { get; set; }
    public int? SickDaysTotal { get; set; }
    public int? SickDaysRemaining { get; set; }
    public int? HomeOfficeWeeklyDays { get; set; }
    public int UnpaidLeaveDays { get; set; } = 0;
}

public class CompanySettingDto
{
    public decimal DailyHours { get; set; } = 8.00m;
    public int WeeklyWorkDays { get; set; } = 5;
    public decimal DefaultVacationDays { get; set; }
    public decimal DefaultSickDays { get; set; }
    public decimal DefaultHomeOfficeWeeklyDays { get; set; }
}

public class ContractTypeSettingDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Coefficient { get; set; }
}

public class UserYearClosurePreviewDto
{
    public string UserId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Contract { get; set; } = string.Empty;
    public int FromYear { get; set; } = 2026;
    public int TargetYear { get; set; } = 2027;
    public bool IsAlreadyClosed { get; set; } = false;

    public int FromYearVacationBase { get; set; }
    public int FromYearVacationCarriedOver { get; set; }
    public int FromYearVacationTotal { get; set; }
    public int FromYearVacationUsed { get; set; }
    public int FromYearVacationRemaining { get; set; }
    public int FromYearSickDaysTotal { get; set; }
    public int FromYearSickDaysUsed { get; set; }
    public int FromYearSickDaysRemaining { get; set; }

    public int TargetYearBaseVacation { get; set; }
    public int TargetYearSuggestedCarryOver { get; set; }
    public int TargetYearTotalVacation { get; set; }
    public int TargetYearSickDays { get; set; }
}

public class CloseUserYearDto
{
    public Guid UserId { get; set; }
    public int FromYear { get; set; } = 2026;
    public int TargetYear { get; set; } = 2027;
    public decimal CarriedOverVacationDays { get; set; }
    public decimal NewBaseVacationDays { get; set; }
    public decimal NewSickDays { get; set; }
    public decimal? NewHomeOfficeWeeklyDays { get; set; }
    public Guid? ClosedByUserId { get; set; }
    public string? Note { get; set; }
}
