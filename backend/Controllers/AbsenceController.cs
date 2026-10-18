using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Dochazka.Api.Data;
using Dochazka.Api.Models;
using Dochazka.Api.Services;

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
        var holidays = await _context.Holidays.ToListAsync();

        var yearStart = new DateTimeOffset(targetYear, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var yearEnd = new DateTimeOffset(targetYear, 12, 31, 23, 59, 59, 999, TimeSpan.Zero);

        var allUserRequests = await _context.AbsenceRequests
            .Where(r => r.UserId == userId && !r.IsDeleted)
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

            int usedDays = absType.DurationMode == DurationMode.hours
                ? 0
                : activeYearRequests
                    .Where(r => r.AbsenceTypeId == absType.Id &&
                                (hasAllocatedFund || r.Status == AbsenceStatus.completed))
                    .Sum(r => HolidayService.CountWorkingDays(r.PlannedStart.Date, r.PlannedEnd.Date, holidays));

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

    private static bool IsUserFemale(User? u) =>
        u != null && (u.IsFemale || u.LastName.EndsWith("á", StringComparison.OrdinalIgnoreCase) || u.DisplayName.EndsWith("á", StringComparison.OrdinalIgnoreCase));

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
        var holidays = await _context.Holidays.ToListAsync();

        var rawRequests = await _context.AbsenceRequests
            .Where(r => r.UserId == userId && !r.IsDeleted)
            .ToListAsync();
        var requests = rawRequests
            .OrderBy(r => r.CreatedAt ?? r.ApprovedAt ?? r.PlannedStart)
            .ThenBy(r => r.PlannedStart)
            .ToList();

        var reqIds = requests.Select(r => r.Id).ToHashSet();
        var allEditLogs = (await _context.AbsenceEditLogs
            .Where(l => reqIds.Contains(l.AbsenceRequestId))
            .ToListAsync())
            .OrderByDescending(l => l.EditedAt)
            .ToList();
        var editLogsByReq = allEditLogs
            .GroupBy(l => l.AbsenceRequestId)
            .ToDictionary(g => g.Key, g => g.Select(l => new RecordEditLogDto
            {
                Id = l.Id.ToString(),
                EditedByUserId = l.EditedByUserId.ToString(),
                EditedByName = l.EditedByName,
                EditedAt = l.EditedAt.ToString("O"),
                Summary = l.Summary
            }).ToList());

        var managerRelation = await _context.UserManagers.FirstOrDefaultAsync(um => um.UserId == userId);
        var effectiveManagerId = user.ManagerId ?? managerRelation?.ManagerId;
        var effectiveParentId = user.ParentPersonId ?? managerRelation?.ParentPersonId;

        string managerName = "Vedení společnosti";
        User? effectiveMgrUser = null;
        if (effectiveManagerId.HasValue && allUsers.TryGetValue(effectiveManagerId.Value, out var mgr))
        {
            managerName = mgr.DisplayName;
            effectiveMgrUser = mgr;
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

            int days = isHourly ? 0 : HolidayService.CountWorkingDays(r.PlannedStart.Date, r.PlannedEnd.Date, holidays);

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
                        .Sum(ar => HolidayService.CountWorkingDays(ar.PlannedStart.Date, ar.PlannedEnd.Date, holidays));
                    remainingDays = Math.Max(0, totalDays - usedDays);
                }
            }

            string? approvedByName = null;
            bool? approvedByIsFemale = null;
            string? approvedAtStr = null;
            if (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.rejected)
            {
                var resolverId = r.ApprovedBy ?? r.VerifiedBy ?? effectiveManagerId;
                if (resolverId.HasValue && allUsers.TryGetValue(resolverId.Value, out var resolverUser))
                {
                    approvedByName = resolverUser.DisplayName;
                    approvedByIsFemale = resolverUser.IsFemale;
                }
                else
                {
                    approvedByName = managerName;
                    approvedByIsFemale = effectiveMgrUser?.IsFemale;
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
                Status = r.Status == AbsenceStatus.completed ? "approved" : r.Status.ToString().ToLowerInvariant(),
                IsRead = r.IsRead,
                CreatedAt = (r.CreatedAt ?? r.ApprovedAt ?? r.PlannedStart).ToString("O"),
                ApprovedByName = approvedByName,
                ApprovedByIsFemale = approvedByIsFemale,
                ApprovedAt = approvedAtStr,
                RemainingDays = remainingDays,
                TotalDays = totalDays,
                EditLogs = editLogsByReq.TryGetValue(r.Id, out var logs) ? logs : new List<RecordEditLogDto>()
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

        var allRequests = await _context.AbsenceRequests
            .Where(r => !r.IsDeleted)
            .ToListAsync();
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

        var reqIds = requests.Select(r => r.Id).ToHashSet();
        var allEditLogs = (await _context.AbsenceEditLogs
            .Where(l => reqIds.Contains(l.AbsenceRequestId))
            .ToListAsync())
            .OrderByDescending(l => l.EditedAt)
            .ToList();
        var editLogsByReq = allEditLogs
            .GroupBy(l => l.AbsenceRequestId)
            .ToDictionary(g => g.Key, g => g.Select(l => new RecordEditLogDto
            {
                Id = l.Id.ToString(),
                EditedByUserId = l.EditedByUserId.ToString(),
                EditedByName = l.EditedByName,
                EditedAt = l.EditedAt.ToString("O"),
                Summary = l.Summary
            }).ToList());

        var allUsers = await _context.Users.ToDictionaryAsync(u => u.Id, u => u);
        var allUserManagers = await _context.UserManagers
            .GroupBy(um => um.UserId)
            .ToDictionaryAsync(g => g.Key, g => g.First());
        var userIds = requests.Select(r => r.UserId).Distinct().ToList();
        var types = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var contractTypes = await _context.ContractTypes.ToDictionaryAsync(c => c.Code, c => c.Name);
        var holidays = await _context.Holidays.ToListAsync();

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
            int days = isHourly ? 0 : HolidayService.CountWorkingDays(r.PlannedStart.Date, r.PlannedEnd.Date, holidays);

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
                        .Sum(ar => HolidayService.CountWorkingDays(ar.PlannedStart.Date, ar.PlannedEnd.Date, holidays));
                    remainingDays = Math.Max(0, totalDays - usedDays);
                }
            }

            var effectiveMgrId = applicant?.ManagerId ?? umRel?.ManagerId;
            var effectiveParentId = applicant?.ParentPersonId ?? umRel?.ParentPersonId;
            string mgrName = "Vedení společnosti";
            User? effectiveMgrUser = null;
            if (effectiveMgrId.HasValue && allUsers.TryGetValue(effectiveMgrId.Value, out var mgrUser))
            {
                mgrName = mgrUser.DisplayName;
                effectiveMgrUser = mgrUser;
            }
            string? parentName = null;
            if (effectiveParentId.HasValue && allUsers.TryGetValue(effectiveParentId.Value, out var parentUser))
            {
                parentName = parentUser.DisplayName;
            }

            string? approvedByName = null;
            bool? approvedByIsFemale = null;
            string? approvedAtStr = null;
            if (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.rejected)
            {
                var resolverId = r.ApprovedBy ?? r.VerifiedBy ?? effectiveMgrId;
                if (resolverId.HasValue && allUsers.TryGetValue(resolverId.Value, out var resolverUser))
                {
                    approvedByName = resolverUser.DisplayName;
                    approvedByIsFemale = resolverUser.IsFemale;
                }
                else
                {
                    approvedByName = mgrName;
                    approvedByIsFemale = effectiveMgrUser?.IsFemale;
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
                Status = r.Status == AbsenceStatus.completed ? "approved" : r.Status.ToString().ToLowerInvariant(),
                IsRead = r.IsRead,
                CreatedAt = (r.CreatedAt ?? r.ApprovedAt ?? r.PlannedStart).ToString("O"),
                ApprovedByName = approvedByName,
                ApprovedByIsFemale = approvedByIsFemale,
                ApprovedAt = approvedAtStr,
                RemainingDays = remainingDays,
                TotalDays = totalDays,
                EditLogs = editLogsByReq.TryGetValue(r.Id, out var logs) ? logs : new List<RecordEditLogDto>()
            };
        }).ToList();

        return Ok(ApiResponse<List<AbsenceRequestItemDto>>.Success(result));
    }

    /// <summary>
    /// Vrátí konfiguraci typů absencí z DB (DurationMode: days/hours/single_day, SubmissionOffsetDays, SubmissionDeadlineTime, AllowOsvc, Icon, Color, IsSystem).
    /// </summary>
    [HttpGet("types")]
    public async Task<ActionResult<ApiResponse<List<AbsenceTypeConfigDto>>>> GetAbsenceTypes()
    {
        var types = await _context.AbsenceTypes
            .Where(t => t.IsActive)
            .ToListAsync();

        var result = types.Select(t => new AbsenceTypeConfigDto
        {
            Id = t.Id,
            Code = t.Code,
            NameEmployee = t.NameEmployee,
            AllowOsvc = t.AllowOsvc,
            DurationMode = t.DurationMode.ToString().ToLowerInvariant(),
            SubmissionOffsetDays = t.SubmissionOffsetDays,
            SubmissionDeadlineTime = t.SubmissionDeadlineTime,
            MaxPerMonthLimit = t.MaxPerMonthLimit,
            DefaultBudgetPeriod = t.DefaultBudgetPeriod.ToString().ToLowerInvariant(),
            DefaultAllowance = t.DefaultAllowance,
            IsActive = t.IsActive,
            Icon = string.IsNullOrWhiteSpace(t.Icon) ? "Palmtree" : t.Icon,
            Color = string.IsNullOrWhiteSpace(t.Color) ? "amber" : t.Color,
            IsSystem = t.IsSystem || new[] { "vacation", "doctor", "sick_day", "home_office", "unpaid_leave", "illness" }.Contains(t.Code)
        }).ToList();

        return Ok(ApiResponse<List<AbsenceTypeConfigDto>>.Success(result));
    }

    /// <summary>
    /// Uloží konfiguraci typů absencí v číselníku absence_types (včetně DefaultAllowance, Icon, Color a případných nově přidaných typů).
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

            var existing = (dto.Id.HasValue ? existingList.FirstOrDefault(t => t.Id == dto.Id.Value) : null)
                ?? existingList.FirstOrDefault(t => string.Equals(t.Code, code, StringComparison.OrdinalIgnoreCase));
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
                    IsActive = dto.IsActive,
                    Icon = string.IsNullOrWhiteSpace(dto.Icon) ? "Palmtree" : dto.Icon.Trim(),
                    Color = string.IsNullOrWhiteSpace(dto.Color) ? "amber" : dto.Color.Trim(),
                    IsSystem = false
                };
                _context.AbsenceTypes.Add(created);
                existingList.Add(created);
            }
            else
            {
                if (!existing.IsSystem && !string.IsNullOrWhiteSpace(code))
                {
                    existing.Code = code;
                }
                existing.NameEmployee = dto.NameEmployee.Trim();
                existing.AllowOsvc = dto.AllowOsvc;
                existing.DurationMode = durMode;
                existing.SubmissionOffsetDays = Math.Max(0, dto.SubmissionOffsetDays);
                existing.SubmissionDeadlineTime = string.IsNullOrWhiteSpace(dto.SubmissionDeadlineTime) ? null : dto.SubmissionDeadlineTime.Trim();
                existing.MaxPerMonthLimit = dto.MaxPerMonthLimit;
                existing.DefaultBudgetPeriod = budgetPeriod;
                existing.DefaultAllowance = defAllowance;
                existing.IsActive = dto.IsActive;
                if (!string.IsNullOrWhiteSpace(dto.Icon)) existing.Icon = dto.Icon.Trim();
                if (!string.IsNullOrWhiteSpace(dto.Color)) existing.Color = dto.Color.Trim();
            }
        }

        await _context.SaveChangesAsync();
        return await GetAbsenceTypes();
    }

    /// <summary>
    /// Smazání vlastního (nesystémového) typu absence z tabulky absence_types.
    /// Systémové záznamy (IsSystem = true) nelze smazat.
    /// </summary>
    [HttpDelete("types/{id}")]
    public async Task<ActionResult<ApiResponse<List<AbsenceTypeConfigDto>>>> DeleteAbsenceType([FromRoute] Guid id)
    {
        var item = await _context.AbsenceTypes.FindAsync(id);
        if (item == null)
        {
            return NotFound(ApiResponse<List<AbsenceTypeConfigDto>>.Failure("ERR_NOT_FOUND", "Typ absence nebyl nalezen."));
        }

        var builtInCodes = new[] { "vacation", "doctor", "sick_day", "home_office", "unpaid_leave", "illness" };
        if (item.IsSystem || builtInCodes.Contains(item.Code.ToLowerInvariant()))
        {
            return BadRequest(ApiResponse<List<AbsenceTypeConfigDto>>.Failure("ERR_SYSTEM_ABSENCE_TYPE", "Systémový typ absence nelze smazat, lze jej pouze upravit."));
        }

        _context.AbsenceTypes.Remove(item);
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
    /// případně pro zvolený měsíc a rok (stránka Absence nebo tab Absence v detailu osoby).
    /// </summary>
    [HttpGet("upcoming")]
    public async Task<ActionResult<ApiResponse<List<AbsenceRequestItemDto>>>> GetUpcomingAbsences(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null,
        [FromQuery] Guid? userId = null)
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

        var allUsersIncludeInactive = await _context.Users.ToDictionaryAsync(u => u.Id, u => u);
        var allUsers = allUsersIncludeInactive
            .Where(kv => kv.Value.IsActive && kv.Value.IsApproved)
            .ToDictionary(kv => kv.Key, kv => kv.Value);
        var types = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var contractTypes = await _context.ContractTypes.ToDictionaryAsync(c => c.Code, c => c.Name);
        var holidays = await _context.Holidays.ToListAsync();

        var allActiveRequests = await _context.AbsenceRequests
            .Where(r => !r.IsDeleted && (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending))
            .ToListAsync();

        var allCompleted = allActiveRequests
            .Where(r => r.Status == AbsenceStatus.completed && (!userId.HasValue || r.UserId == userId.Value))
            .ToList();

        var matching = allCompleted
            .Where(r =>
                allUsers.ContainsKey(r.UserId) &&
                r.PlannedStart.Date <= rangeEnd &&
                r.PlannedEnd.Date >= rangeStart &&
                (!filterNotEndedBeforeToday || r.PlannedEnd.Date >= todayLocal))
            .OrderBy(r => r.PlannedStart)
            .ThenBy(r => allUsers[r.UserId].DisplayName)
            .ToList();

        var matchingUserIds = matching.Select(r => r.UserId).Distinct().ToHashSet();
        var userSettings = await _context.UserAbsenceSettings
            .Where(s => matchingUserIds.Contains(s.UserId))
            .ToListAsync();

        var reqIds = matching.Select(r => r.Id).ToList();
        var editLogsList = (await _context.AbsenceEditLogs
            .Where(l => reqIds.Contains(l.AbsenceRequestId))
            .ToListAsync())
            .OrderByDescending(l => l.EditedAt)
            .ToList();

        var editLogsByReq = editLogsList
            .GroupBy(l => l.AbsenceRequestId)
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

        var result = matching.Select(r =>
        {
            var u = allUsers[r.UserId];
            var type = types.TryGetValue(r.AbsenceTypeId, out var t) ? t : null;
            var typeCode = type?.Code ?? "vacation";
            var typeName = type?.NameEmployee ?? "Dovolená";
            bool isHourly = type?.DurationMode == DurationMode.hours;
            int days = isHourly ? 0 : HolidayService.CountWorkingDays(r.PlannedStart.Date, r.PlannedEnd.Date, holidays);

            int reqYear = r.PlannedStart.Year;
            int totalDays = 0;
            int remainingDays = 0;
            if (!isHourly && type != null && type.DefaultBudgetPeriod != BudgetPeriod.unlimited)
            {
                var setting = userSettings.FirstOrDefault(s => s.UserId == r.UserId && s.AbsenceTypeId == r.AbsenceTypeId && s.Year == reqYear);
                if (setting != null && setting.AllocatedCapacity != null)
                {
                    int carryDays = (int)setting.CarriedOverDays;
                    totalDays = (int)setting.AllocatedCapacity.Value + carryDays;
                    int usedDays = allActiveRequests
                        .Where(ar => ar.UserId == r.UserId && ar.AbsenceTypeId == r.AbsenceTypeId && ar.PlannedStart.Year == reqYear)
                        .Sum(ar => HolidayService.CountWorkingDays(ar.PlannedStart.Date, ar.PlannedEnd.Date, holidays));
                    remainingDays = Math.Max(0, totalDays - usedDays);
                }
            }

            string? approvedByName = null;
            bool? approvedByIsFemale = null;
            if (r.ApprovedBy.HasValue && allUsersIncludeInactive.TryGetValue(r.ApprovedBy.Value, out var approverUser))
            {
                approvedByName = approverUser.DisplayName;
                approvedByIsFemale = approverUser.IsFemale;
            }
            else if (r.Status == AbsenceStatus.completed)
            {
                approvedByName = u.DisplayName;
                approvedByIsFemale = u.IsFemale;
            }

            string managerName = "Vedení";
            if (u.ManagerId.HasValue && allUsersIncludeInactive.TryGetValue(u.ManagerId.Value, out var mgrUser))
            {
                managerName = mgrUser.DisplayName;
            }

            string? parentName = null;
            if (u.ParentPersonId.HasValue && allUsersIncludeInactive.TryGetValue(u.ParentPersonId.Value, out var parentUser))
            {
                parentName = parentUser.DisplayName;
            }

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
                ManagerId = u.ManagerId?.ToString(),
                ManagerName = managerName,
                ParentPersonId = u.ParentPersonId?.ToString(),
                ParentPersonName = parentName,
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
                CreatedAt = (r.CreatedAt ?? r.ApprovedAt ?? r.PlannedStart).ToString("O"),
                ApprovedByName = approvedByName,
                ApprovedByIsFemale = approvedByIsFemale,
                ApprovedAt = r.ApprovedAt?.ToString("O"),
                RemainingDays = remainingDays,
                TotalDays = totalDays,
                EditLogs = editLogsByReq.TryGetValue(r.Id, out var logs) ? logs : new List<RecordEditLogDto>()
            };
        }).ToList();

        return Ok(ApiResponse<List<AbsenceRequestItemDto>>.Success(result));
    }

    /// <summary>
    /// Zkontroluje, zda nová, upravovaná nebo obnovovaná absence nepřekrývá jinou aktivní absenci nebo záznam přítomnosti (směnu),
    /// zda obsahuje alespoň 1 pracovní den (mimo víkendy a svátky) a zda nepřekračuje roční budget uživatele.
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
            .Where(r => !r.IsDeleted && r.UserId == userId && (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending))
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
            .Where(e => !e.IsDeleted && e.UserId == userId)
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

        // 3. Kontrola pracovních dnů (mimo víkendy a svátky) a ročního budgetu pro denní absence
        if (type.DurationMode != DurationMode.hours)
        {
            var holidays = await _context.Holidays.ToListAsync();
            int workingDays = HolidayService.CountWorkingDays(start.Date, end.Date, holidays);
            if (workingDays <= 0)
            {
                return (false, "ERR_NO_WORKING_DAYS", "Zvolený termín připadá pouze na víkend nebo státní svátek (0 pracovních dnů).");
            }

            var userSettings = await _context.UserAbsenceSettings
                .Where(s => s.UserId == userId)
                .ToListAsync();

            UserAbsenceSetting? setting = null;
            foreach (var s in userSettings)
            {
                if (s.AbsenceTypeId == type.Id && s.Year == start.Year)
                {
                    setting = s;
                    break;
                }
            }

            var effectivePeriod = setting?.BudgetPeriod ?? type.DefaultBudgetPeriod;
            if (effectivePeriod != BudgetPeriod.unlimited && setting != null && setting.AllocatedCapacity.HasValue)
            {
                int totalAllowed = (int)(setting.AllocatedCapacity.Value + setting.CarriedOverDays);
                int usedOtherDays = 0;
                foreach (var r in userAbsences)
                {
                    if (excludeRequestId.HasValue && r.Id == excludeRequestId.Value)
                        continue;
                    if (r.AbsenceTypeId == type.Id && r.PlannedStart.Year == start.Year)
                    {
                        usedOtherDays += HolidayService.CountWorkingDays(r.PlannedStart.Date, r.PlannedEnd.Date, holidays);
                    }
                }

                int availableDays = Math.Max(0, totalAllowed - usedOtherDays);
                if (workingDays > availableDays)
                {
                    return (false, "ERR_BUDGET_EXCEEDED", $"Nelze uložit absenci '{type.NameEmployee}': požadováno {workingDays} prac. dnů, ale v ročním limitu zbývá pouze {availableDays} dnů.");
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

        var holidays = await _context.Holidays.ToListAsync();

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

        // Automaticky schválená žádost je, pokud daný člověk má sloupeček ManagerId prázdný, nebo pokud jde o neomezený Home Office, nebo pokud je zadána oprávněnou rolí (Admin, Office Manager, Manažer) v Detailu osoby.
        // U nemoci (illness) však může schválit / automaticky schválit pouze Admin nebo Office Manager.
        bool isAutoApproved;
        if (type.Code == "illness")
        {
            var actorId = verifiedCallerId ?? dto.ApprovedByUserId ?? GetCurrentUserId() ?? user.Id;
            var actor = actorId == user.Id ? user : await _context.Users.FindAsync(actorId);
            isAutoApproved =
                (actor != null && (actor.Role == UserRole.admin || actor.Role == UserRole.office_manager)) ||
                user.Role == UserRole.admin ||
                user.Role == UserRole.office_manager;
        }
        else
        {
            isAutoApproved = !effectiveManagerId.HasValue || canBypassSubmissionRules || isUnlimitedHomeOffice;
        }
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
        bool? approvedByIsFemale = null;
        if (isAutoApproved)
        {
            var approverUser = await _context.Users.FindAsync(approverId);
            approvedByName = approverUser?.DisplayName ?? user.DisplayName;
            approvedByIsFemale = approverUser?.IsFemale ?? user.IsFemale;
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
            DaysCount = isHourly ? 0 : HolidayService.CountWorkingDays(req.PlannedStart.Date, req.PlannedEnd.Date, holidays),
            StartTime = isHourly ? req.PlannedStart.ToString("HH:mm") : null,
            EndTime = isHourly ? req.PlannedEnd.ToString("HH:mm") : null,
            FacilityName = null,
            HasConfirmationDocument = dto.HasConfirmationDocument,
            Note = req.Note,
            Status = isAutoApproved ? "approved" : "pending",
            IsRead = req.IsRead,
            CreatedAt = nowUtc.ToString("O"),
            ApprovedByName = approvedByName,
            ApprovedByIsFemale = approvedByIsFemale,
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
        if (req == null || req.IsDeleted)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_REQUEST_NOT_FOUND", "Žádost nebyla nalezena."));
        }

        var prevStart = req.PlannedStart;
        var prevEnd = req.PlannedEnd;

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
        if (type != null && type.Code == "illness")
        {
            var approverId = dto.ManagerId != Guid.Empty ? dto.ManagerId : (GetCurrentUserId() ?? Guid.Empty);
            var approver = approverId != Guid.Empty ? await _context.Users.FindAsync(approverId) : null;
            if (approver == null || (approver.Role != UserRole.admin && approver.Role != UserRole.office_manager))
            {
                return StatusCode(403, ApiResponse<bool>.Failure("ERR_FORBIDDEN", "Nemoc může schválit pouze Administrátor nebo Office Manager."));
            }
        }
        if (type != null && type.DurationMode == DurationMode.single_day)
        {
            req.PlannedEnd = new DateTimeOffset(req.PlannedStart.Date, TimeSpan.Zero);
        }

        if (type != null)
        {
            var nextStart = req.PlannedStart;
            var nextEnd = req.PlannedEnd;
            if (req.PlannedStart != prevStart || req.PlannedEnd != prevEnd)
            {
                var validation = ValidateAbsenceRules(type, ref nextStart, ref nextEnd, isManagedByAuthorizedOther: true, canBypassSubmissionRules: true);
                if (!validation.IsValid)
                {
                    return BadRequest(ApiResponse<bool>.Failure(validation.ErrorCode ?? "ERR_VALIDATION", validation.ErrorMessage ?? "Neplatné parametry žádosti."));
                }
            }
            var overlapValidation = await ValidateNoOverlapAsync(req.UserId, type, nextStart, nextEnd, req.Id);
            if (!overlapValidation.IsValid)
            {
                return BadRequest(ApiResponse<bool>.Failure(overlapValidation.ErrorCode ?? "ERR_OVERLAP", overlapValidation.ErrorMessage ?? "Termín koliduje s jiným záznamem nebo překračuje budget."));
            }
            req.PlannedStart = nextStart;
            req.PlannedEnd = nextEnd;
        }

        var nowUtc = DateTimeOffset.UtcNow;

        if (req.PlannedStart != prevStart || req.PlannedEnd != prevEnd)
        {
            var editorUser = await _context.Users.FindAsync(dto.ManagerId);
            var editorName = editorUser?.DisplayName ?? "Správce";
            bool isFem = editorUser?.IsFemale ?? editorName.Trim().EndsWith("á");
            string verb = isFem ? "změnila z" : "změnil z";
            string prevVal = type?.DurationMode == DurationMode.hours
                ? $"{prevStart.Day}. {prevStart.Month}. ({prevStart:HH:mm} – {prevEnd:HH:mm})"
                : (prevStart.Date == prevEnd.Date ? $"{prevStart.Day}. {prevStart.Month}." : $"{prevStart.Day}. {prevStart.Month}. – {prevEnd.Day}. {prevEnd.Month}.");
            _context.AbsenceEditLogs.Add(new AbsenceEditLog
            {
                Id = Guid.NewGuid(),
                AbsenceRequestId = req.Id,
                EditedByUserId = dto.ManagerId,
                EditedByName = editorName,
                EditedAt = nowUtc,
                Summary = $"{verb} {prevVal}"
            });
        }

        req.Status = AbsenceStatus.completed;
        req.ApprovedBy = dto.ManagerId;
        req.ApprovedAt = nowUtc;
        req.IsRead = false;

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Success(true));
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                    ?? User?.FindFirst("sub")?.Value;
        if (Guid.TryParse(claim, out var parsed)) return parsed;

        if (Request?.Headers != null)
        {
            if (Request.Headers.TryGetValue("X-User-Id", out var userHeader) &&
                Guid.TryParse(userHeader.FirstOrDefault(), out var userGuid))
            {
                return userGuid;
            }

            if (Request.Headers.TryGetValue("X-Dev-User-Id", out var devHeader) &&
                Guid.TryParse(devHeader.FirstOrDefault(), out var devGuid))
            {
                return devGuid;
            }

            if (Request.Headers.TryGetValue("Authorization", out var authHeader) &&
                authHeader.ToString().StartsWith("Bearer "))
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
        }
        return null;
    }

    /// <summary>
    /// Pouze uloží změny termínu/času absence (čekající nebo již schválené) provedené Adminem nebo Officerem a zapíše log úpravy.
    /// </summary>
    [HttpPost("{id}/update")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateRequest([FromRoute] Guid id, [FromBody] UpdateAbsenceRequestDto dto)
    {
        var req = await _context.AbsenceRequests.FindAsync(id);
        if (req == null || req.IsDeleted)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_REQUEST_NOT_FOUND", "Absence nebyla nalezena."));
        }

        var callerId = dto.EditedByUserId ?? dto.EditorUserId ?? GetCurrentUserId() ?? Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var caller = await _context.Users.FindAsync(callerId);
        bool isAdminOrOfficer = caller != null && (caller.Role == UserRole.admin || caller.Role == UserRole.office_manager);
        bool isOwnPending = caller != null && caller.Id == req.UserId && req.Status == AbsenceStatus.pending;
        if (!isAdminOrOfficer && !isOwnPending)
        {
            return StatusCode(403, ApiResponse<bool>.Failure("ERR_FORBIDDEN", "Upravovat absence mohou pouze Administrátor, Office Manager nebo žadatel u své čekající žádosti."));
        }

        var type = await _context.AbsenceTypes.FindAsync(req.AbsenceTypeId);
        var prevStart = req.PlannedStart;
        var prevEnd = req.PlannedEnd;
        var nextStart = req.PlannedStart;
        var nextEnd = req.PlannedEnd;

        if (type != null && type.DurationMode == DurationMode.hours)
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

        if (type != null)
        {
            bool bypassSubmission = isAdminOrOfficer || (nextStart == prevStart && nextEnd == prevEnd);
            var validation = ValidateAbsenceRules(type, ref nextStart, ref nextEnd, isManagedByAuthorizedOther: isAdminOrOfficer, canBypassSubmissionRules: bypassSubmission);
            if (!validation.IsValid)
            {
                return BadRequest(ApiResponse<bool>.Failure(validation.ErrorCode ?? "ERR_VALIDATION", validation.ErrorMessage ?? "Neplatné parametry žádosti."));
            }

            var overlapValidation = await ValidateNoOverlapAsync(req.UserId, type, nextStart, nextEnd, req.Id);
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

        var nowUtc = DateTimeOffset.UtcNow;
        var editorName = !string.IsNullOrWhiteSpace(dto.EditedByUserName) ? dto.EditedByUserName : caller!.DisplayName;
        bool isFem = caller!.IsFemale || editorName.Trim().EndsWith("á");
        string verb = isFem ? "změnila z" : "změnil z";
        string prevVal = type?.DurationMode == DurationMode.hours
            ? $"{prevStart.Day}. {prevStart.Month}. ({prevStart:HH:mm} – {prevEnd:HH:mm})"
            : (prevStart.Date == prevEnd.Date ? $"{prevStart.Day}. {prevStart.Month}." : $"{prevStart.Day}. {prevStart.Month}. – {prevEnd.Day}. {prevEnd.Month}.");

        _context.AbsenceEditLogs.Add(new AbsenceEditLog
        {
            Id = Guid.NewGuid(),
            AbsenceRequestId = req.Id,
            EditedByUserId = caller.Id,
            EditedByName = editorName,
            EditedAt = nowUtc,
            Summary = $"{verb} {prevVal}"
        });

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Success(true));
    }

    /// <summary>
    /// Soft-delete absence (IsDeleted = true) pro Administrátora, Office Managera nebo vlastní čekající žádost (pro Odpadkový koš).
    /// </summary>
    [HttpPost("{id}/delete")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteRequest([FromRoute] Guid id, [FromBody] DeleteRecordRequestDto? dto)
    {
        var req = await _context.AbsenceRequests.FindAsync(id);
        if (req == null || req.IsDeleted)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_REQUEST_NOT_FOUND", "Absence nebyla nalezena."));
        }

        var callerId = dto?.DeletedByUserId ?? GetCurrentUserId() ?? Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var caller = await _context.Users.FindAsync(callerId);
        bool isAdminOrOfficer = caller != null && (caller.Role == UserRole.admin || caller.Role == UserRole.office_manager);
        bool isOwnPending = caller != null && caller.Id == req.UserId && req.Status == AbsenceStatus.pending;
        if (caller == null || (!isAdminOrOfficer && !isOwnPending))
        {
            return StatusCode(403, ApiResponse<bool>.Failure("ERR_FORBIDDEN", "Mazat absence mohou pouze Administrátor, Office Manager nebo žadatel u své čekající žádosti."));
        }

        var nowUtc = DateTimeOffset.UtcNow;
        req.IsDeleted = true;
        req.DeletedAt = nowUtc;
        req.DeletedBy = caller.Id;

        bool isFem = caller.IsFemale || caller.DisplayName.Trim().EndsWith("á");
        _context.AbsenceEditLogs.Add(new AbsenceEditLog
        {
            Id = Guid.NewGuid(),
            AbsenceRequestId = req.Id,
            EditedByUserId = caller.Id,
            EditedByName = caller.DisplayName,
            EditedAt = nowUtc,
            Summary = isFem ? "smazala záznam" : "smazal záznam"
        });

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Success(true));
    }

    /// <summary>
    /// Vrátí všechny smazané absence a žádosti (IsDeleted == true) pro Odpadkový koš (pouze Administrátor a Office Manager).
    /// </summary>
    [HttpGet("deleted")]
    public async Task<ActionResult<ApiResponse<List<AbsenceRequestItemDto>>>> GetDeletedRequests()
    {
        var deletedRequests = await _context.AbsenceRequests
            .Where(r => r.IsDeleted)
            .ToListAsync();

        var types = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var users = await _context.Users.ToDictionaryAsync(u => u.Id, u => u);
        var contractTypes = await _context.ContractTypes.ToDictionaryAsync(c => c.Code, c => c.Name);
        var holidays = await _context.Holidays.ToListAsync();

        var reqIds = deletedRequests.Select(r => r.Id).ToList();
        var editLogsList = (await _context.AbsenceEditLogs
            .Where(l => reqIds.Contains(l.AbsenceRequestId))
            .ToListAsync())
            .OrderByDescending(l => l.EditedAt)
            .ToList();

        var editLogsMap = editLogsList
            .GroupBy(l => l.AbsenceRequestId)
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

        var result = deletedRequests
            .OrderByDescending(r => r.DeletedAt ?? r.CreatedAt ?? r.PlannedStart)
            .Select(r =>
            {
                types.TryGetValue(r.AbsenceTypeId, out var type);
                users.TryGetValue(r.UserId, out var u);
                var isHourly = type?.DurationMode == DurationMode.hours;
                var days = isHourly
                    ? 0
                    : HolidayService.CountWorkingDays(r.PlannedStart.Date, r.PlannedEnd.Date, holidays);

                string? approvedByName = null;
                bool? approvedByIsFemale = null;
                if (r.ApprovedBy.HasValue && users.TryGetValue(r.ApprovedBy.Value, out var approver))
                {
                    approvedByName = approver.DisplayName;
                    approvedByIsFemale = approver.IsFemale;
                }

                return new AbsenceRequestItemDto
                {
                    Id = r.Id.ToString(),
                    ApplicantId = r.UserId.ToString(),
                    UserName = u?.DisplayName ?? "Neznámý uživatel",
                    UserRole = u != null ? UserDisplayHelper.GetRoleLabelCzech(u.Role) : "Kolega",
                    Contract = u?.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
                    ContractType = u?.ContractType.ToString().ToLowerInvariant() ?? "full_time",
                    ContractTypeName = u != null
                        ? UserDisplayHelper.GetContractDisplayLabel(u.ContractKind, u.ContractType, contractTypes)
                        : "Plný úvazek",
                    IsPermanentHomeOffice = u?.IsPermanentHomeOffice ?? false,
                    Type = type?.Code ?? "vacation",
                    TypeName = type?.NameEmployee ?? "Dovolená",
                    StartDate = r.PlannedStart.ToString("yyyy-MM-dd"),
                    EndDate = r.PlannedEnd.ToString("yyyy-MM-dd"),
                    DaysCount = days,
                    StartTime = isHourly ? r.PlannedStart.ToString("HH:mm") : null,
                    EndTime = isHourly ? r.PlannedEnd.ToString("HH:mm") : null,
                    FacilityName = isHourly ? "Lékařská propustka" : null,
                    HasConfirmationDocument = r.VerifiedAt != null,
                    Note = r.Note,
                    RejectionReason = r.RejectionReason,
                    Status = r.Status == AbsenceStatus.completed ? "approved" : r.Status.ToString(),
                    IsRead = r.IsRead,
                    CreatedAt = (r.CreatedAt ?? r.PlannedStart).ToString("O"),
                    ApprovedByName = approvedByName,
                    ApprovedByIsFemale = approvedByIsFemale,
                    ApprovedAt = r.ApprovedAt?.ToString("O"),
                    EditLogs = editLogsMap.TryGetValue(r.Id, out var logs) ? logs : new List<RecordEditLogDto>()
                };
            }).ToList();

        return Ok(ApiResponse<List<AbsenceRequestItemDto>>.Success(result));
    }

    /// <summary>
    /// Obnoví smazanou absenci z Odpadkového koše (IsDeleted = false) pro Administrátora nebo Office Managera.
    /// Před obnovením zkontroluje kolize s jinou aktivní absencí / přítomností a čerpání budgetu.
    /// </summary>
    [HttpPost("{id}/restore")]
    public async Task<ActionResult<ApiResponse<bool>>> RestoreRequest([FromRoute] Guid id, [FromBody] DeleteRecordRequestDto? dto)
    {
        var req = await _context.AbsenceRequests.FindAsync(id);
        if (req == null || !req.IsDeleted)
        {
            return NotFound(ApiResponse<bool>.Failure("ERR_REQUEST_NOT_FOUND", "Smazaná absence nebyla nalezena."));
        }

        var callerId = dto?.DeletedByUserId ?? GetCurrentUserId() ?? Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var caller = await _context.Users.FindAsync(callerId);
        if (caller == null || (caller.Role != UserRole.admin && caller.Role != UserRole.office_manager))
        {
            return StatusCode(403, ApiResponse<bool>.Failure("ERR_FORBIDDEN", "Obnovovat absence z koše mohou pouze role Administrátor a Office Manager."));
        }

        if (req.Status != AbsenceStatus.rejected)
        {
            var type = await _context.AbsenceTypes.FindAsync(req.AbsenceTypeId);
            if (type != null)
            {
                var overlapValidation = await ValidateNoOverlapAsync(req.UserId, type, req.PlannedStart, req.PlannedEnd, req.Id);
                if (!overlapValidation.IsValid)
                {
                    var msg = (overlapValidation.ErrorMessage ?? "Termín koliduje s jiným záznamem.")
                        .Replace("Nelze zadat", "Nelze obnovit")
                        .Replace("Nelze uložit", "Nelze obnovit");
                    return BadRequest(ApiResponse<bool>.Failure(overlapValidation.ErrorCode ?? "ERR_OVERLAP", msg));
                }
            }
        }

        var nowUtc = DateTimeOffset.UtcNow;
        req.IsDeleted = false;
        req.DeletedAt = null;
        req.DeletedBy = null;

        bool isFem = caller.IsFemale || caller.DisplayName.Trim().EndsWith("á");
        _context.AbsenceEditLogs.Add(new AbsenceEditLog
        {
            Id = Guid.NewGuid(),
            AbsenceRequestId = req.Id,
            EditedByUserId = caller.Id,
            EditedByName = caller.DisplayName,
            EditedAt = nowUtc,
            Summary = isFem ? "obnovila záznam" : "obnovil záznam"
        });

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

        var type = await _context.AbsenceTypes.FindAsync(req.AbsenceTypeId);
        if (type != null && type.Code == "illness")
        {
            var approverId = dto.ManagerId != Guid.Empty ? dto.ManagerId : (GetCurrentUserId() ?? Guid.Empty);
            var approver = approverId != Guid.Empty ? await _context.Users.FindAsync(approverId) : null;
            if (approver == null || (approver.Role != UserRole.admin && approver.Role != UserRole.office_manager))
            {
                return StatusCode(403, ApiResponse<bool>.Failure("ERR_FORBIDDEN", "Nemoc může zamítnout pouze Administrátor nebo Office Manager."));
            }
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
        bool isAutoApproved;
        if (effectiveType != null && effectiveType.Code == "illness")
        {
            var actorId = verifiedCallerId ?? dto.ApprovedByUserId ?? GetCurrentUserId() ?? req.UserId;
            var actor = actorId == req.UserId ? user : await _context.Users.FindAsync(actorId);
            isAutoApproved =
                (actor != null && (actor.Role == UserRole.admin || actor.Role == UserRole.office_manager)) ||
                (user != null && (user.Role == UserRole.admin || user.Role == UserRole.office_manager));
        }
        else
        {
            isAutoApproved = !effectiveManagerId.HasValue || canBypassSubmissionRules || isUnlimitedHomeOffice;
        }
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
        var holidays = await _context.Holidays.ToListAsync();

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
                .Where(r => !r.IsDeleted && r.UserId == userId && r.AbsenceTypeId == vacType.Id)
                .ToListAsync();

            var vacRequests = allOldVac
                .Where(r => (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending) &&
                            r.PlannedStart >= fromYearStart && r.PlannedStart <= fromYearEnd)
                .ToList();
            oldVacUsed = vacRequests.Sum(r => HolidayService.CountWorkingDays(r.PlannedStart.Date, r.PlannedEnd.Date, holidays));
        }

        decimal oldSickUsed = 0;
        if (sickType != null)
        {
            var allOldSick = await _context.AbsenceRequests
                .Where(r => !r.IsDeleted && r.UserId == userId && r.AbsenceTypeId == sickType.Id)
                .ToListAsync();

            var sickRequests = allOldSick
                .Where(r => (r.Status == AbsenceStatus.completed || r.Status == AbsenceStatus.pending) &&
                            r.PlannedStart >= fromYearStart && r.PlannedStart <= fromYearEnd)
                .ToList();
            oldSickUsed = sickRequests.Sum(r => HolidayService.CountWorkingDays(r.PlannedStart.Date, r.PlannedEnd.Date, holidays));
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
    /// Vrátí číselník typů úvazků a jejich koeficientů z DB včetně počtu uživatelů na daném úvazku.
    /// </summary>
    [HttpGet("contract-types")]
    public async Task<ActionResult<ApiResponse<List<ContractTypeSettingDto>>>> GetContractTypes()
    {
        var list = (await _context.ContractTypes.ToListAsync()).OrderByDescending(c => c.Coefficient).ToList();
        var activeEmployees = await _context.Users
            .Where(u => u.IsActive && u.ContractKind == ContractKind.employee)
            .ToListAsync();

        return Ok(ApiResponse<List<ContractTypeSettingDto>>.Success(list.Select(c =>
        {
            var codeLower = c.Code.Trim().ToLowerInvariant();
            int count = activeEmployees.Count(u => UserDisplayHelper.GetContractTypeCode(u) == codeLower);
            return new ContractTypeSettingDto
            {
                Id = c.Id,
                Code = c.Code,
                Name = c.Name,
                Coefficient = c.Coefficient,
                UsersCount = count
            };
        }).ToList()));
    }

    /// <summary>
    /// Přidá nový typ úvazku do tabulky contract_types.
    /// </summary>
    [HttpPost("contract-types")]
    public async Task<ActionResult<ApiResponse<List<ContractTypeSettingDto>>>> CreateContractType([FromBody] ContractTypeSettingDto dto)
    {
        var code = (dto.Code ?? string.Empty).Trim().ToLowerInvariant();
        var name = (dto.Name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(ApiResponse<List<ContractTypeSettingDto>>.Failure("ERR_INVALID_INPUT", "Kód a název úvazku jsou povinné."));
        }
        if (dto.Coefficient <= 0 || dto.Coefficient > 2)
        {
            return BadRequest(ApiResponse<List<ContractTypeSettingDto>>.Failure("ERR_INVALID_COEFFICIENT", "Koeficient úvazku musí být větší než 0 a nejvýše 2.0."));
        }

        var exists = await _context.ContractTypes.AnyAsync(c => c.Code.ToLower() == code);
        if (exists)
        {
            return BadRequest(ApiResponse<List<ContractTypeSettingDto>>.Failure("ERR_DUPLICATE_CODE", $"Úvazek s kódem '{code}' již existuje."));
        }

        _context.ContractTypes.Add(new ContractTypeSetting
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name,
            Coefficient = Math.Round(dto.Coefficient, 2)
        });

        await _context.SaveChangesAsync();
        return await GetContractTypes();
    }

    /// <summary>
    /// Upraví existující typ úvazku v tabulce contract_types a přepočítá týdenní fond dotčeným zaměstnancům.
    /// </summary>
    [HttpPut("contract-types/{id}")]
    public async Task<ActionResult<ApiResponse<List<ContractTypeSettingDto>>>> UpdateContractType([FromRoute] Guid id, [FromBody] ContractTypeSettingDto dto)
    {
        var item = await _context.ContractTypes.FindAsync(id);
        if (item == null)
        {
            return NotFound(ApiResponse<List<ContractTypeSettingDto>>.Failure("ERR_NOT_FOUND", "Úvazek nebyl nalezen."));
        }

        var newName = (dto.Name ?? string.Empty).Trim();
        var newCode = string.IsNullOrWhiteSpace(dto.Code) ? item.Code : dto.Code.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(newName))
        {
            return BadRequest(ApiResponse<List<ContractTypeSettingDto>>.Failure("ERR_INVALID_INPUT", "Název úvazku je povinný."));
        }
        if (dto.Coefficient <= 0 || dto.Coefficient > 2)
        {
            return BadRequest(ApiResponse<List<ContractTypeSettingDto>>.Failure("ERR_INVALID_COEFFICIENT", "Koeficient úvazku musí být větší než 0 a nejvýše 2.0."));
        }

        var oldCodeLower = item.Code.Trim().ToLowerInvariant();
        if (!string.Equals(oldCodeLower, newCode, StringComparison.OrdinalIgnoreCase))
        {
            var duplicate = await _context.ContractTypes.AnyAsync(c => c.Id != id && c.Code.ToLower() == newCode);
            if (duplicate)
            {
                return BadRequest(ApiResponse<List<ContractTypeSettingDto>>.Failure("ERR_DUPLICATE_CODE", $"Úvazek s kódem '{newCode}' již existuje."));
            }
        }

        item.Code = newCode;
        item.Name = newName;
        item.Coefficient = Math.Round(dto.Coefficient, 2);

        var cs = await _context.CompanySettings.AsNoTracking().FirstOrDefaultAsync();
        decimal dailyHours = cs?.DailyHours ?? 8.00m;
        int weeklyDays = cs?.WeeklyWorkDays ?? 5;

        var users = await _context.Users
            .Where(u => u.ContractKind == ContractKind.employee)
            .ToListAsync();

        foreach (var u in users.Where(u => UserDisplayHelper.GetContractTypeCode(u) == oldCodeLower))
        {
            u.ContractTypeCode = newCode;
            if (Enum.TryParse<ContractType>(newCode, true, out var parsedEnum))
            {
                u.ContractType = parsedEnum;
            }
            u.WeeklyHoursBudget = Math.Round(dailyHours * weeklyDays * item.Coefficient, 2);
            u.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _context.SaveChangesAsync();
        return await GetContractTypes();
    }

    /// <summary>
    /// Smaže záznam úvazku z tabulky contract_types.
    /// Pokud existuje uživatel s tímto úvazkem, vyžaduje parametr replacementCode pro přesun dotčených osob.
    /// </summary>
    [HttpDelete("contract-types/{id}")]
    public async Task<ActionResult<ApiResponse<List<ContractTypeSettingDto>>>> DeleteContractType([FromRoute] Guid id, [FromQuery] string? replacementCode = null)
    {
        var item = await _context.ContractTypes.FindAsync(id);
        if (item == null)
        {
            return NotFound(ApiResponse<List<ContractTypeSettingDto>>.Failure("ERR_NOT_FOUND", "Úvazek nebyl nalezen."));
        }

        var totalCount = await _context.ContractTypes.CountAsync();
        if (totalCount <= 1)
        {
            return BadRequest(ApiResponse<List<ContractTypeSettingDto>>.Failure("ERR_LAST_CONTRACT_TYPE", "Nelze smazat poslední existující úvazek v systému."));
        }

        var targetCodeLower = item.Code.Trim().ToLowerInvariant();
        var allEmployees = await _context.Users
            .Where(u => u.IsActive && u.ContractKind == ContractKind.employee)
            .ToListAsync();
        var affectedUsers = allEmployees
            .Where(u => UserDisplayHelper.GetContractTypeCode(u) == targetCodeLower)
            .ToList();

        if (affectedUsers.Count > 0)
        {
            if (string.IsNullOrWhiteSpace(replacementCode))
            {
                return BadRequest(ApiResponse<List<ContractTypeSettingDto>>.Failure(
                    "ERR_CONTRACT_IN_USE",
                    $"Tento úvazek využívá {affectedUsers.Count} uživatelů. Vyberte náhradní úvazek, na který budou dotčené osoby převedeny."));
            }

            var replLower = replacementCode.Trim().ToLowerInvariant();
            var replacementCt = await _context.ContractTypes
                .FirstOrDefaultAsync(c => c.Id != id && c.Code.ToLower() == replLower);
            if (replacementCt == null)
            {
                return BadRequest(ApiResponse<List<ContractTypeSettingDto>>.Failure(
                    "ERR_REPLACEMENT_NOT_FOUND",
                    "Zvolený náhradní úvazek nebyl nalezen."));
            }

            var cs = await _context.CompanySettings.AsNoTracking().FirstOrDefaultAsync();
            decimal dailyHours = cs?.DailyHours ?? 8.00m;
            int weeklyDays = cs?.WeeklyWorkDays ?? 5;

            foreach (var u in affectedUsers)
            {
                u.ContractTypeCode = replacementCt.Code;
                if (Enum.TryParse<ContractType>(replacementCt.Code, true, out var parsedEnum))
                {
                    u.ContractType = parsedEnum;
                }
                u.WeeklyHoursBudget = Math.Round(dailyHours * weeklyDays * replacementCt.Coefficient, 2);
                u.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        _context.ContractTypes.Remove(item);
        await _context.SaveChangesAsync();
        return await GetContractTypes();
    }

    /// <summary>
    /// Vrátí seznam všech svátků z tabulky holidays pro správu v Nastavení.
    /// </summary>
    [HttpGet("holidays-config")]
    public async Task<ActionResult<ApiResponse<List<HolidayConfigDto>>>> GetHolidaysConfig()
    {
        var holidays = await _context.Holidays.ToListAsync();
        int currentYear = DateTimeOffset.UtcNow.Year;

        var dtos = holidays.Select(h =>
        {
            var resolved = HolidayService.ResolveHolidayDateForYear(h, currentYear);
            return new
            {
                SortDate = resolved ?? new DateOnly(currentYear, Math.Clamp(h.Month ?? 12, 1, 12), Math.Clamp(h.Day ?? 28, 1, 28)),
                Dto = new HolidayConfigDto
                {
                    Id = h.Id,
                    Name = h.Name,
                    Month = h.Month,
                    Day = h.Day,
                    Rule = h.Rule,
                    PackageCode = h.PackageCode,
                    IsCustomHoliday = h.IsCustomHoliday,
                    IsActive = h.IsActive,
                    ResolvedDateCurrentYear = resolved?.ToString("yyyy-MM-dd")
                }
            };
        })
        .OrderBy(x => x.SortDate)
        .ThenBy(x => x.Dto.Name)
        .Select(x => x.Dto)
        .ToList();

        return Ok(ApiResponse<List<HolidayConfigDto>>.Success(dtos));
    }

    /// <summary>
    /// Přidá nový svátek do tabulky holidays.
    /// </summary>
    [HttpPost("holidays")]
    public async Task<ActionResult<ApiResponse<List<HolidayConfigDto>>>> CreateHoliday([FromBody] HolidayConfigDto dto)
    {
        var name = (dto.Name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(ApiResponse<List<HolidayConfigDto>>.Failure("ERR_INVALID_NAME", "Název svátku je povinný."));
        }

        var rule = string.IsNullOrWhiteSpace(dto.Rule) ? null : dto.Rule.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(rule))
        {
            if (!dto.Month.HasValue || dto.Month < 1 || dto.Month > 12 || !dto.Day.HasValue || dto.Day < 1 || dto.Day > 31)
            {
                return BadRequest(ApiResponse<List<HolidayConfigDto>>.Failure("ERR_INVALID_DATE", "Zadejte platný den a měsíc svátku nebo plovoucí pravidlo (např. EASTER-2, EASTER+1)."));
            }
        }

        _context.Holidays.Add(new Holiday
        {
            Id = Guid.NewGuid(),
            Name = name,
            Month = string.IsNullOrWhiteSpace(rule) ? dto.Month : null,
            Day = string.IsNullOrWhiteSpace(rule) ? dto.Day : null,
            Rule = rule,
            PackageCode = string.IsNullOrWhiteSpace(dto.PackageCode) ? "cz" : dto.PackageCode.Trim(),
            IsCustomHoliday = true,
            IsActive = dto.IsActive
        });

        await _context.SaveChangesAsync();
        return await GetHolidaysConfig();
    }

    /// <summary>
    /// Upraví existující svátek v tabulce holidays.
    /// </summary>
    [HttpPut("holidays/{id}")]
    public async Task<ActionResult<ApiResponse<List<HolidayConfigDto>>>> UpdateHoliday([FromRoute] Guid id, [FromBody] HolidayConfigDto dto)
    {
        var item = await _context.Holidays.FindAsync(id);
        if (item == null)
        {
            return NotFound(ApiResponse<List<HolidayConfigDto>>.Failure("ERR_NOT_FOUND", "Svátek nebyl nalezen."));
        }

        var name = (dto.Name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(ApiResponse<List<HolidayConfigDto>>.Failure("ERR_INVALID_NAME", "Název svátku je povinný."));
        }

        var rule = string.IsNullOrWhiteSpace(dto.Rule) ? null : dto.Rule.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(rule))
        {
            if (!dto.Month.HasValue || dto.Month < 1 || dto.Month > 12 || !dto.Day.HasValue || dto.Day < 1 || dto.Day > 31)
            {
                return BadRequest(ApiResponse<List<HolidayConfigDto>>.Failure("ERR_INVALID_DATE", "Zadejte platný den a měsíc svátku nebo plovoucí pravidlo (např. EASTER-2, EASTER+1)."));
            }
        }

        item.Name = name;
        item.Month = string.IsNullOrWhiteSpace(rule) ? dto.Month : null;
        item.Day = string.IsNullOrWhiteSpace(rule) ? dto.Day : null;
        item.Rule = rule;
        item.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();
        return await GetHolidaysConfig();
    }

    /// <summary>
    /// Smaže svátek z tabulky holidays.
    /// </summary>
    [HttpDelete("holidays/{id}")]
    public async Task<ActionResult<ApiResponse<List<HolidayConfigDto>>>> DeleteHoliday([FromRoute] Guid id)
    {
        var item = await _context.Holidays.FindAsync(id);
        if (item == null)
        {
            return NotFound(ApiResponse<List<HolidayConfigDto>>.Failure("ERR_NOT_FOUND", "Svátek nebyl nalezen."));
        }

        _context.Holidays.Remove(item);
        await _context.SaveChangesAsync();
        return await GetHolidaysConfig();
    }
}
