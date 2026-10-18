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

        var allTypes = await _context.AbsenceTypes.Where(t => t.IsActive).ToListAsync();
        var userSettings = await _context.UserAbsenceSettings
            .Where(s => s.UserId == userId && s.Year == targetYear)
            .ToListAsync();

        var yearStart = new DateTimeOffset(targetYear, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var yearEnd = new DateTimeOffset(targetYear, 12, 31, 23, 59, 59, 999, TimeSpan.Zero);

        var allUserRequests = await _context.AbsenceRequests
            .Where(r => r.UserId == userId)
            .ToListAsync();

        var activeYearRequests = allUserRequests
            .Where(r => (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending) &&
                        r.PlannedStart >= yearStart && r.PlannedStart <= yearEnd)
            .ToList();

        var balancesDict = new Dictionary<string, AbsenceTypeBalanceDto>();
        foreach (var absType in allTypes)
        {
            var setting = userSettings.FirstOrDefault(s => s.AbsenceTypeId == absType.Id);
            var effectivePeriod = setting?.BudgetPeriod ?? absType.DefaultBudgetPeriod;
            bool hasAllocatedFund = setting?.AllocatedCapacity != null && effectivePeriod != BudgetPeriod.unlimited;

            int usedDays = activeYearRequests
                .Where(r => r.AbsenceTypeId == absType.Id &&
                            (hasAllocatedFund || r.Status == AbsenceStatus.completed))
                .Sum(r => Math.Max(1, (int)Math.Round((r.PlannedEnd.Date - r.PlannedStart.Date).TotalDays) + 1));

            int baseCap = setting?.AllocatedCapacity != null ? (int)setting.AllocatedCapacity.Value : 0;
            int carried = setting != null ? (int)setting.CarriedOverDays : 0;
            int totalCap = baseCap + carried;
            int remaining = setting?.AllocatedCapacity != null ? Math.Max(0, totalCap - usedDays) : 0;

            balancesDict[absType.Code] = new AbsenceTypeBalanceDto
            {
                Code = absType.Code,
                BudgetPeriod = effectivePeriod.ToString().ToLowerInvariant(),
                Base = baseCap,
                CarriedOver = carried,
                Total = totalCap,
                Used = usedDays,
                Remaining = remaining,
                MaxPerMonth = setting?.MaxPerMonthOverride ?? absType.MaxPerMonthLimit
            };
        }

        var vacSetting = allTypes.FirstOrDefault(t => t.Code == "vacation") is { } vt
            ? userSettings.FirstOrDefault(s => s.AbsenceTypeId == vt.Id)
            : null;
        var sickSetting = allTypes.FirstOrDefault(t => t.Code == "sick_day") is { } st
            ? userSettings.FirstOrDefault(s => s.AbsenceTypeId == st.Id)
            : null;
        var hoSetting = allTypes.FirstOrDefault(t => t.Code == "home_office") is { } hot
            ? userSettings.FirstOrDefault(s => s.AbsenceTypeId == hot.Id)
            : null;

        bool isConfigured = userSettings.Count > 0;
        balancesDict.TryGetValue("vacation", out var vacBal);
        balancesDict.TryGetValue("sick_day", out var sickBal);
        balancesDict.TryGetValue("home_office", out var hoBal);
        balancesDict.TryGetValue("unpaid_leave", out var unpaidBal);

        var result = new AbsenceBalancesDto
        {
            UserId = userId.ToString(),
            Year = targetYear,
            IsConfigured = isConfigured,
            VacationBase = vacSetting != null ? vacBal?.Base : null,
            VacationCarriedOver = vacSetting != null ? vacBal?.CarriedOver : null,
            VacationTotal = vacSetting != null ? vacBal?.Total : null,
            VacationRemaining = vacSetting != null ? vacBal?.Remaining : null,
            SickDaysTotal = sickSetting != null ? sickBal?.Total : null,
            SickDaysRemaining = sickSetting != null ? sickBal?.Remaining : null,
            HomeOfficeWeeklyDays = hoSetting != null ? hoBal?.Base : null,
            UnpaidLeaveDays = unpaidBal?.Used ?? 0,
            Balances = balancesDict
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

        var allUsers = await _context.Users.ToDictionaryAsync(u => u.Id, u => u);
        var types = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var contractTypes = await _context.ContractTypes.ToDictionaryAsync(c => c.Code, c => c.Name);

        var rawRequests = await _context.AbsenceRequests
            .Where(r => r.UserId == userId)
            .ToListAsync();
        var requests = rawRequests
            .OrderBy(r => r.CreatedAt ?? r.ApprovedAt ?? r.PlannedStart)
            .ThenBy(r => r.PlannedStart)
            .ToList();

        var managerRelation = await _context.UserManagers.FirstOrDefaultAsync(um => um.UserId == userId);
        var effectiveManagerId = user.ManagerId ?? managerRelation?.ManagerId;
        var effectiveParentId = user.ParentPersonId ?? managerRelation?.ParentPersonId;

        string managerName = "Vedení společnosti";
        if (effectiveManagerId.HasValue && allUsers.TryGetValue(effectiveManagerId.Value, out var mgr))
        {
            managerName = mgr.DisplayName;
        }

        string? parentName = null;
        if (effectiveParentId.HasValue && allUsers.TryGetValue(effectiveParentId.Value, out var parent))
        {
            parentName = parent.DisplayName;
        }

        var userSettings = await _context.UserAbsenceSettings
            .Where(s => s.UserId == userId)
            .ToListAsync();

        var result = requests.Select(r =>
        {
            var type = types.TryGetValue(r.AbsenceTypeId, out var t) ? t : null;
            var typeCode = type?.Code ?? "vacation";
            var typeName = type?.NameEmployee ?? "Dovolená";
            bool isHourly = type?.DurationMode == DurationMode.hours;

            int days = Math.Max(1, (int)Math.Round((r.PlannedEnd.Date - r.PlannedStart.Date).TotalDays) + 1);

            int reqYear = r.PlannedStart.Year;
            int totalDays = 0;
            int remainingDays = 0;
            if (type != null && type.DefaultBudgetPeriod != BudgetPeriod.unlimited)
            {
                var setting = userSettings.FirstOrDefault(s => s.AbsenceTypeId == r.AbsenceTypeId && s.Year == reqYear);
                if (setting != null && setting.AllocatedCapacity != null)
                {
                    int carryDays = (int)setting.CarriedOverDays;
                    totalDays = (int)setting.AllocatedCapacity.Value + carryDays;
                    int usedDays = rawRequests
                        .Where(ar => ar.AbsenceTypeId == r.AbsenceTypeId &&
                                     ar.PlannedStart.Year == reqYear &&
                                     (ar.Status == AbsenceStatus.completed || ar.Status == AbsenceStatus.pending))
                        .Sum(ar => Math.Max(1, (int)Math.Round((ar.PlannedEnd.Date - ar.PlannedStart.Date).TotalDays) + 1));
                    remainingDays = Math.Max(0, totalDays - usedDays);
                }
            }

            string? approvedByName = null;
            string? approvedAtStr = null;
            if (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.rejected)
            {
                var resolverId = r.ApprovedBy ?? r.VerifiedBy ?? effectiveManagerId;
                if (resolverId.HasValue && allUsers.TryGetValue(resolverId.Value, out var resolverUser))
                {
                    approvedByName = resolverUser.DisplayName;
                }
                else
                {
                    approvedByName = managerName;
                }
                approvedAtStr = (r.ApprovedAt ?? r.VerifiedAt ?? r.CreatedAt ?? r.PlannedStart).ToString("O");
            }

            return new AbsenceRequestItemDto
            {
                Id = r.Id.ToString(),
                ApplicantId = r.UserId.ToString(),
                UserName = user.DisplayName,
                UserRole = UserDisplayHelper.GetRoleLabelCzech(user.Role),
                Contract = user.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
                ContractType = user.ContractType.ToString().ToLowerInvariant(),
                ContractTypeName = UserDisplayHelper.GetContractDisplayLabel(user.ContractKind, user.ContractType, contractTypes),
                IsPermanentHomeOffice = user.IsPermanentHomeOffice,
                ManagerId = effectiveManagerId?.ToString(),
                ManagerName = managerName,
                ParentPersonId = effectiveParentId?.ToString(),
                ParentPersonName = parentName,
                Type = typeCode,
                TypeName = typeName,
                StartDate = r.PlannedStart.ToString("yyyy-MM-dd"),
                EndDate = r.PlannedEnd.ToString("yyyy-MM-dd"),
                DaysCount = days,
                StartTime = isHourly ? r.PlannedStart.ToString("HH:mm") : null,
                EndTime = isHourly ? r.PlannedEnd.ToString("HH:mm") : null,
                FacilityName = null,
                HasConfirmationDocument = true,
                Note = r.Note,
                RejectionReason = r.RejectionReason,
                Status = r.Status.ToString().ToLowerInvariant(),
                IsRead = r.IsRead,
                CreatedAt = (r.CreatedAt ?? r.ApprovedAt ?? r.PlannedStart).ToString("O"),
                ApprovedByName = approvedByName,
                ApprovedAt = approvedAtStr,
                RemainingDays = remainingDays,
                TotalDays = totalDays
            };
        }).ToList();

        return Ok(ApiResponse<List<AbsenceRequestItemDto>>.Success(result));
    }

    /// <summary>
    /// Získá žádosti kolegů pro daného vedoucího / manažera / officera / administrátora (dle RBAC).
    /// Vedoucí (team_lead) vidí osoby s ParentPersonId == managerId.
    /// Manažer (manager) vidí osoby s ManagerId == managerId.
    /// Officer (office_manager) a Administrátor (admin) vidí žádosti všech lidí.
    /// </summary>
    [HttpGet("pending-approvals")]
    public async Task<ActionResult<ApiResponse<List<AbsenceRequestItemDto>>>> GetPendingApprovals([FromQuery] Guid managerId)
    {
        var manager = await _context.Users.FindAsync(managerId);
        if (manager == null)
        {
            return NotFound(ApiResponse<List<AbsenceRequestItemDto>>.Failure("ERR_MANAGER_NOT_FOUND", "Manažer nebyl nalezen."));
        }

        var allRequests = await _context.AbsenceRequests.ToListAsync();
        IEnumerable<AbsenceRequest> filtered = allRequests;

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
        // Office Manager & Admin see all people

        var requests = filtered
            .OrderBy(r => r.CreatedAt ?? r.ApprovedAt ?? r.PlannedStart)
            .ThenBy(r => r.PlannedStart)
            .ToList();

        var allUsers = await _context.Users.ToDictionaryAsync(u => u.Id, u => u);
        var allUserManagers = await _context.UserManagers
            .GroupBy(um => um.UserId)
            .ToDictionaryAsync(g => g.Key, g => g.First());
        var userIds = requests.Select(r => r.UserId).Distinct().ToList();
        var types = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var contractTypes = await _context.ContractTypes.ToDictionaryAsync(c => c.Code, c => c.Name);

        var userSettings = await _context.UserAbsenceSettings
            .Where(s => userIds.Contains(s.UserId))
            .ToListAsync();
        var userAllRequests = allRequests
            .Where(ar => userIds.Contains(ar.UserId) && (ar.Status == AbsenceStatus.completed || ar.Status == AbsenceStatus.pending))
            .ToList();

        var result = requests.Select(r =>
        {
            var applicant = allUsers.TryGetValue(r.UserId, out var u) ? u : null;
            var umRel = allUserManagers.TryGetValue(r.UserId, out var um) ? um : null;
            var type = types.TryGetValue(r.AbsenceTypeId, out var t) ? t : null;
            var typeCode = type?.Code ?? "vacation";
            var typeName = type?.NameEmployee ?? "Dovolená";
            bool isHourly = type?.DurationMode == DurationMode.hours;
            int days = Math.Max(1, (int)Math.Round((r.PlannedEnd.Date - r.PlannedStart.Date).TotalDays) + 1);

            int reqYear = r.PlannedStart.Year;
            int totalDays = 0;
            int remainingDays = 0;
            if (type != null && type.DefaultBudgetPeriod != BudgetPeriod.unlimited)
            {
                var setting = userSettings.FirstOrDefault(s => s.UserId == r.UserId && s.AbsenceTypeId == r.AbsenceTypeId && s.Year == reqYear);
                if (setting != null && setting.AllocatedCapacity != null)
                {
                    int carryDays = (int)setting.CarriedOverDays;
                    totalDays = (int)setting.AllocatedCapacity.Value + carryDays;
                    int usedDays = userAllRequests
                        .Where(ar => ar.UserId == r.UserId && ar.AbsenceTypeId == r.AbsenceTypeId && ar.PlannedStart.Year == reqYear)
                        .Sum(ar => Math.Max(1, (int)Math.Round((ar.PlannedEnd.Date - ar.PlannedStart.Date).TotalDays) + 1));
                    remainingDays = Math.Max(0, totalDays - usedDays);
                }
            }

            var effectiveMgrId = applicant?.ManagerId ?? umRel?.ManagerId;
            var effectiveParentId = applicant?.ParentPersonId ?? umRel?.ParentPersonId;
            string mgrName = "Vedení společnosti";
            if (effectiveMgrId.HasValue && allUsers.TryGetValue(effectiveMgrId.Value, out var mgrUser))
            {
                mgrName = mgrUser.DisplayName;
            }
            string? parentName = null;
            if (effectiveParentId.HasValue && allUsers.TryGetValue(effectiveParentId.Value, out var parentUser))
            {
                parentName = parentUser.DisplayName;
            }

            string? approvedByName = null;
            string? approvedAtStr = null;
            if (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.rejected)
            {
                var resolverId = r.ApprovedBy ?? r.VerifiedBy ?? effectiveMgrId;
                if (resolverId.HasValue && allUsers.TryGetValue(resolverId.Value, out var resolverUser))
                {
                    approvedByName = resolverUser.DisplayName;
                }
                else
                {
                    approvedByName = mgrName;
                }
                approvedAtStr = (r.ApprovedAt ?? r.VerifiedAt ?? r.CreatedAt ?? r.PlannedStart).ToString("O");
            }

            var cKind = applicant?.ContractKind ?? ContractKind.employee;
            var cType = applicant?.ContractType ?? ContractType.full_time;

            return new AbsenceRequestItemDto
            {
                Id = r.Id.ToString(),
                ApplicantId = r.UserId.ToString(),
                UserName = applicant?.DisplayName ?? "Neznámý uživatel",
                UserRole = UserDisplayHelper.GetRoleLabelCzech(applicant?.Role ?? UserRole.colleague),
                Contract = cKind == ContractKind.osvc ? "OSVČ" : "HPP",
                ContractType = cType.ToString().ToLowerInvariant(),
                ContractTypeName = UserDisplayHelper.GetContractDisplayLabel(cKind, cType, contractTypes),
                IsPermanentHomeOffice = applicant?.IsPermanentHomeOffice ?? false,
                ManagerId = effectiveMgrId?.ToString(),
                ManagerName = mgrName,
                ParentPersonId = effectiveParentId?.ToString(),
                ParentPersonName = parentName,
                Type = typeCode,
                TypeName = typeName,
                StartDate = r.PlannedStart.ToString("yyyy-MM-dd"),
                EndDate = r.PlannedEnd.ToString("yyyy-MM-dd"),
                DaysCount = days,
                StartTime = isHourly ? r.PlannedStart.ToString("HH:mm") : null,
                EndTime = isHourly ? r.PlannedEnd.ToString("HH:mm") : null,
                FacilityName = null,
                HasConfirmationDocument = true,
                Note = r.Note,
                RejectionReason = r.RejectionReason,
                Status = r.Status.ToString().ToLowerInvariant(),
                IsRead = r.IsRead,
                CreatedAt = (r.CreatedAt ?? r.ApprovedAt ?? r.PlannedStart).ToString("O"),
                ApprovedByName = approvedByName,
                ApprovedAt = approvedAtStr,
                RemainingDays = remainingDays,
                TotalDays = totalDays
            };
        }).ToList();

        return Ok(ApiResponse<List<AbsenceRequestItemDto>>.Success(result));
    }

    /// <summary>
    /// Vrátí konfiguraci typů absencí z DB (DurationMode: days/hours/single_day, SubmissionOffsetDays, SubmissionDeadlineTime, AllowOsvc).
    /// </summary>
    [HttpGet("types")]
    public async Task<ActionResult<ApiResponse<List<AbsenceTypeConfigDto>>>> GetAbsenceTypes()
    {
        var types = await _context.AbsenceTypes
            .Where(t => t.IsActive)
            .ToListAsync();

        var result = types.Select(t => new AbsenceTypeConfigDto
        {
            Code = t.Code,
            NameEmployee = t.NameEmployee,
            AllowOsvc = t.AllowOsvc,
            DurationMode = t.DurationMode.ToString().ToLowerInvariant(),
            SubmissionOffsetDays = t.SubmissionOffsetDays,
            SubmissionDeadlineTime = t.SubmissionDeadlineTime,
            MaxPerMonthLimit = t.MaxPerMonthLimit,
            DefaultBudgetPeriod = t.DefaultBudgetPeriod.ToString().ToLowerInvariant(),
            DefaultAllowance = t.DefaultAllowance,
            IsActive = t.IsActive
        }).ToList();

        return Ok(ApiResponse<List<AbsenceTypeConfigDto>>.Success(result));
    }

    /// <summary>
    /// Uloží konfiguraci typů absencí v číselníku absence_types (včetně DefaultAllowance a případných nově přidaných typů).
    /// </summary>
    [HttpPost("types")]
    public async Task<ActionResult<ApiResponse<List<AbsenceTypeConfigDto>>>> UpdateAbsenceTypes([FromBody] List<AbsenceTypeConfigDto> items)
    {
        if (items == null || items.Count == 0)
        {
            return BadRequest(ApiResponse<List<AbsenceTypeConfigDto>>.Failure("ERR_EMPTY_PAYLOAD", "Seznam typů absencí je prázdný."));
        }

        var existingList = await _context.AbsenceTypes.ToListAsync();

        foreach (var dto in items)
        {
            var code = (dto.Code ?? string.Empty).Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(dto.NameEmployee))
            {
                continue;
            }

            if (!Enum.TryParse<DurationMode>(dto.DurationMode, true, out var durMode))
            {
                durMode = DurationMode.days;
            }

            if (!Enum.TryParse<BudgetPeriod>(dto.DefaultBudgetPeriod, true, out var budgetPeriod))
            {
                budgetPeriod = BudgetPeriod.unlimited;
            }

            int? defAllowance = budgetPeriod == BudgetPeriod.unlimited ? null : dto.DefaultAllowance;

            var existing = existingList.FirstOrDefault(t => string.Equals(t.Code, code, StringComparison.OrdinalIgnoreCase));
            if (existing == null)
            {
                var created = new AbsenceType
                {
                    Id = Guid.NewGuid(),
                    Code = code,
                    NameEmployee = dto.NameEmployee.Trim(),
                    AllowOsvc = dto.AllowOsvc,
                    DurationMode = durMode,
                    SubmissionOffsetDays = Math.Max(0, dto.SubmissionOffsetDays),
                    SubmissionDeadlineTime = string.IsNullOrWhiteSpace(dto.SubmissionDeadlineTime) ? null : dto.SubmissionDeadlineTime.Trim(),
                    MaxPerMonthLimit = dto.MaxPerMonthLimit,
                    DefaultBudgetPeriod = budgetPeriod,
                    DefaultAllowance = defAllowance,
                    IsActive = dto.IsActive
                };
                _context.AbsenceTypes.Add(created);
                existingList.Add(created);
            }
            else
            {
                existing.NameEmployee = dto.NameEmployee.Trim();
                existing.AllowOsvc = dto.AllowOsvc;
                existing.DurationMode = durMode;
                existing.SubmissionOffsetDays = Math.Max(0, dto.SubmissionOffsetDays);
                existing.SubmissionDeadlineTime = string.IsNullOrWhiteSpace(dto.SubmissionDeadlineTime) ? null : dto.SubmissionDeadlineTime.Trim();
                existing.MaxPerMonthLimit = dto.MaxPerMonthLimit;
                existing.DefaultBudgetPeriod = budgetPeriod;
                existing.DefaultAllowance = defAllowance;
                existing.IsActive = dto.IsActive;
            }
        }

        await _context.SaveChangesAsync();
        return await GetAbsenceTypes();
    }

    /// <summary>
    /// Ověří, zda akci nad cílovým uživatelem provádí JINÁ oprávněná osoba (Vedoucí, Manažer, Officer, Admin) v Detailu osoby.
    /// Uživatel nikdy nemůže tímto způsobem obejít pravidla sám u sebe (callerId != targetUserId).
    /// </summary>
    private async Task<(bool IsAuthorizedOther, bool CanBypassRules, Guid? CallerId)> CheckManagedByAuthorizedOtherAsync(Guid targetUserId, Guid? fallbackEditorId)
    {
        Guid? callerId = null;
        if (Request?.Headers != null &&
            Request.Headers.TryGetValue("X-User-Id", out var headerValues) &&
            Guid.TryParse(headerValues.FirstOrDefault(), out var parsedHeaderId))
        {
            callerId = parsedHeaderId;
        }
        else if (fallbackEditorId.HasValue)
        {
            callerId = fallbackEditorId.Value;
        }

        if (!callerId.HasValue || callerId.Value == targetUserId)
        {
            return (false, false, callerId);
        }

        var caller = await _context.Users.FindAsync(callerId.Value);
        if (caller == null || !caller.IsActive || !caller.IsApproved)
        {
            return (false, false, callerId);
        }

        if (caller.Role == UserRole.admin || caller.Role == UserRole.office_manager)
        {
            return (true, true, caller.Id);
        }

        var targetUser = await _context.Users.FindAsync(targetUserId);
        if (targetUser == null)
        {
            return (false, false, caller.Id);
        }

        var um = await _context.UserManagers.FirstOrDefaultAsync(x => x.UserId == targetUserId);
        var effectiveManagerId = targetUser.ManagerId ?? um?.ManagerId;
        var effectiveParentId = targetUser.ParentPersonId ?? um?.ParentPersonId;

        if (caller.Role == UserRole.manager && effectiveManagerId == caller.Id)
        {
            return (true, true, caller.Id);
        }

        if (caller.Role == UserRole.team_lead && effectiveParentId == caller.Id)
        {
            return (true, false, caller.Id);
        }

        return (false, false, caller.Id);
    }

    private (bool IsValid, string? ErrorCode, string? ErrorMessage) ValidateAbsenceRules(
        AbsenceType type,
        ref DateTimeOffset start,
        ref DateTimeOffset end,
        bool isManagedByAuthorizedOther,
        bool canBypassSubmissionRules = false)
    {
        var nowLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.Local);
        var todayLocal = nowLocal.Date;

        // 1. DurationMode rules (hours = časová, single_day = jednodenní, days = vícedenní)
        if (type.DurationMode == DurationMode.single_day)
        {
            if (!canBypassSubmissionRules && type.SubmissionOffsetDays == 0 && !string.IsNullOrWhiteSpace(type.SubmissionDeadlineTime))
            {
                // Pro jednodenní absenci s offsetem 0 a časovým limitem (např. Sick day) se běžně zapisuje dnešní datum
                start = new DateTimeOffset(todayLocal, TimeSpan.Zero);
            }
            end = new DateTimeOffset(start.Date, TimeSpan.Zero);
        }
        else if (type.DurationMode == DurationMode.hours)
        {
            if (end < start)
            {
                return (false, "ERR_INVALID_TIME_RANGE", "Čas ukončení nemůže předcházet času začátku.");
            }
        }
        else
        {
            if (end.Date < start.Date)
            {
                return (false, "ERR_INVALID_DATE_RANGE", "Datum ukončení nemůže předcházet datu začátku.");
            }
        }

        if (canBypassSubmissionRules)
        {
            return (true, null, null);
        }

        // 2. SubmissionOffsetDays & SubmissionDeadlineTime
        // Vedoucí v Detailu osoby má stejné podmínky jako daná osoba,
        // jedině u DurationMode.single_day se SubmissionOffsetDays == 0 pro něj neplatí časové omezení SubmissionDeadlineTime v daný den.
        var minAllowedDate = todayLocal.AddDays(type.SubmissionOffsetDays);
        if (start.Date < minAllowedDate)
        {
            string msg = type.SubmissionOffsetDays > 0
                ? $"Žádost typu '{type.NameEmployee}' je nutné zadat alespoň {type.SubmissionOffsetDays} {(type.SubmissionOffsetDays == 1 ? "den" : type.SubmissionOffsetDays < 5 ? "dny" : "dní")} předem (nejdříve od {minAllowedDate:dd.MM.yyyy})."
                : $"Žádost typu '{type.NameEmployee}' nelze zadat zpětně do minulosti.";
            return (false, "ERR_SUBMISSION_OFFSET", msg);
        }

        if (!string.IsNullOrWhiteSpace(type.SubmissionDeadlineTime) &&
            TimeSpan.TryParse(type.SubmissionDeadlineTime, out var deadlineTime))
        {
            string formattedDeadline = type.SubmissionDeadlineTime.Length >= 5
                ? type.SubmissionDeadlineTime.Substring(0, 5)
                : type.SubmissionDeadlineTime;

            if (type.DurationMode == DurationMode.single_day && type.SubmissionOffsetDays == 0)
            {
                if (start.Date != todayLocal)
                {
                    return (false, "ERR_SUBMISSION_DEADLINE_PASSED", $"Žádost '{type.NameEmployee}' lze zadat pouze pro dnešní den.");
                }
                if (!isManagedByAuthorizedOther && nowLocal.TimeOfDay > deadlineTime)
                {
                    return (false, "ERR_SUBMISSION_DEADLINE_PASSED", $"Žádost '{type.NameEmployee}' lze v daný den zadat pouze do {formattedDeadline}.");
                }
            }
            else if (start.Date == minAllowedDate && nowLocal.TimeOfDay > deadlineTime)
            {
                return (false, "ERR_SUBMISSION_DEADLINE_PASSED", $"Žádost '{type.NameEmployee}' na termín {start.Date:dd.MM.yyyy} bylo možné zadat nejpozději do {formattedDeadline}.");
            }
        }

        return (true, null, null);
    }

    /// <summary>
    /// Vrátí schválené absence pro aktuální týden a nadcházející týden napříč firmou pro nový box na Přehledu,
    /// případně pro zvolený měsíc a rok (stránka Absence).
    /// </summary>
    [HttpGet("upcoming")]
    public async Task<ActionResult<ApiResponse<List<AbsenceRequestItemDto>>>> GetUpcomingAbsences([FromQuery] int? year = null, [FromQuery] int? month = null)
    {
        var nowLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.Local);
        var todayLocal = nowLocal.Date;

        DateTime rangeStart;
        DateTime rangeEnd;
        bool filterNotEndedBeforeToday;

        if (year.HasValue && month.HasValue && month.Value >= 1 && month.Value <= 12)
        {
            rangeStart = new DateTime(year.Value, month.Value, 1);
            rangeEnd = new DateTime(year.Value, month.Value, DateTime.DaysInMonth(year.Value, month.Value));
            filterNotEndedBeforeToday = false;
        }
        else
        {
            int diffToMonday = todayLocal.DayOfWeek == DayOfWeek.Sunday ? 6 : (int)todayLocal.DayOfWeek - (int)DayOfWeek.Monday;
            var thisWeekMonday = todayLocal.AddDays(-diffToMonday);
            var nextWeekSunday = thisWeekMonday.AddDays(13);
            rangeStart = thisWeekMonday;
            rangeEnd = nextWeekSunday;
            filterNotEndedBeforeToday = true;
        }

        var allUsers = await _context.Users
            .Where(u => u.IsActive && u.IsApproved)
            .ToDictionaryAsync(u => u.Id, u => u);
        var types = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var contractTypes = await _context.ContractTypes.ToDictionaryAsync(c => c.Code, c => c.Name);

        var allCompleted = await _context.AbsenceRequests
            .Where(r => r.Status == AbsenceStatus.completed)
            .ToListAsync();

        var matching = allCompleted
            .Where(r =>
                allUsers.ContainsKey(r.UserId) &&
                r.PlannedStart.Date <= rangeEnd &&
                r.PlannedEnd.Date >= rangeStart &&
                (!filterNotEndedBeforeToday || r.PlannedEnd.Date >= todayLocal))
            .OrderBy(r => r.PlannedStart)
            .ThenBy(r => allUsers[r.UserId].DisplayName)
            .ToList();

        var result = matching.Select(r =>
        {
            var u = allUsers[r.UserId];
            var type = types.TryGetValue(r.AbsenceTypeId, out var t) ? t : null;
            var typeCode = type?.Code ?? "vacation";
            var typeName = type?.NameEmployee ?? "Dovolená";
            bool isHourly = type?.DurationMode == DurationMode.hours;
            int days = Math.Max(1, (int)Math.Round((r.PlannedEnd.Date - r.PlannedStart.Date).TotalDays) + 1);

            return new AbsenceRequestItemDto
            {
                Id = r.Id.ToString(),
                ApplicantId = r.UserId.ToString(),
                UserName = u.DisplayName,
                UserRole = UserDisplayHelper.GetRoleLabelCzech(u.Role),
                Contract = u.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
                ContractType = u.ContractType.ToString().ToLowerInvariant(),
                ContractTypeName = UserDisplayHelper.GetContractDisplayLabel(u.ContractKind, u.ContractType, contractTypes),
                IsPermanentHomeOffice = u.IsPermanentHomeOffice,
                Type = typeCode,
                TypeName = typeName,
                StartDate = r.PlannedStart.ToString("yyyy-MM-dd"),
                EndDate = r.PlannedEnd.ToString("yyyy-MM-dd"),
                DaysCount = days,
                StartTime = isHourly ? r.PlannedStart.ToString("HH:mm") : null,
                EndTime = isHourly ? r.PlannedEnd.ToString("HH:mm") : null,
                Note = r.Note,
                Status = "approved",
                IsRead = r.IsRead,
                CreatedAt = (r.CreatedAt ?? r.ApprovedAt ?? r.PlannedStart).ToString("O")
            };
        }).ToList();

        return Ok(ApiResponse<List<AbsenceRequestItemDto>>.Success(result));
    }

    /// <summary>
    /// Zkontroluje, zda nová nebo obnovovaná absence nepřekrývá jinou aktivní absenci nebo záznam přítomnosti (směnu).
    /// Směny přes půlnoc se započítávají do dne, kdy byly započaty (AttendanceController.GetShiftOriginLocalDate).
    /// </summary>
    private async Task<(bool IsValid, string? ErrorCode, string? ErrorMessage)> ValidateNoOverlapAsync(
        Guid userId,
        AbsenceType type,
        DateTimeOffset start,
        DateTimeOffset end,
        Guid? excludeRequestId = null)
    {
        var allTypes = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);

        // 1. Kontrola překryvu s jinou aktivní absencí (pending nebo completed)
        var userAbsences = await _context.AbsenceRequests
            .Where(r => r.UserId == userId && (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending))
            .ToListAsync();

        foreach (var ex in userAbsences)
        {
            if (excludeRequestId.HasValue && ex.Id == excludeRequestId.Value)
                continue;

            if (ex.PlannedStart.Date <= end.Date && ex.PlannedEnd.Date >= start.Date)
            {
                var exType = allTypes.TryGetValue(ex.AbsenceTypeId, out var t) ? t : null;
                var exTypeName = exType?.NameEmployee ?? "Absence";
                bool bothHourly = type.DurationMode == DurationMode.hours && exType?.DurationMode == DurationMode.hours;

                if (bothHourly)
                {
                    if (start.TimeOfDay < ex.PlannedEnd.TimeOfDay && end.TimeOfDay > ex.PlannedStart.TimeOfDay)
                    {
                        return (false, "ERR_OVERLAP_ABSENCE", $"Nelze zadat absenci: časové rozmezí se překrývá s jinou absencí ({exTypeName}, {ex.PlannedStart:dd.MM.yyyy} {ex.PlannedStart:HH:mm}–{ex.PlannedEnd:HH:mm}).");
                    }
                }
                else
                {
                    string dateDesc = ex.PlannedStart.Date == ex.PlannedEnd.Date
                        ? $"{ex.PlannedStart:dd.MM.yyyy}"
                        : $"{ex.PlannedStart:dd.MM.yyyy} – {ex.PlannedEnd:dd.MM.yyyy}";
                    return (false, "ERR_OVERLAP_ABSENCE", $"Nelze zadat absenci: termín se překrývá s jinou evidovanou absencí ({exTypeName}, {dateDesc}).");
                }
            }
        }

        // 2. Kontrola překryvu s přítomností (TimeEntries) – přítomnost přes půlnoc se započítává do dne započetí logu
        var userEntries = await _context.TimeEntries
            .Where(e => e.UserId == userId)
            .ToListAsync();

        var nowUtc = DateTimeOffset.UtcNow;

        foreach (var entry in userEntries)
        {
            var localStart = entry.StartTime.ToLocalTime();
            // Pokud jde o půlnoční pokračování (začátek 00:00:00), započítává se do předchozího dne, kdy byl log započat
            var originDate = AttendanceController.GetShiftOriginLocalDate(entry);

            if (originDate >= start.Date && originDate <= end.Date)
            {
                if (type.DurationMode == DurationMode.hours)
                {
                    // Pokud jde o půlnoční pokračování (00:00:00) započtené do včerejška, jeho čas v rámci včerejšího dne je po 24:00, takže nekoliduje s denní hodinovou absencí 00:00-23:59
                    if (localStart.TimeOfDay == TimeSpan.Zero)
                        continue;

                    var effectiveEndLocal = (entry.EndTime ?? nowUtc).ToLocalTime();
                    var entryStartTod = localStart.TimeOfDay;
                    var entryEndTod = effectiveEndLocal.Date > originDate
                        ? TimeSpan.FromHours(24)
                        : effectiveEndLocal.TimeOfDay;

                    if (start.TimeOfDay < entryEndTod && end.TimeOfDay > entryStartTod)
                    {
                        return (false, "ERR_OVERLAP_PRESENCE", $"Nelze zadat časovou absenci: překrývá se se záznamem přítomnosti dne {originDate:dd.MM.yyyy} ({localStart:HH:mm} – {effectiveEndLocal:HH:mm}).");
                    }
                }
                else
                {
                    return (false, "ERR_OVERLAP_PRESENCE", $"Nelze zadat absenci: dne {originDate:dd.MM.yyyy} již existuje záznam přítomnosti v práci.");
                }
            }
        }

        return (true, null, null);
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

        if (user.ContractKind == ContractKind.osvc && type != null && !type.AllowOsvc)
        {
            return BadRequest(ApiResponse<AbsenceRequestItemDto>.Failure("ERR_OSVC_ABSENCE_NOT_ALLOWED", $"Žádost typu '{type.NameEmployee}' není pro spolupráci OSVČ povolena."));
        }

        var (isManagedByAuthorizedOther, canBypassSubmissionRules, verifiedCallerId) = await CheckManagedByAuthorizedOtherAsync(user.Id, dto.ApprovedByUserId);

        DateTimeOffset start;
        DateTimeOffset end;

        var fallbackToday = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.Local).Date;
        var parsedStartDate = !string.IsNullOrWhiteSpace(dto.StartDate) && DateTime.TryParse(dto.StartDate, out var ps)
            ? ps.Date
            : fallbackToday;
        var parsedEndDate = !string.IsNullOrWhiteSpace(dto.EndDate) && DateTime.TryParse(dto.EndDate, out var pe)
            ? pe.Date
            : parsedStartDate;

        if (type!.DurationMode == DurationMode.hours)
        {
            var startTimeParts = (dto.StartTime ?? "08:30").Split(':');
            var endTimeParts = (dto.EndTime ?? "11:30").Split(':');

            start = new DateTimeOffset(new DateTime(parsedStartDate.Year, parsedStartDate.Month, parsedStartDate.Day, int.Parse(startTimeParts[0]), int.Parse(startTimeParts[1]), 0), TimeSpan.Zero);
            end = new DateTimeOffset(new DateTime(parsedStartDate.Year, parsedStartDate.Month, parsedStartDate.Day, int.Parse(endTimeParts[0]), int.Parse(endTimeParts[1]), 0), TimeSpan.Zero);
        }
        else
        {
            start = new DateTimeOffset(parsedStartDate, TimeSpan.Zero);
            end = new DateTimeOffset(parsedEndDate, TimeSpan.Zero);
        }

        var validation = ValidateAbsenceRules(type, ref start, ref end, isManagedByAuthorizedOther, canBypassSubmissionRules);
        if (!validation.IsValid)
        {
            return BadRequest(ApiResponse<AbsenceRequestItemDto>.Failure(validation.ErrorCode ?? "ERR_VALIDATION", validation.ErrorMessage ?? "Neplatné parametry žádosti."));
        }

        var overlapValidation = await ValidateNoOverlapAsync(user.Id, type, start, end);
        if (!overlapValidation.IsValid)
        {
            return BadRequest(ApiResponse<AbsenceRequestItemDto>.Failure(overlapValidation.ErrorCode ?? "ERR_OVERLAP", overlapValidation.ErrorMessage ?? "Termín koliduje s jiným záznamem."));
        }

        string fullNote = dto.Note ?? "";

        var managerRelation = await _context.UserManagers.FirstOrDefaultAsync(um => um.UserId == user.Id);
        var effectiveManagerId = user.ManagerId ?? managerRelation?.ManagerId;
        var effectiveParentId = user.ParentPersonId ?? managerRelation?.ParentPersonId;

        bool isUnlimitedHomeOffice = false;
        if (type.Code == "home_office")
        {
            var hoSetting = await _context.UserAbsenceSettings
                .FirstOrDefaultAsync(s => s.UserId == user.Id && s.AbsenceTypeId == type.Id && s.Year == start.Year);
            isUnlimitedHomeOffice =
                user.IsPermanentHomeOffice ||
                type.DefaultBudgetPeriod == BudgetPeriod.unlimited ||
                (hoSetting != null && (hoSetting.BudgetPeriod == BudgetPeriod.unlimited || hoSetting.AllocatedCapacity == null)) ||
                (hoSetting == null && type.DefaultAllowance == null);
        }

        // Automaticky schválená žádost je, pokud daný člověk má sloupeček ManagerId prázdný, nebo pokud jde o neomezený Home Office, nebo pokud je zadána oprávněnou rolí (Admin, Office Manager, Manažer) v Detailu osoby
        bool isAutoApproved = !effectiveManagerId.HasValue || canBypassSubmissionRules || isUnlimitedHomeOffice;
        var approverId = canBypassSubmissionRules ? (verifiedCallerId ?? dto.ApprovedByUserId ?? user.Id) : user.Id;
        var nowUtc = DateTimeOffset.UtcNow;

        var req = new AbsenceRequest
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            AbsenceTypeId = type!.Id,
            Status = isAutoApproved ? AbsenceStatus.completed : AbsenceStatus.pending,
            ApprovedBy = isAutoApproved ? approverId : null,
            ApprovedAt = isAutoApproved ? nowUtc : null,
            PlannedStart = start,
            PlannedEnd = end,
            Note = fullNote,
            IsRead = false,
            CreatedAt = nowUtc
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

        string? approvedByName = null;
        if (isAutoApproved)
        {
            var approverUser = await _context.Users.FindAsync(approverId);
            approvedByName = approverUser?.DisplayName ?? user.DisplayName;
        }

        var contractTypes = await _context.ContractTypes.ToDictionaryAsync(c => c.Code, c => c.Name);
        bool isHourly = type.DurationMode == DurationMode.hours;

        var responseDto = new AbsenceRequestItemDto
        {
            Id = req.Id.ToString(),
            ApplicantId = user.Id.ToString(),
            UserName = user.DisplayName,
            UserRole = UserDisplayHelper.GetRoleLabelCzech(user.Role),
            Contract = user.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
            ContractType = user.ContractType.ToString().ToLowerInvariant(),
            ContractTypeName = UserDisplayHelper.GetContractDisplayLabel(user.ContractKind, user.ContractType, contractTypes),
            IsPermanentHomeOffice = user.IsPermanentHomeOffice,
            ManagerId = effectiveManagerId?.ToString(),
            ManagerName = managerName,
            ParentPersonId = effectiveParentId?.ToString(),
            ParentPersonName = parentName,
            Type = type.Code,
            TypeName = type.NameEmployee,
            StartDate = req.PlannedStart.ToString("yyyy-MM-dd"),
            EndDate = req.PlannedEnd.ToString("yyyy-MM-dd"),
            DaysCount = Math.Max(1, (int)Math.Round((req.PlannedEnd.Date - req.PlannedStart.Date).TotalDays) + 1),
            StartTime = isHourly ? req.PlannedStart.ToString("HH:mm") : null,
            EndTime = isHourly ? req.PlannedEnd.ToString("HH:mm") : null,
            FacilityName = null,
            HasConfirmationDocument = dto.HasConfirmationDocument,
            Note = req.Note,
            Status = isAutoApproved ? "approved" : "pending",
            IsRead = req.IsRead,
            CreatedAt = nowUtc.ToString("O"),
            ApprovedByName = approvedByName,
            ApprovedAt = isAutoApproved ? nowUtc.ToString("O") : null
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

        var type = await _context.AbsenceTypes.FindAsync(req.AbsenceTypeId);
        if (type != null && type.DurationMode == DurationMode.single_day)
        {
            req.PlannedEnd = new DateTimeOffset(req.PlannedStart.Date, TimeSpan.Zero);
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
    /// Obnoví zamítnutou žádost (upraví termín/typ/poznámku a odešle ji znovu do schvalovacího procesu).
    /// </summary>
    [HttpPost("{id}/resubmit")]
    public async Task<ActionResult<ApiResponse<bool>>> ResubmitRequest([FromRoute] Guid id, [FromBody] ResubmitAbsenceDto dto)
    {
        var req = await _context.AbsenceRequests.FindAsync(id);
        if (req == null)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_REQUEST_NOT_FOUND", "Žádost nebyla nalezena."));
        }

        var user = await _context.Users.FindAsync(req.UserId);
        var currentType = await _context.AbsenceTypes.FindAsync(req.AbsenceTypeId);
        AbsenceType? effectiveType = currentType;

        if (!string.IsNullOrEmpty(dto.TypeCode) && currentType?.Code != dto.TypeCode)
        {
            var newType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == dto.TypeCode);
            if (newType != null)
            {
                req.AbsenceTypeId = newType.Id;
                effectiveType = newType;
            }
        }

        if (user != null && user.ContractKind == ContractKind.osvc && effectiveType != null && !effectiveType.AllowOsvc)
        {
            return BadRequest(ApiResponse<bool>.Failure("ERR_OSVC_ABSENCE_NOT_ALLOWED", $"Žádost typu '{effectiveType.NameEmployee}' není pro spolupráci OSVČ povolena."));
        }

        var (isManagedByAuthorizedOther, canBypassSubmissionRules, verifiedCallerId) = await CheckManagedByAuthorizedOtherAsync(req.UserId, dto.ApprovedByUserId);

        DateTimeOffset nextStart = req.PlannedStart;
        DateTimeOffset nextEnd = req.PlannedEnd;

        if (effectiveType != null && effectiveType.DurationMode == DurationMode.hours)
        {
            var date = !string.IsNullOrEmpty(dto.StartDate) && DateTime.TryParse(dto.StartDate, out var parsedD)
                ? parsedD.Date
                : req.PlannedStart.Date;
            var startTimeParts = (dto.StartTime ?? req.PlannedStart.ToString("HH:mm")).Split(':');
            var endTimeParts = (dto.EndTime ?? req.PlannedEnd.ToString("HH:mm")).Split(':');

            nextStart = new DateTimeOffset(new DateTime(date.Year, date.Month, date.Day, int.Parse(startTimeParts[0]), int.Parse(startTimeParts[1]), 0), TimeSpan.Zero);
            nextEnd = new DateTimeOffset(new DateTime(date.Year, date.Month, date.Day, int.Parse(endTimeParts[0]), int.Parse(endTimeParts[1]), 0), TimeSpan.Zero);
        }
        else
        {
            if (!string.IsNullOrEmpty(dto.StartDate) && DateTime.TryParse(dto.StartDate, out var parsedStart))
            {
                nextStart = new DateTimeOffset(parsedStart.Date, TimeSpan.Zero);
            }
            if (!string.IsNullOrEmpty(dto.EndDate) && DateTime.TryParse(dto.EndDate, out var parsedEnd))
            {
                nextEnd = new DateTimeOffset(parsedEnd.Date, TimeSpan.Zero);
            }
        }

        if (effectiveType != null)
        {
            var validation = ValidateAbsenceRules(effectiveType, ref nextStart, ref nextEnd, isManagedByAuthorizedOther, canBypassSubmissionRules);
            if (!validation.IsValid)
            {
                return BadRequest(ApiResponse<bool>.Failure(validation.ErrorCode ?? "ERR_VALIDATION", validation.ErrorMessage ?? "Neplatné parametry žádosti."));
            }

            var overlapValidation = await ValidateNoOverlapAsync(req.UserId, effectiveType, nextStart, nextEnd, req.Id);
            if (!overlapValidation.IsValid)
            {
                return BadRequest(ApiResponse<bool>.Failure(overlapValidation.ErrorCode ?? "ERR_OVERLAP", overlapValidation.ErrorMessage ?? "Termín koliduje s jiným záznamem."));
            }
        }

        req.PlannedStart = nextStart;
        req.PlannedEnd = nextEnd;

        if (dto.Note != null)
        {
            req.Note = dto.Note;
        }

        bool isUnlimitedHomeOffice = false;
        if (effectiveType != null && effectiveType.Code == "home_office")
        {
            var hoSetting = await _context.UserAbsenceSettings
                .FirstOrDefaultAsync(s => s.UserId == req.UserId && s.AbsenceTypeId == effectiveType.Id && s.Year == nextStart.Year);
            isUnlimitedHomeOffice =
                (user?.IsPermanentHomeOffice == true) ||
                effectiveType.DefaultBudgetPeriod == BudgetPeriod.unlimited ||
                (hoSetting != null && (hoSetting.BudgetPeriod == BudgetPeriod.unlimited || hoSetting.AllocatedCapacity == null)) ||
                (hoSetting == null && effectiveType.DefaultAllowance == null);
        }

        var managerRelation = user != null ? await _context.UserManagers.FirstOrDefaultAsync(um => um.UserId == user.Id) : null;
        var effectiveManagerId = user?.ManagerId ?? managerRelation?.ManagerId;
        bool isAutoApproved = !effectiveManagerId.HasValue || canBypassSubmissionRules || isUnlimitedHomeOffice;
        var nowUtc = DateTimeOffset.UtcNow;

        req.Status = isAutoApproved ? AbsenceStatus.completed : AbsenceStatus.pending;
        req.ApprovedBy = isAutoApproved ? (canBypassSubmissionRules ? (verifiedCallerId ?? dto.ApprovedByUserId ?? req.UserId) : req.UserId) : null;
        req.ApprovedAt = isAutoApproved ? nowUtc : null;
        req.RejectionReason = null;
        req.IsRead = false;
        req.CreatedAt = nowUtc;

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

        decimal defVac = vacType?.DefaultAllowance ?? 20m;
        decimal defSick = sickType?.DefaultAllowance ?? 3m;

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
            Role = UserDisplayHelper.GetRoleLabelCzech(user.Role),
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

        decimal defaultHo = hoType?.DefaultAllowance ?? 2m;

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
                    MaxPerMonthOverride = sickType.MaxPerMonthLimit,
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
    /// Získá výchozí firemní nastavení pracovní doby (DailyHours, WeeklyWorkDays).
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
            WeeklyWorkDays = cs.WeeklyWorkDays
        }));
    }

    /// <summary>
    /// Uloží změny výchozího firemního nastavení pracovní doby (DailyHours, WeeklyWorkDays).
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

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<CompanySettingDto>.Success(new CompanySettingDto
        {
            DailyHours = cs.DailyHours,
            WeeklyWorkDays = cs.WeeklyWorkDays
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
}
