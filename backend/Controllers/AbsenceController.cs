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

    public static bool CanViewerSeePrivateAbsence(User? viewer, User targetUser, bool targetHasGdprConsent = true)
    {
        if (viewer == null) return false;
        if (viewer.Id == targetUser.Id) return true;
        if (viewer.Role == UserRole.office_manager) return true;
        if (!targetHasGdprConsent) return false;
        if (viewer.Role == UserRole.admin) return true;
        if (viewer.Role == UserRole.team_lead)
        {
            return targetUser.ParentPersonId.HasValue && targetUser.ParentPersonId.Value == viewer.Id;
        }
        if (viewer.Role == UserRole.manager)
        {
            return targetUser.ManagerId.HasValue && targetUser.ManagerId.Value == viewer.Id;
        }
        return false;
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

        var allUserSettingsForUser = await _context.UserAbsenceSettings
            .Where(s => s.UserId == userId)
            .ToListAsync();
        var availableYears = allUserSettingsForUser.Select(s => s.Year).Distinct().OrderBy(y => y).ToList();
        if (!availableYears.Contains(DateTimeOffset.UtcNow.Year))
        {
            availableYears.Add(DateTimeOffset.UtcNow.Year);
            availableYears.Sort();
        }
        if (!availableYears.Contains(targetYear))
        {
            availableYears.Add(targetYear);
            availableYears.Sort();
        }
        bool isYearClosed = userSettings.Any(s => s.IsClosed);

        // Koeficient úvazku osoby
        var effectiveCtCode = UserDisplayHelper.GetContractTypeCode(user);
        var ct = await _context.ContractTypes.FirstOrDefaultAsync(c => c.Code.ToLower() == effectiveCtCode.ToLower());
        decimal contractCoeff = ct?.Coefficient ?? (user.ContractType == ContractType.half_time ? 0.50m : user.ContractType == ContractType.part_time ? 0.25m : 1.00m);

        var nowLocalDate = DateTimeOffset.Now.Date;
        var currentWeekMonday = nowLocalDate.AddDays(-(int)(nowLocalDate.DayOfWeek == DayOfWeek.Sunday ? 6 : nowLocalDate.DayOfWeek - DayOfWeek.Monday));
        var currentWeekSunday = currentWeekMonday.AddDays(6);

        var userHoTimeEntries = await _context.TimeEntries
            .Where(t => !t.IsDeleted && t.UserId == userId && t.LocationType == LocationType.home_office)
            .ToListAsync();
        var hoShiftDatesInYear = userHoTimeEntries
            .Select(t => AttendanceController.GetShiftOriginLocalDate(t))
            .Where(d => d.Year == targetYear)
            .ToHashSet();

        var balancesDict = new Dictionary<string, AbsenceTypeBalanceDto>();
        foreach (var absType in allTypes)
        {
            var setting = userSettings.FirstOrDefault(s => s.AbsenceTypeId == absType.Id);
            var effectivePeriod = setting?.BudgetPeriod ?? absType.DefaultBudgetPeriod;
            var effectiveMaxPerMonth = setting?.MaxPerMonthOverride ?? absType.MaxPerMonthLimit;
            if (absType.IsWorkMode && effectivePeriod == BudgetPeriod.unlimited && effectiveMaxPerMonth.HasValue && effectiveMaxPerMonth.Value > 0 && setting?.AllocatedCapacity == null)
            {
                effectivePeriod = BudgetPeriod.monthly;
            }
            bool hasAllocatedFund = (setting?.AllocatedCapacity != null || absType.DefaultAllowance != null || (effectivePeriod == BudgetPeriod.monthly && effectiveMaxPerMonth != null)) && effectivePeriod != BudgetPeriod.unlimited;

            int usedDays;
            if (absType.DurationMode == DurationMode.hours)
            {
                usedDays = 0;
            }
            else if (absType.IsWorkMode)
            {
                var hoDates = new HashSet<DateTime>(hoShiftDatesInYear);
                foreach (var r in activeYearRequests.Where(r => r.AbsenceTypeId == absType.Id && (hasAllocatedFund || r.Status == AbsenceStatus.completed)))
                {
                    for (var dt = r.PlannedStart.Date; dt <= r.PlannedEnd.Date; dt = dt.AddDays(1))
                    {
                        if (dt.Year == targetYear && HolidayService.CountWorkingDays(dt, dt, holidays) > 0)
                        {
                            hoDates.Add(dt);
                        }
                    }
                }

                if (effectivePeriod == BudgetPeriod.weekly)
                {
                    usedDays = hoDates.Count(d => d >= currentWeekMonday && d <= currentWeekSunday);
                }
                else if (effectivePeriod == BudgetPeriod.monthly)
                {
                    usedDays = hoDates.Count(d => d.Year == targetYear && d.Month == nowLocalDate.Month);
                }
                else
                {
                    usedDays = hoDates.Count(d => d.Year == targetYear);
                }
            }
            else if (effectivePeriod == BudgetPeriod.weekly)
            {
                usedDays = activeYearRequests
                    .Where(r => r.AbsenceTypeId == absType.Id && (hasAllocatedFund || r.Status == AbsenceStatus.completed))
                    .Sum(r =>
                    {
                        var s = r.PlannedStart.Date < currentWeekMonday ? currentWeekMonday : r.PlannedStart.Date;
                        var e = r.PlannedEnd.Date > currentWeekSunday ? currentWeekSunday : r.PlannedEnd.Date;
                        return s <= e ? HolidayService.CountWorkingDays(s, e, holidays) : 0;
                    });
            }
            else if (effectivePeriod == BudgetPeriod.monthly)
            {
                var mStart = new DateTime(targetYear, nowLocalDate.Month, 1);
                var mEnd = new DateTime(targetYear, nowLocalDate.Month, DateTime.DaysInMonth(targetYear, nowLocalDate.Month));
                usedDays = activeYearRequests
                    .Where(r => r.AbsenceTypeId == absType.Id && (hasAllocatedFund || r.Status == AbsenceStatus.completed))
                    .Sum(r =>
                    {
                        var s = r.PlannedStart.Date < mStart ? mStart : r.PlannedStart.Date;
                        var e = r.PlannedEnd.Date > mEnd ? mEnd : r.PlannedEnd.Date;
                        return s <= e ? HolidayService.CountWorkingDays(s, e, holidays) : 0;
                    });
            }
            else
            {
                usedDays = activeYearRequests
                    .Where(r => r.AbsenceTypeId == absType.Id &&
                                (hasAllocatedFund || r.Status == AbsenceStatus.completed))
                    .Sum(r => HolidayService.CountWorkingDays(r.PlannedStart.Date, r.PlannedEnd.Date, holidays));
            }

            int baseCap;
            int carried = 0;
            if (setting?.AllocatedCapacity != null)
            {
                baseCap = (int)setting.AllocatedCapacity.Value;
                carried = absType.AllowCarryOver ? (int)setting.CarriedOverDays : 0;
            }
            else if (absType.IsWorkMode && effectivePeriod == BudgetPeriod.monthly && effectiveMaxPerMonth.HasValue)
            {
                baseCap = effectiveMaxPerMonth.Value;
                carried = 0;
            }
            else if (user.ContractKind == ContractKind.osvc && !absType.AllowOsvc)
            {
                baseCap = 0;
                carried = 0;
            }
            else
            {
                // Čistý fallback z DB DefaultAllowance a příznaku ProrateByContract
                decimal def = absType.DefaultAllowance ?? 0m;
                decimal effCoeff = (!absType.ProrateByContract || user.ContractKind == ContractKind.osvc) ? 1.00m : contractCoeff;
                if (user.EmploymentStartDate.HasValue && user.EmploymentStartDate.Value.Year > targetYear)
                {
                    baseCap = 0;
                }
                else if (absType.ProrateByContract && user.EmploymentStartDate.HasValue && user.EmploymentStartDate.Value.Year == targetYear && absType.DefaultBudgetPeriod == BudgetPeriod.yearly)
                {
                    int startMonth = user.EmploymentStartDate.Value.Month;
                    int monthsInYear = Math.Max(1, 12 - startMonth + 1);
                    baseCap = (int)Math.Round((def * effCoeff * monthsInYear) / 12.0m, 0, MidpointRounding.AwayFromZero);
                }
                else
                {
                    baseCap = (int)Math.Round(def * effCoeff, 0, MidpointRounding.AwayFromZero);
                }
                carried = 0;
            }

            int totalCap = baseCap + carried;
            int remaining = Math.Max(0, totalCap - usedDays);

            balancesDict[absType.Code] = new AbsenceTypeBalanceDto
            {
                Code = absType.Code,
                BudgetPeriod = effectivePeriod.ToString().ToLowerInvariant(),
                Base = baseCap,
                CarriedOver = carried,
                Total = totalCap,
                Used = usedDays,
                Remaining = remaining,
                MaxPerMonth = effectiveMaxPerMonth
            };
        }

        var vacSetting = allTypes.FirstOrDefault(t => t.Code == "vacation") is { } vt
            ? userSettings.FirstOrDefault(s => s.AbsenceTypeId == vt.Id)
            : null;
        var sickSetting = allTypes.FirstOrDefault(t => t.Code == "sick_day") is { } st
            ? userSettings.FirstOrDefault(s => s.AbsenceTypeId == st.Id)
            : null;
        var hoTypeObj = allTypes.FirstOrDefault(t => t.Code == "home_office");
        var hoSetting = hoTypeObj != null
            ? userSettings.FirstOrDefault(s => s.AbsenceTypeId == hoTypeObj.Id)
            : null;

        string hoPeriod = "unlimited";
        decimal? hoLimit = null;
        if (hoSetting != null)
        {
            if (hoSetting.AllocatedCapacity == 0)
            {
                hoPeriod = "disabled";
                hoLimit = 0;
            }
            else if (hoSetting.BudgetPeriod == BudgetPeriod.weekly)
            {
                hoPeriod = "weekly";
                hoLimit = hoSetting.AllocatedCapacity;
            }
            else if (hoSetting.BudgetPeriod == BudgetPeriod.monthly)
            {
                hoPeriod = "monthly";
                hoLimit = hoSetting.AllocatedCapacity ?? hoSetting.MaxPerMonthOverride ?? hoTypeObj?.MaxPerMonthLimit;
            }
            else if (hoSetting.BudgetPeriod == BudgetPeriod.yearly)
            {
                hoPeriod = "yearly";
                hoLimit = hoSetting.AllocatedCapacity;
            }
            else if ((hoSetting.MaxPerMonthOverride ?? hoTypeObj?.MaxPerMonthLimit) is int mLim && mLim > 0)
            {
                hoPeriod = "monthly";
                hoLimit = mLim;
            }
            else
            {
                hoPeriod = "unlimited";
                hoLimit = null;
            }
        }
        else if (hoTypeObj != null)
        {
            if (hoTypeObj.DefaultAllowance == 0 && hoTypeObj.DefaultBudgetPeriod != BudgetPeriod.unlimited)
            {
                hoPeriod = "disabled";
                hoLimit = 0;
            }
            else if (hoTypeObj.DefaultBudgetPeriod == BudgetPeriod.weekly && hoTypeObj.DefaultAllowance.HasValue)
            {
                hoPeriod = "weekly";
                hoLimit = hoTypeObj.DefaultAllowance;
            }
            else if (hoTypeObj.DefaultBudgetPeriod == BudgetPeriod.monthly && (hoTypeObj.DefaultAllowance.HasValue || hoTypeObj.MaxPerMonthLimit.HasValue))
            {
                hoPeriod = "monthly";
                hoLimit = hoTypeObj.DefaultAllowance ?? hoTypeObj.MaxPerMonthLimit;
            }
            else if (hoTypeObj.DefaultBudgetPeriod == BudgetPeriod.yearly && hoTypeObj.DefaultAllowance.HasValue)
            {
                hoPeriod = "yearly";
                hoLimit = hoTypeObj.DefaultAllowance;
            }
            else if (hoTypeObj.MaxPerMonthLimit.HasValue && hoTypeObj.MaxPerMonthLimit.Value > 0)
            {
                hoPeriod = "monthly";
                hoLimit = hoTypeObj.MaxPerMonthLimit.Value;
            }
        }

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
            IsClosed = isYearClosed,
            AvailableYears = availableYears,
            VacationBase = vacBal?.Base,
            VacationCarriedOver = vacBal?.CarriedOver,
            VacationTotal = vacBal?.Total,
            VacationRemaining = vacBal?.Remaining,
            SickDaysTotal = sickBal?.Total,
            SickDaysRemaining = sickBal?.Remaining,
            HomeOfficeWeeklyDays = hoBal?.Base,
            HomeOfficePeriod = hoPeriod,
            HomeOfficeDaysLimit = hoLimit,
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
    public async Task<ActionResult<ApiResponse<List<AbsenceRequestItemDto>>>> GetMyRequests([FromQuery] Guid userId, [FromQuery] bool includeDeleted = false)
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

        // Automatická oprava chybně samo-schválených žádostí u osob s přiřazeným manažerem (vzniklých při testovací deaktivaci manažera Davida Sýkory)
        var sykoraId = Guid.Parse("77777777-7777-7777-7777-777777777777");
        var selfApprovedToFix = await _context.AbsenceRequests
            .Where(r => !r.IsDeleted && r.Status == AbsenceStatus.completed && r.ApprovedBy == r.UserId)
            .ToListAsync();
        if (selfApprovedToFix.Count > 0)
        {
            var hoTypeForFix = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "home_office");
            bool fixedAny = false;
            foreach (var sr in selfApprovedToFix)
            {
                if (hoTypeForFix != null && sr.AbsenceTypeId == hoTypeForFix.Id && (hoTypeForFix.ApproverRole ?? "manager") == "manager")
                {
                    var uFix = await _context.Users.FindAsync(sr.UserId);
                    if (uFix != null && !uFix.IsPermanentHomeOffice && uFix.ManagerId.HasValue)
                    {
                        sr.Status = AbsenceStatus.pending;
                        sr.ApprovedBy = null;
                        sr.ApprovedAt = null;
                        fixedAny = true;

                        if (uFix.ManagerId.Value == sykoraId)
                        {
                            var sykora = await _context.Users.FindAsync(sykoraId);
                            if (sykora != null && !sykora.IsActive)
                            {
                                sykora.IsActive = true;
                            }
                        }
                    }
                }
            }
            if (fixedAny)
            {
                await _context.SaveChangesAsync();
            }
        }

        var allUsers = await _context.Users.ToDictionaryAsync(u => u.Id, u => u);
        var types = await _context.AbsenceTypes.ToDictionaryAsync(t => t.Id, t => t);
        var contractTypes = await _context.ContractTypes.ToDictionaryAsync(c => c.Code, c => c.Name);
        var holidays = await _context.Holidays.ToListAsync();

        var rawRequests = await _context.AbsenceRequests
            .Where(r => r.UserId == userId && (includeDeleted || !r.IsDeleted))
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
        var userCtCode = UserDisplayHelper.GetContractTypeCode(user);
        var userCtSetting = await _context.ContractTypes.FirstOrDefaultAsync(c => c.Code.ToLower() == userCtCode.ToLower());
        decimal userContractCoeff = userCtSetting?.Coefficient ?? (user.ContractType == ContractType.half_time ? 0.50m : user.ContractType == ContractType.part_time ? 0.25m : 1.00m);

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
                    int carryDays = type.AllowCarryOver ? (int)setting.CarriedOverDays : 0;
                    totalDays = (int)setting.AllocatedCapacity.Value + carryDays;
                }
                else if (!(user.ContractKind == ContractKind.osvc && !type.AllowOsvc))
                {
                    decimal def = type.DefaultAllowance ?? 0m;
                    decimal effCoeff = (!type.ProrateByContract || user.ContractKind == ContractKind.osvc) ? 1.00m : userContractCoeff;
                    if (user.EmploymentStartDate.HasValue && user.EmploymentStartDate.Value.Year > reqYear)
                    {
                        totalDays = 0;
                    }
                    else if (type.ProrateByContract && user.EmploymentStartDate.HasValue && user.EmploymentStartDate.Value.Year == reqYear && type.DefaultBudgetPeriod == BudgetPeriod.yearly)
                    {
                        int monthsInYear = Math.Max(1, 12 - user.EmploymentStartDate.Value.Month + 1);
                        totalDays = (int)Math.Round((def * effCoeff * monthsInYear) / 12.0m, 0, MidpointRounding.AwayFromZero);
                    }
                    else
                    {
                        totalDays = (int)Math.Round(def * effCoeff, 0, MidpointRounding.AwayFromZero);
                    }
                }

                if (totalDays > 0)
                {
                    int usedDays = rawRequests
                        .Where(ar => !ar.IsDeleted &&
                                     ar.AbsenceTypeId == r.AbsenceTypeId &&
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
                var resolverId = r.ApprovedBy ?? effectiveManagerId;
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
                approvedAtStr = (r.ApprovedAt ?? r.CreatedAt ?? r.PlannedStart).ToString("O");
            }

            return new AbsenceRequestItemDto
            {
                Id = r.Id.ToString(),
                ApplicantId = r.UserId.ToString(),
                UserName = user.DisplayName,
                UserRole = UserDisplayHelper.GetRoleLabelCzech(user.Role),
                Contract = user.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
                ContractType = UserDisplayHelper.GetContractTypeCode(user),
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
                IsDeleted = r.IsDeleted,
                DeletedAt = r.DeletedAt?.ToString("O"),
                DeletedBy = r.DeletedBy?.ToString(),
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
        IEnumerable<AbsenceRequest> filtered = allRequests.Where(r => r.UserId != managerId);

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
        // Office Manager & Admin see all people (except themselves, filtered above)

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
        var contractTypesList = await _context.ContractTypes.ToListAsync();
        var contractTypes = contractTypesList.ToDictionary(c => c.Code, c => c.Name);
        var contractCoeffs = contractTypesList.ToDictionary(c => c.Code.ToLower(), c => c.Coefficient);
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
                    int carryDays = type.AllowCarryOver ? (int)setting.CarriedOverDays : 0;
                    totalDays = (int)setting.AllocatedCapacity.Value + carryDays;
                }
                else if (applicant != null && !(applicant.ContractKind == ContractKind.osvc && !type.AllowOsvc))
                {
                    var appCtCode = UserDisplayHelper.GetContractTypeCode(applicant).ToLower();
                    decimal appCoeff = contractCoeffs.TryGetValue(appCtCode, out var cVal)
                        ? cVal
                        : (applicant.ContractType == ContractType.half_time ? 0.50m : applicant.ContractType == ContractType.part_time ? 0.25m : 1.00m);
                    decimal def = type.DefaultAllowance ?? 0m;
                    decimal effCoeff = (!type.ProrateByContract || applicant.ContractKind == ContractKind.osvc) ? 1.00m : appCoeff;
                    if (applicant.EmploymentStartDate.HasValue && applicant.EmploymentStartDate.Value.Year > reqYear)
                    {
                        totalDays = 0;
                    }
                    else if (type.ProrateByContract && applicant.EmploymentStartDate.HasValue && applicant.EmploymentStartDate.Value.Year == reqYear && type.DefaultBudgetPeriod == BudgetPeriod.yearly)
                    {
                        int monthsInYear = Math.Max(1, 12 - applicant.EmploymentStartDate.Value.Month + 1);
                        totalDays = (int)Math.Round((def * effCoeff * monthsInYear) / 12.0m, 0, MidpointRounding.AwayFromZero);
                    }
                    else
                    {
                        totalDays = (int)Math.Round(def * effCoeff, 0, MidpointRounding.AwayFromZero);
                    }
                }

                if (totalDays > 0)
                {
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
                var resolverId = r.ApprovedBy ?? effectiveMgrId;
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
                approvedAtStr = (r.ApprovedAt ?? r.CreatedAt ?? r.PlannedStart).ToString("O");
            }

            var cKind = applicant?.ContractKind ?? ContractKind.employee;
            var cCode = applicant != null ? UserDisplayHelper.GetContractTypeCode(applicant) : "full_time";

            return new AbsenceRequestItemDto
            {
                Id = r.Id.ToString(),
                ApplicantId = r.UserId.ToString(),
                UserName = applicant?.DisplayName ?? "Neznámý uživatel",
                UserRole = UserDisplayHelper.GetRoleLabelCzech(applicant?.Role ?? UserRole.colleague),
                Contract = cKind == ContractKind.osvc ? "OSVČ" : "HPP",
                ContractType = cCode.ToLowerInvariant(),
                ContractTypeName = UserDisplayHelper.GetContractDisplayLabel(cKind, cCode, contractTypes),
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
                IsDeleted = r.IsDeleted,
                DeletedAt = r.DeletedAt?.ToString("O"),
                DeletedBy = r.DeletedBy?.ToString(),
                EditLogs = editLogsByReq.TryGetValue(r.Id, out var logs) ? logs : new List<RecordEditLogDto>()
            };
        }).ToList();

        return Ok(ApiResponse<List<AbsenceRequestItemDto>>.Success(result));
    }

    private async Task EnsureAbsenceTypesIsPrivateColumnAsync()
    {
        try
        {
            var conn = _context.Database.GetDbConnection();
            bool wasClosed = conn.State != System.Data.ConnectionState.Open;
            if (wasClosed) await conn.OpenAsync();
            try
            {
                var cols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(absence_types);";
                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        cols.Add(reader.GetString(1));
                    }
                }
                if (cols.Count == 0) return;

                if (!cols.Contains("IsPrivate"))
                {
                    using var alterCmd = conn.CreateCommand();
                    alterCmd.CommandText = "ALTER TABLE absence_types ADD COLUMN IsPrivate INTEGER NOT NULL DEFAULT 0;";
                    await alterCmd.ExecuteNonQueryAsync();
                }
                if (!cols.Contains("IsPaid"))
                {
                    using var alterCmd = conn.CreateCommand();
                    alterCmd.CommandText = "ALTER TABLE absence_types ADD COLUMN IsPaid INTEGER NOT NULL DEFAULT 1; UPDATE absence_types SET IsPaid = CASE WHEN Code = 'unpaid_leave' THEN 0 ELSE 1 END;";
                    await alterCmd.ExecuteNonQueryAsync();
                }
                if (!cols.Contains("IsWorkMode"))
                {
                    using var alterCmd = conn.CreateCommand();
                    alterCmd.CommandText = "ALTER TABLE absence_types ADD COLUMN IsWorkMode INTEGER NOT NULL DEFAULT 0; UPDATE absence_types SET IsWorkMode = CASE WHEN Code = 'home_office' THEN 1 ELSE 0 END;";
                    await alterCmd.ExecuteNonQueryAsync();
                }
                if (!cols.Contains("AllowCarryOver"))
                {
                    using var alterCmd = conn.CreateCommand();
                    alterCmd.CommandText = "ALTER TABLE absence_types ADD COLUMN AllowCarryOver INTEGER NOT NULL DEFAULT 0; UPDATE absence_types SET AllowCarryOver = CASE WHEN Code = 'vacation' THEN 1 ELSE 0 END;";
                    await alterCmd.ExecuteNonQueryAsync();
                }
                if (!cols.Contains("ProrateByContract"))
                {
                    using var alterCmd = conn.CreateCommand();
                    alterCmd.CommandText = "ALTER TABLE absence_types ADD COLUMN ProrateByContract INTEGER NOT NULL DEFAULT 0; UPDATE absence_types SET ProrateByContract = CASE WHEN Code = 'vacation' THEN 1 ELSE 0 END;";
                    await alterCmd.ExecuteNonQueryAsync();
                }
                if (!cols.Contains("SwitchToUnpaidOnExhausted"))
                {
                    using var alterCmd = conn.CreateCommand();
                    alterCmd.CommandText = "ALTER TABLE absence_types ADD COLUMN SwitchToUnpaidOnExhausted INTEGER NOT NULL DEFAULT 0; UPDATE absence_types SET SwitchToUnpaidOnExhausted = CASE WHEN Code = 'vacation' THEN 1 ELSE 0 END;";
                    await alterCmd.ExecuteNonQueryAsync();
                }
                if (!cols.Contains("InfoText"))
                {
                    using var alterCmd = conn.CreateCommand();
                    alterCmd.CommandText = @"
                        ALTER TABLE absence_types ADD COLUMN InfoText TEXT NULL;
                        UPDATE absence_types SET InfoText = 'Zákonná překážka v práci s náhradou mzdy (§ 199 ZP)' || char(10) || 'Lékařská návštěva nekrátí fond dovolené. Po návratu doložíte razítko propustky.' WHERE Code = 'doctor' AND InfoText IS NULL;
                        UPDATE absence_types SET InfoText = 'Dočasná pracovní neschopnost (nemocenská / eNeschopenka)' || char(10) || 'Absence z důvodu nemoci nečerpá zůstatek dovolené ani sick days. Číslo rozhodnutí o DPN můžete uvést do poznámky níže.' WHERE Code = 'illness' AND InfoText IS NULL;";
                    await alterCmd.ExecuteNonQueryAsync();
                }

                using (var seedOcrCmd = conn.CreateCommand())
                {
                    seedOcrCmd.CommandText = @"
                        INSERT INTO absence_types (
                            Id, Code, NameEmployee, AllowOsvc, DurationMode,
                            SubmissionOffsetDays, SubmissionDeadlineTime, MaxPerMonthLimit, DefaultBudgetPeriod, DefaultAllowance,
                            IsActive, Icon, Color, ApproverRole, IsSystem, IsPrivate,
                            IsPaid, IsWorkMode, AllowCarryOver, ProrateByContract, SwitchToUnpaidOnExhausted, InfoText
                        )
                        SELECT
                            upper(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
                            'ocr', 'OČR', 0, 0,
                            0, NULL, NULL, 3, NULL,
                            1, 'Baby', 'orange', 'office_manager', 1, 1,
                            1, 0, 0, 0, 0,
                            'Ošetřování člena rodiny (ošetřovné dle zákona č. 187/2006 Sb.)' || char(10) || 'Absence z důvodu OČR nečerpá zůstatek dovolené ani sick days. Číslo rozhodnutí o potřebě ošetřování můžete uvést do poznámky níže.'
                        WHERE NOT EXISTS (SELECT 1 FROM absence_types WHERE lower(Code) = 'ocr');
                        UPDATE absence_types SET Id = upper(Id) WHERE Id != upper(Id);
                        UPDATE absence_types SET DurationMode = 0 WHERE DurationMode = 'days';
                        UPDATE absence_types SET DurationMode = 1 WHERE DurationMode = 'hours';
                        UPDATE absence_types SET DurationMode = 2 WHERE DurationMode = 'single_day';
                        UPDATE absence_types SET DefaultBudgetPeriod = 0 WHERE DefaultBudgetPeriod = 'weekly';
                        UPDATE absence_types SET DefaultBudgetPeriod = 1 WHERE DefaultBudgetPeriod IN ('yearly', 'annual');
                        UPDATE absence_types SET DefaultBudgetPeriod = 3 WHERE DefaultBudgetPeriod = 'unlimited';
                        UPDATE absence_types SET DefaultBudgetPeriod = 4 WHERE DefaultBudgetPeriod = 'monthly';
                        UPDATE absence_types SET DefaultBudgetPeriod = 3 WHERE lower(Code) = 'ocr' AND DefaultBudgetPeriod = 0 AND DefaultAllowance IS NULL;";
                    await seedOcrCmd.ExecuteNonQueryAsync();
                }
            }
            finally
            {
                if (wasClosed) await conn.CloseAsync();
            }
        }
        catch { }
    }

    /// <summary>
    /// Vrátí konfiguraci typů absencí z DB (DurationMode: days/hours/single_day, SubmissionOffsetDays, SubmissionDeadlineTime, AllowOsvc, Icon, Color, IsSystem, IsPaid, IsWorkMode, AllowCarryOver, ProrateByContract, SwitchToUnpaidOnExhausted, InfoText).
    /// </summary>
    [HttpGet("types")]
    public async Task<ActionResult<ApiResponse<List<AbsenceTypeConfigDto>>>> GetAbsenceTypes()
    {
        await EnsureAbsenceTypesIsPrivateColumnAsync();
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
            ApproverRole = t.ApproverRole,
            IsSystem = t.IsSystem || new[] { "vacation", "doctor", "sick_day", "home_office", "unpaid_leave", "illness", "ocr" }.Contains(t.Code),
            IsPrivate = t.IsPrivate,
            IsPaid = t.IsPaid,
            IsWorkMode = t.IsWorkMode,
            AllowCarryOver = t.AllowCarryOver,
            ProrateByContract = t.ProrateByContract,
            SwitchToUnpaidOnExhausted = t.SwitchToUnpaidOnExhausted,
            InfoText = t.InfoText
        }).ToList();

        return Ok(ApiResponse<List<AbsenceTypeConfigDto>>.Success(result));
    }

    /// <summary>
    /// Uloží konfiguraci typů absencí v číselníku absence_types (včetně DefaultAllowance, Icon, Color, ApproverRole a případných nově přidaných typů).
    /// </summary>
    [HttpPost("types")]
    public async Task<ActionResult<ApiResponse<List<AbsenceTypeConfigDto>>>> UpdateAbsenceTypes([FromBody] List<AbsenceTypeConfigDto> items)
    {
        if (items == null || items.Count == 0)
        {
            return BadRequest(ApiResponse<List<AbsenceTypeConfigDto>>.Failure("ERR_EMPTY_PAYLOAD", "Seznam typů absencí je prázdný."));
        }

        await EnsureAbsenceTypesIsPrivateColumnAsync();
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
            string? approverRole = string.IsNullOrWhiteSpace(dto.ApproverRole) ? null : dto.ApproverRole.Trim().ToLowerInvariant();

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
                    ApproverRole = approverRole,
                    IsSystem = false,
                    IsPrivate = dto.IsPrivate,
                    IsPaid = dto.IsPaid,
                    IsWorkMode = dto.IsWorkMode,
                    AllowCarryOver = dto.AllowCarryOver,
                    ProrateByContract = dto.ProrateByContract,
                    SwitchToUnpaidOnExhausted = dto.SwitchToUnpaidOnExhausted,
                    InfoText = string.IsNullOrWhiteSpace(dto.InfoText) ? null : dto.InfoText.Trim()
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
                existing.ApproverRole = approverRole;
                existing.IsPrivate = dto.IsPrivate;
                existing.IsPaid = dto.IsPaid;
                existing.IsWorkMode = dto.IsWorkMode;
                existing.AllowCarryOver = dto.AllowCarryOver;
                existing.ProrateByContract = dto.ProrateByContract;
                existing.SwitchToUnpaidOnExhausted = dto.SwitchToUnpaidOnExhausted;
                existing.InfoText = string.IsNullOrWhiteSpace(dto.InfoText) ? null : dto.InfoText.Trim();
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

        var builtInCodes = new[] { "vacation", "doctor", "sick_day", "home_office", "unpaid_leave", "illness", "ocr" };
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
        var callerId = GetCurrentUserId();
        User? viewerUser = callerId.HasValue && allUsersIncludeInactive.TryGetValue(callerId.Value, out var vu) ? vu : null;
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
            .OrderBy(r => r.PlannedStart.Date)
            .ThenBy(r => r.PlannedEnd.Date)
            .ThenBy(r => r.PlannedStart.TimeOfDay)
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

        await GdprController.EnsureGdprTablesAsync(_context);
        var gdprDocs = await _context.GdprDocuments.ToListAsync();
        var gdprSends = await _context.GdprSends.ToListAsync();
        var activeGdpr = GdprHelper.GetActiveDocument(gdprDocs, todayLocal.ToString("yyyy-MM-dd"));

        var result = matching.Select(r =>
        {
            var u = allUsers[r.UserId];
            var type = types.TryGetValue(r.AbsenceTypeId, out var t) ? t : null;
            var userGdprStatus = GdprHelper.ResolveUserStatus(u.Id, activeGdpr?.Id, gdprSends);
            bool isOwnAbsence = viewerUser != null && r.UserId == viewerUser.Id;
            bool isColleagueOtherAbsence = (viewerUser == null || viewerUser.Role == UserRole.colleague) && !isOwnAbsence;
            bool isMaskedPrivate = type != null && type.IsPrivate && !CanViewerSeePrivateAbsence(viewerUser, u, userGdprStatus == "granted");
            bool restrictToPreDetailFields = isColleagueOtherAbsence || isMaskedPrivate;

            var typeCode = isMaskedPrivate ? "unavailable" : (type?.Code ?? "vacation");
            var typeName = isMaskedPrivate ? "Nedostupný" : (type?.NameEmployee ?? "Dovolená");
            bool isHourly = type?.DurationMode == DurationMode.hours;
            int days = isHourly ? 0 : HolidayService.CountWorkingDays(r.PlannedStart.Date, r.PlannedEnd.Date, holidays);

            if (restrictToPreDetailFields)
            {
                return new AbsenceRequestItemDto
                {
                    Id = r.Id.ToString(),
                    ApplicantId = r.UserId.ToString(),
                    UserName = u.DisplayName,
                    UserRole = null,
                    Contract = null,
                    ContractType = null,
                    ContractTypeName = null,
                    IsPermanentHomeOffice = u.IsPermanentHomeOffice,
                    ManagerId = null,
                    ManagerName = null,
                    ParentPersonId = null,
                    ParentPersonName = null,
                    Type = typeCode,
                    TypeName = typeName,
                    StartDate = r.PlannedStart.ToString("yyyy-MM-dd"),
                    EndDate = r.PlannedEnd.ToString("yyyy-MM-dd"),
                    DaysCount = days,
                    StartTime = isHourly ? r.PlannedStart.ToString("HH:mm") : null,
                    EndTime = isHourly ? r.PlannedEnd.ToString("HH:mm") : null,
                    Note = null,
                    Status = "approved",
                    IsRead = r.IsRead,
                    CreatedAt = null,
                    ApprovedByName = null,
                    ApprovedByIsFemale = null,
                    ApprovedAt = null,
                    RemainingDays = 0,
                    TotalDays = 0,
                    EditLogs = new List<RecordEditLogDto>()
                };
            }

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

            var cCode = UserDisplayHelper.GetContractTypeCode(u);

            return new AbsenceRequestItemDto
            {
                Id = r.Id.ToString(),
                ApplicantId = r.UserId.ToString(),
                UserName = u.DisplayName,
                UserRole = UserDisplayHelper.GetRoleLabelCzech(u.Role),
                Contract = u.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
                ContractType = cCode.ToLowerInvariant(),
                ContractTypeName = UserDisplayHelper.GetContractDisplayLabel(u.ContractKind, cCode, contractTypes),
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

                // Výjimka: Režim práce (např. Home Office) nekoliduje s hodinovou absencí (např. návštěva lékaře)
                if ((type.IsWorkMode && exType?.DurationMode == DurationMode.hours) ||
                    (exType?.IsWorkMode == true && type.DurationMode == DurationMode.hours))
                {
                    continue;
                }

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
        // Výjimka: u režimu práce (např. Home Office) zaměstnanec normálně eviduje odpracovanou směnu (TimeEntry), takže přítomnost není v kolizi
        if (!type.IsWorkMode)
        {
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
        }

        // 3. Kontrola pracovních dnů (mimo víkendy a svátky) a ročního/týdenního/měsíčního budgetu pro denní absence
        if (type.DurationMode != DurationMode.hours)
        {
            var holidays = await _context.Holidays.ToListAsync();
            int workingDays = HolidayService.CountWorkingDays(start.Date, end.Date, holidays);
            if (workingDays <= 0)
            {
                return (false, "ERR_NO_WORKING_DAYS", "Zvolený termín připadá pouze na víkend nebo státní svátek (0 pracovních dnů).");
            }

            var user = await _context.Users.FindAsync(userId);
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

            if (type.IsWorkMode)
            {
                if (setting?.AllocatedCapacity == 0)
                {
                    return (false, "ERR_HOME_OFFICE_DISABLED", $"{type.NameEmployee} není pro tento účet povolen.");
                }
                if (user?.IsPermanentHomeOffice == true)
                {
                    return (true, null, null);
                }
            }

            // 3a. Kontrola měsíčního limitu (MaxPerMonthOverride ?? MaxPerMonthLimit)
            int? effectiveMaxPerMonth = setting?.MaxPerMonthOverride ?? type.MaxPerMonthLimit;
            if (effectiveMaxPerMonth.HasValue && effectiveMaxPerMonth.Value > 0)
            {
                int maxMonthAllowed = effectiveMaxPerMonth.Value;
                var curMonthStart = new DateTime(start.Date.Year, start.Date.Month, 1);
                var lastMonthStart = new DateTime(end.Date.Year, end.Date.Month, 1);

                while (curMonthStart <= lastMonthStart)
                {
                    var curMonthEnd = curMonthStart.AddMonths(1).AddDays(-1);
                    var reqMonthStart = start.Date > curMonthStart ? start.Date : curMonthStart;
                    var reqMonthEnd = end.Date < curMonthEnd ? end.Date : curMonthEnd;
                    int reqDaysInMonth = HolidayService.CountWorkingDays(reqMonthStart, reqMonthEnd, holidays);

                    int usedInMonth = 0;
                    foreach (var r in userAbsences)
                    {
                        if (excludeRequestId.HasValue && r.Id == excludeRequestId.Value)
                            continue;
                        if (r.AbsenceTypeId == type.Id)
                        {
                            var rStart = r.PlannedStart.Date;
                            var rEnd = r.PlannedEnd.Date;
                            if (rStart <= curMonthEnd && rEnd >= curMonthStart)
                            {
                                var rMonthStart = rStart > curMonthStart ? rStart : curMonthStart;
                                var rMonthEnd = rEnd < curMonthEnd ? rEnd : curMonthEnd;
                                usedInMonth += HolidayService.CountWorkingDays(rMonthStart, rMonthEnd, holidays);
                            }
                        }
                    }

                    if (reqDaysInMonth + usedInMonth > maxMonthAllowed)
                    {
                        int availableInMonth = Math.Max(0, maxMonthAllowed - usedInMonth);
                        return (false, "ERR_MONTHLY_LIMIT_EXCEEDED", $"Nelze uložit absenci '{type.NameEmployee}': v měsíci {curMonthStart:MM/yyyy} je požadováno {reqDaysInMonth} prac. dnů, ale v měsíčním limitu ({maxMonthAllowed}) zbývá pouze {availableInMonth} dnů.");
                    }

                    curMonthStart = curMonthStart.AddMonths(1);
                }
            }

            var effectivePeriod = setting?.BudgetPeriod ?? type.DefaultBudgetPeriod;
            decimal? rawCap = setting?.AllocatedCapacity ?? (type.DefaultBudgetPeriod != BudgetPeriod.unlimited ? type.DefaultAllowance : null);

            if ((setting == null || setting.AllocatedCapacity == null) && user != null && effectivePeriod != BudgetPeriod.unlimited)
            {
                if (user.ContractKind == ContractKind.osvc && !type.AllowOsvc)
                {
                    rawCap = 0m;
                }
                else
                {
                    decimal def = type.DefaultAllowance ?? 0m;
                    var effectiveCtCode = UserDisplayHelper.GetContractTypeCode(user);
                    var ct = await _context.ContractTypes.FirstOrDefaultAsync(c => c.Code.ToLower() == effectiveCtCode.ToLower());
                    decimal contractCoeff = ct?.Coefficient ?? (user.ContractType == ContractType.half_time ? 0.50m : user.ContractType == ContractType.part_time ? 0.25m : 1.00m);
                    decimal effCoeff = (!type.ProrateByContract || user.ContractKind == ContractKind.osvc) ? 1.00m : contractCoeff;

                    if (user.EmploymentStartDate.HasValue && user.EmploymentStartDate.Value.Year > start.Year)
                    {
                        rawCap = 0m;
                    }
                    else if (type.ProrateByContract && user.EmploymentStartDate.HasValue && user.EmploymentStartDate.Value.Year == start.Year && effectivePeriod == BudgetPeriod.yearly)
                    {
                        int startMonth = user.EmploymentStartDate.Value.Month;
                        int monthsInYear = Math.Max(1, 12 - startMonth + 1);
                        rawCap = Math.Round((def * effCoeff * monthsInYear) / 12.0m, 0, MidpointRounding.AwayFromZero);
                    }
                    else
                    {
                        rawCap = Math.Round(def * effCoeff, 0, MidpointRounding.AwayFromZero);
                    }
                }
            }

            if (effectivePeriod != BudgetPeriod.unlimited && rawCap.HasValue)
            {
                if (effectivePeriod == BudgetPeriod.weekly)
                {
                    int totalAllowed = (int)rawCap.Value;
                    var curDate = start.Date;
                    while (curDate <= end.Date)
                    {
                        int diffToMonday = curDate.DayOfWeek == DayOfWeek.Sunday ? 6 : (int)curDate.DayOfWeek - (int)DayOfWeek.Monday;
                        var weekMonday = curDate.AddDays(-diffToMonday);
                        var weekSunday = weekMonday.AddDays(6);

                        var reqWeekStart = start.Date > weekMonday ? start.Date : weekMonday;
                        var reqWeekEnd = end.Date < weekSunday ? end.Date : weekSunday;
                        int reqDaysInWeek = HolidayService.CountWorkingDays(reqWeekStart, reqWeekEnd, holidays);

                        int usedInWeek = 0;
                        foreach (var r in userAbsences)
                        {
                            if (excludeRequestId.HasValue && r.Id == excludeRequestId.Value)
                                continue;
                            if (r.AbsenceTypeId == type.Id)
                            {
                                var rStart = r.PlannedStart.Date;
                                var rEnd = r.PlannedEnd.Date;
                                if (rStart <= weekSunday && rEnd >= weekMonday)
                                {
                                    var rWeekStart = rStart > weekMonday ? rStart : weekMonday;
                                    var rWeekEnd = rEnd < weekSunday ? rEnd : weekSunday;
                                    usedInWeek += HolidayService.CountWorkingDays(rWeekStart, rWeekEnd, holidays);
                                }
                            }
                        }

                        if (reqDaysInWeek + usedInWeek > totalAllowed)
                        {
                            int availableInWeek = Math.Max(0, totalAllowed - usedInWeek);
                            return (false, "ERR_BUDGET_EXCEEDED", $"Nelze uložit absenci '{type.NameEmployee}': v týdnu {weekMonday:dd.MM.} – {weekSunday:dd.MM.yyyy} je požadováno {reqDaysInWeek} prac. dnů, ale zbývá pouze {availableInWeek} dnů (týdenní limit: {totalAllowed}).");
                        }

                        curDate = weekSunday.AddDays(1);
                    }
                }
                else
                {
                    int totalAllowed = (int)(rawCap.Value + (setting?.CarriedOverDays ?? 0m));
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

        var fallbackToday = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.Local).Date;
        var parsedStartDate = !string.IsNullOrWhiteSpace(dto.StartDate) && DateTime.TryParse(dto.StartDate, out var ps)
            ? ps.Date
            : fallbackToday;
        var parsedEndDate = !string.IsNullOrWhiteSpace(dto.EndDate) && DateTime.TryParse(dto.EndDate, out var pe)
            ? pe.Date
            : parsedStartDate;

        var holidays = await _context.Holidays.ToListAsync();

        var segments = new List<(DateTime start, DateTime end)>();
        if (type!.DurationMode == DurationMode.hours)
        {
            segments.Add((parsedStartDate, parsedStartDate));
        }
        else
        {
            var currentStart = parsedStartDate;
            while (currentStart <= parsedEndDate)
            {
                var yearEnd = new DateTime(currentStart.Year, 12, 31);
                var currentEnd = parsedEndDate < yearEnd ? parsedEndDate : yearEnd;
                segments.Add((currentStart, currentEnd));
                currentStart = yearEnd.AddDays(1);
            }
        }

        var validSegments = new List<(DateTime start, DateTime end)>();
        if (segments.Count > 1 && type.DurationMode != DurationMode.hours)
        {
            foreach (var seg in segments)
            {
                int wd = HolidayService.CountWorkingDays(seg.start, seg.end, holidays);
                if (wd > 0)
                {
                    validSegments.Add(seg);
                }
            }
        }
        var activeSegments = validSegments.Count > 0 ? validSegments : segments;

        var segmentBounds = new List<(DateTimeOffset segStart, DateTimeOffset segEnd)>();
        foreach (var seg in activeSegments)
        {
            DateTimeOffset segStart;
            DateTimeOffset segEnd;

            if (type.DurationMode == DurationMode.hours)
            {
                var startTimeParts = (dto.StartTime ?? "08:30").Split(':');
                var endTimeParts = (dto.EndTime ?? "11:30").Split(':');
                segStart = new DateTimeOffset(new DateTime(seg.start.Year, seg.start.Month, seg.start.Day, int.Parse(startTimeParts[0]), int.Parse(startTimeParts[1]), 0), TimeSpan.Zero);
                segEnd = new DateTimeOffset(new DateTime(seg.start.Year, seg.start.Month, seg.start.Day, int.Parse(endTimeParts[0]), int.Parse(endTimeParts[1]), 0), TimeSpan.Zero);
            }
            else
            {
                segStart = new DateTimeOffset(seg.start, TimeSpan.Zero);
                segEnd = new DateTimeOffset(seg.end, TimeSpan.Zero);
            }

            var validation = ValidateAbsenceRules(type, ref segStart, ref segEnd, isManagedByAuthorizedOther, canBypassSubmissionRules);
            if (!validation.IsValid)
            {
                return BadRequest(ApiResponse<AbsenceRequestItemDto>.Failure(validation.ErrorCode ?? "ERR_VALIDATION", validation.ErrorMessage ?? "Neplatné parametry žádosti."));
            }

            var overlapValidation = await ValidateNoOverlapAsync(user.Id, type, segStart, segEnd);
            if (!overlapValidation.IsValid)
            {
                return BadRequest(ApiResponse<AbsenceRequestItemDto>.Failure(overlapValidation.ErrorCode ?? "ERR_OVERLAP", overlapValidation.ErrorMessage ?? "Termín koliduje s jiným záznamem."));
            }

            segmentBounds.Add((segStart, segEnd));
        }

        string fullNote = dto.Note ?? "";

        var managerRelation = await _context.UserManagers.FirstOrDefaultAsync(um => um.UserId == user.Id);
        var effectiveManagerId = user.ManagerId ?? managerRelation?.ManagerId;
        var effectiveParentId = user.ParentPersonId ?? managerRelation?.ParentPersonId;

        bool isUnlimitedHomeOffice = false;
        if (type.IsWorkMode)
        {
            var firstYear = segmentBounds.First().segStart.Year;
            var hoSetting = await _context.UserAbsenceSettings
                .FirstOrDefaultAsync(s => s.UserId == user.Id && s.AbsenceTypeId == type.Id && s.Year == firstYear);
            if (user.IsPermanentHomeOffice)
            {
                isUnlimitedHomeOffice = true;
            }
            else if (hoSetting != null)
            {
                isUnlimitedHomeOffice = hoSetting.BudgetPeriod == BudgetPeriod.unlimited || hoSetting.AllocatedCapacity == null;
            }
            else
            {
                isUnlimitedHomeOffice = type.DefaultBudgetPeriod == BudgetPeriod.unlimited || type.DefaultAllowance == null;
            }
        }

        // Dynamické vyhodnocení schvalovatele dle sloupce ApproverRole na AbsenceType:
        // - Není vybrána role (null / prázdné): automaticky se schvaluje.
        // - team_lead (Vedoucí): schvaluje osoba přiřazená u uživatele jako ParentPersonId; pokud není přiřazena (nebo je neaktivní), automaticky se schvaluje.
        // - manager (Manažer): schvaluje osoba přiřazená u uživatele jako ManagerId; pokud není přiřazena (nebo je neaktivní), automaticky se schvaluje.
        // - office_manager (Office Manager): schvaluje jakákoliv aktivní osoba v roli office_manager (nebo admin); pokud taková osoba neexistuje (nebo je žadatel/zadavatel sám office_manager/admin), automaticky se schvaluje.
        // - admin (Administrátor): schvaluje jakákoliv aktivní osoba v roli admin; pokud taková osoba neexistuje (nebo je žadatel/zadavatel sám admin), automaticky se schvaluje.
        var actorId = verifiedCallerId ?? dto.ApprovedByUserId ?? GetCurrentUserId() ?? user.Id;
        var actor = actorId == user.Id ? user : await _context.Users.FindAsync(actorId);
        bool isAutoApproved = await EvaluateDynamicAutoApprovalAsync(
            type,
            user,
            effectiveManagerId,
            effectiveParentId,
            actor,
            isManagedByAuthorizedOther,
            canBypassSubmissionRules,
            isUnlimitedHomeOffice);
        var approverId = (canBypassSubmissionRules || isManagedByAuthorizedOther) ? actorId : user.Id;
        var nowUtc = DateTimeOffset.UtcNow;

        var createdRequests = new List<AbsenceRequest>();
        foreach (var sb in segmentBounds)
        {
            var req = new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                AbsenceTypeId = type!.Id,
                Status = isAutoApproved ? AbsenceStatus.completed : AbsenceStatus.pending,
                ApprovedBy = isAutoApproved ? approverId : null,
                ApprovedAt = isAutoApproved ? nowUtc : null,
                PlannedStart = sb.segStart,
                PlannedEnd = sb.segEnd,
                Note = fullNote,
                IsRead = false,
                CreatedAt = nowUtc
            };

            _context.AbsenceRequests.Add(req);
            createdRequests.Add(req);
        }

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
        var userCtCode = UserDisplayHelper.GetContractTypeCode(user);

        var createdDtos = createdRequests.Select(r => new AbsenceRequestItemDto
        {
            Id = r.Id.ToString(),
            ApplicantId = user.Id.ToString(),
            UserName = user.DisplayName,
            UserRole = UserDisplayHelper.GetRoleLabelCzech(user.Role),
            Contract = user.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
            ContractType = userCtCode.ToLowerInvariant(),
            ContractTypeName = UserDisplayHelper.GetContractDisplayLabel(user.ContractKind, userCtCode, contractTypes),
            IsPermanentHomeOffice = user.IsPermanentHomeOffice,
            ManagerId = effectiveManagerId?.ToString(),
            ManagerName = managerName,
            ParentPersonId = effectiveParentId?.ToString(),
            ParentPersonName = parentName,
            Type = type.Code,
            TypeName = type.NameEmployee,
            StartDate = r.PlannedStart.ToString("yyyy-MM-dd"),
            EndDate = r.PlannedEnd.ToString("yyyy-MM-dd"),
            DaysCount = isHourly ? 0 : HolidayService.CountWorkingDays(r.PlannedStart.Date, r.PlannedEnd.Date, holidays),
            StartTime = isHourly ? r.PlannedStart.ToString("HH:mm") : null,
            EndTime = isHourly ? r.PlannedEnd.ToString("HH:mm") : null,
            FacilityName = null,
            HasConfirmationDocument = dto.HasConfirmationDocument,
            Note = r.Note,
            Status = isAutoApproved ? "approved" : "pending",
            IsRead = r.IsRead,
            CreatedAt = nowUtc.ToString("O"),
            ApprovedByName = approvedByName,
            ApprovedByIsFemale = approvedByIsFemale,
            ApprovedAt = isAutoApproved ? nowUtc.ToString("O") : null
        }).ToList();

        var responseDto = createdDtos.First();
        if (createdDtos.Count > 1)
        {
            responseDto.SplitItems = createdDtos.Select(d => new AbsenceRequestItemDto
            {
                Id = d.Id,
                ApplicantId = d.ApplicantId,
                UserName = d.UserName,
                UserRole = d.UserRole,
                Contract = d.Contract,
                ContractType = d.ContractType,
                ContractTypeName = d.ContractTypeName,
                IsPermanentHomeOffice = d.IsPermanentHomeOffice,
                ManagerId = d.ManagerId,
                ManagerName = d.ManagerName,
                ParentPersonId = d.ParentPersonId,
                ParentPersonName = d.ParentPersonName,
                Type = d.Type,
                TypeName = d.TypeName,
                StartDate = d.StartDate,
                EndDate = d.EndDate,
                DaysCount = d.DaysCount,
                StartTime = d.StartTime,
                EndTime = d.EndTime,
                FacilityName = d.FacilityName,
                HasConfirmationDocument = d.HasConfirmationDocument,
                Note = d.Note,
                Status = d.Status,
                IsRead = d.IsRead,
                CreatedAt = d.CreatedAt,
                ApprovedByName = d.ApprovedByName,
                ApprovedByIsFemale = d.ApprovedByIsFemale,
                ApprovedAt = d.ApprovedAt,
                SplitItems = null
            }).ToList();
        }

        return Ok(ApiResponse<AbsenceRequestItemDto>.Success(responseDto));
    }

    private async Task<bool> EvaluateDynamicAutoApprovalAsync(
        AbsenceType? type,
        User? user,
        Guid? effectiveManagerId,
        Guid? effectiveParentId,
        User? actor,
        bool isManagedByAuthorizedOther,
        bool canBypassSubmissionRules,
        bool isUnlimitedHomeOffice)
    {
        if (type?.IsWorkMode == true && user?.IsPermanentHomeOffice == true)
        {
            return true;
        }

        var approverRole = type?.ApproverRole?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(approverRole) || approverRole == "none")
        {
            return true;
        }

        if (approverRole == "admin")
        {
            if ((actor != null && actor.Role == UserRole.admin) || (user != null && user.Role == UserRole.admin))
            {
                return true;
            }
            bool anyActiveAdmin = await _context.Users.AnyAsync(u => u.IsActive && u.IsApproved && u.Role == UserRole.admin);
            return !anyActiveAdmin;
        }

        if (approverRole == "office_manager")
        {
            if ((actor != null && (actor.Role == UserRole.admin || actor.Role == UserRole.office_manager)) ||
                (user != null && (user.Role == UserRole.admin || user.Role == UserRole.office_manager)))
            {
                return true;
            }
            bool anyActiveOfficer = await _context.Users.AnyAsync(u => u.IsActive && u.IsApproved && u.Role == UserRole.office_manager);
            return !anyActiveOfficer;
        }

        if (approverRole == "team_lead")
        {
            if (canBypassSubmissionRules || isManagedByAuthorizedOther)
            {
                return true;
            }
            if (!effectiveParentId.HasValue)
            {
                return true;
            }
            var parentUser = await _context.Users.FindAsync(effectiveParentId.Value);
            return parentUser == null;
        }

        // Default: "manager"
        if (canBypassSubmissionRules)
        {
            return true;
        }
        if (!effectiveManagerId.HasValue)
        {
            return true;
        }
        var mgrUser = await _context.Users.FindAsync(effectiveManagerId.Value);
        return mgrUser == null;
    }

    private async Task<(bool CanAct, string ErrorMessage)> ValidateApproverPermissionAsync(AbsenceType? type, Guid applicantUserId, Guid approverId)
    {
        var approver = approverId != Guid.Empty ? await _context.Users.FindAsync(approverId) : null;
        if (approver == null || !approver.IsActive)
        {
            return (false, "Schvalující uživatel nebyl nalezen.");
        }

        var approverRole = type?.ApproverRole?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(approverRole) || approverRole == "none")
        {
            return (true, string.Empty);
        }

        if (approver.Role == UserRole.admin)
        {
            return (true, string.Empty);
        }

        if (approverRole == "admin")
        {
            return (false, $"Tuto žádost ({type?.NameEmployee}) může rozhodnout pouze Administrátor.");
        }

        if (approver.Role == UserRole.office_manager)
        {
            return (true, string.Empty);
        }

        if (approverRole == "office_manager")
        {
            return (false, $"Tuto žádost ({type?.NameEmployee}) může rozhodnout pouze Office Manager nebo Administrátor.");
        }

        var applicant = await _context.Users.FindAsync(applicantUserId);
        var um = await _context.UserManagers.FirstOrDefaultAsync(x => x.UserId == applicantUserId);
        var effectiveManagerId = applicant?.ManagerId ?? um?.ManagerId;
        var effectiveParentId = applicant?.ParentPersonId ?? um?.ParentPersonId;

        if (approverRole == "team_lead")
        {
            if (effectiveParentId == approver.Id || effectiveManagerId == approver.Id)
            {
                return (true, string.Empty);
            }
            return (false, $"Tuto žádost ({type?.NameEmployee}) může rozhodnout pouze přiřazený Vedoucí nebo Manažer.");
        }

        // Default: "manager"
        if (effectiveManagerId == approver.Id)
        {
            return (true, string.Empty);
        }
        return (false, $"Tuto žádost ({type?.NameEmployee}) může rozhodnout pouze přiřazený Manažer.");
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
        var effectiveApproverId = dto.ManagerId != Guid.Empty ? dto.ManagerId : (GetCurrentUserId() ?? Guid.Empty);
        var (canApprove, approveErrorMsg) = await ValidateApproverPermissionAsync(type, req.UserId, effectiveApproverId);
        if (!canApprove)
        {
            return StatusCode(403, ApiResponse<bool>.Failure("ERR_FORBIDDEN", approveErrorMsg));
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

        if (type != null && type.DurationMode != DurationMode.hours && nextStart.Year != nextEnd.Year)
        {
            return BadRequest(ApiResponse<bool>.Failure("ERR_CROSS_YEAR", "Záznam absence nesmí zasahovat přes přelom kalendářního roku. Zadejte prosím samostatné žádosti pro jednotlivé roky."));
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

        var prevNoteTrimmed = (req.Note ?? string.Empty).Trim();
        var nextNoteTrimmed = dto.Note != null ? dto.Note.Trim() : prevNoteTrimmed;
        if (nextStart == prevStart && nextEnd == prevEnd && nextNoteTrimmed == prevNoteTrimmed)
        {
            return Ok(ApiResponse<bool>.Success(true));
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

                var cCode = u != null ? UserDisplayHelper.GetContractTypeCode(u) : "full_time";

                return new AbsenceRequestItemDto
                {
                    Id = r.Id.ToString(),
                    ApplicantId = r.UserId.ToString(),
                    UserName = u?.DisplayName ?? "Neznámý uživatel",
                    UserRole = u != null ? UserDisplayHelper.GetRoleLabelCzech(u.Role) : "Uživatel",
                    Contract = u?.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
                    ContractType = cCode.ToLowerInvariant(),
                    ContractTypeName = u != null
                        ? UserDisplayHelper.GetContractDisplayLabel(u.ContractKind, cCode, contractTypes)
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
                    HasConfirmationDocument = true,
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
        var effectiveApproverId = dto.ManagerId != Guid.Empty ? dto.ManagerId : (GetCurrentUserId() ?? Guid.Empty);
        var (canReject, rejectErrorMsg) = await ValidateApproverPermissionAsync(type, req.UserId, effectiveApproverId);
        if (!canReject)
        {
            return StatusCode(403, ApiResponse<bool>.Failure("ERR_FORBIDDEN", rejectErrorMsg));
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

        if (nextStart.Year != nextEnd.Year)
        {
            return BadRequest(ApiResponse<bool>.Failure("ERR_CROSS_YEAR_NOT_ALLOWED", "Obnovovaná žádost nemůže zasahovat do dvou kalendářních let. Upravte prosím datum do 31. 12. nebo založte novou žádost."));
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
        if (effectiveType != null && effectiveType.IsWorkMode)
        {
            var hoSetting = await _context.UserAbsenceSettings
                .FirstOrDefaultAsync(s => s.UserId == req.UserId && s.AbsenceTypeId == effectiveType.Id && s.Year == nextStart.Year);
            if (user?.IsPermanentHomeOffice == true)
            {
                isUnlimitedHomeOffice = true;
            }
            else if (hoSetting != null)
            {
                isUnlimitedHomeOffice = hoSetting.BudgetPeriod == BudgetPeriod.unlimited || hoSetting.AllocatedCapacity == null;
            }
            else
            {
                isUnlimitedHomeOffice = effectiveType.DefaultBudgetPeriod == BudgetPeriod.unlimited || effectiveType.DefaultAllowance == null;
            }
        }

        var managerRelation = user != null ? await _context.UserManagers.FirstOrDefaultAsync(um => um.UserId == user.Id) : null;
        var effectiveManagerId = user?.ManagerId ?? managerRelation?.ManagerId;
        var effectiveParentId = user?.ParentPersonId ?? managerRelation?.ParentPersonId;
        var actorId = verifiedCallerId ?? dto.ApprovedByUserId ?? GetCurrentUserId() ?? req.UserId;
        var actor = actorId == req.UserId ? user : await _context.Users.FindAsync(actorId);
        bool isAutoApproved = await EvaluateDynamicAutoApprovalAsync(
            effectiveType,
            user,
            effectiveManagerId,
            effectiveParentId,
            actor,
            isManagedByAuthorizedOther,
            canBypassSubmissionRules,
            isUnlimitedHomeOffice);
        var nowUtc = DateTimeOffset.UtcNow;

        req.Status = isAutoApproved ? AbsenceStatus.completed : AbsenceStatus.pending;
        req.ApprovedBy = isAutoApproved ? ((canBypassSubmissionRules || isManagedByAuthorizedOther) ? actorId : req.UserId) : null;
        req.ApprovedAt = isAutoApproved ? nowUtc : null;
        req.RejectionReason = null;
        req.IsRead = false;
        req.CreatedAt = nowUtc;

        bool isFemActor = actor != null
            ? (actor.IsFemale || actor.DisplayName.Trim().EndsWith("á"))
            : (user?.IsFemale ?? false);
        _context.AbsenceEditLogs.Add(new AbsenceEditLog
        {
            Id = Guid.NewGuid(),
            AbsenceRequestId = req.Id,
            EditedByUserId = actorId,
            EditedByName = actor?.DisplayName ?? user?.DisplayName ?? "Uživatel",
            EditedAt = nowUtc,
            Summary = isFemActor ? "obnovila zamítnutou žádost" : "obnovil zamítnutou žádost"
        });

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

        // Zafixujeme předchozí ročníky jako uzavřené (IsClosed = true)
        var prevSettings = await _context.UserAbsenceSettings
            .Where(s => s.UserId == dto.UserId && s.Year < dto.TargetYear)
            .ToListAsync();
        foreach (var ps in prevSettings)
        {
            ps.IsClosed = true;
        }

        await _context.SaveChangesAsync();

        return await GetBalances(dto.UserId, dto.TargetYear);
    }

    /// <summary>
    /// Uloží nastavení fondu uživatele (dovolená, sick days, home office) pro daný rok.
    /// Pokud je rok již uzavřen (IsClosed = true), úpravu odmítne.
    /// </summary>
    [HttpPost("save-user-settings")]
    public async Task<ActionResult<ApiResponse<AbsenceBalancesDto>>> SaveUserSettings([FromBody] SaveUserAbsenceSettingsDto dto)
    {
        var user = await _context.Users.FindAsync(dto.UserId);
        if (user == null)
        {
            return NotFound(ApiResponse<AbsenceBalancesDto>.Failure("ERR_USER_NOT_FOUND", "Uživatel nebyl nalezen."));
        }

        var existingSettings = await _context.UserAbsenceSettings
            .Where(s => s.UserId == dto.UserId && s.Year == dto.Year)
            .ToListAsync();

        if (existingSettings.Any(s => s.IsClosed))
        {
            return BadRequest(ApiResponse<AbsenceBalancesDto>.Failure("ERR_YEAR_CLOSED", $"Rok {dto.Year} je již uzavřen a jeho fondy jsou zafixovány."));
        }

        var vacType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "vacation");
        var sickType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "sick_day");
        var hoType = await _context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "home_office");

        if (vacType != null)
        {
            var vacSetting = existingSettings.FirstOrDefault(s => s.AbsenceTypeId == vacType.Id);
            if (vacSetting == null)
            {
                vacSetting = new UserAbsenceSetting
                {
                    Id = Guid.NewGuid(),
                    UserId = dto.UserId,
                    AbsenceTypeId = vacType.Id,
                    Year = dto.Year,
                    BudgetPeriod = BudgetPeriod.yearly,
                    AllocatedCapacity = dto.VacationBase,
                    CarriedOverDays = dto.VacationCarriedOver,
                    IsPaid = true
                };
                _context.UserAbsenceSettings.Add(vacSetting);
            }
            else
            {
                vacSetting.AllocatedCapacity = dto.VacationBase;
                vacSetting.CarriedOverDays = dto.VacationCarriedOver;
            }
        }

        if (sickType != null)
        {
            var sickSetting = existingSettings.FirstOrDefault(s => s.AbsenceTypeId == sickType.Id);
            if (sickSetting == null)
            {
                sickSetting = new UserAbsenceSetting
                {
                    Id = Guid.NewGuid(),
                    UserId = dto.UserId,
                    AbsenceTypeId = sickType.Id,
                    Year = dto.Year,
                    BudgetPeriod = BudgetPeriod.yearly,
                    AllocatedCapacity = dto.SickDaysTotal,
                    CarriedOverDays = 0m,
                    MaxPerMonthOverride = sickType.MaxPerMonthLimit,
                    IsPaid = true
                };
                _context.UserAbsenceSettings.Add(sickSetting);
            }
            else
            {
                sickSetting.AllocatedCapacity = dto.SickDaysTotal;
            }
        }

        if (hoType != null)
        {
            var hoSetting = existingSettings.FirstOrDefault(s => s.AbsenceTypeId == hoType.Id);
            BudgetPeriod targetHoPeriod = BudgetPeriod.weekly;
            decimal? targetHoCap = null;

            if (dto.HomeOfficePeriod == "disabled" || dto.HomeOfficeDaysLimit == 0)
            {
                targetHoPeriod = BudgetPeriod.yearly;
                targetHoCap = 0m;
            }
            else if (dto.HomeOfficePeriod == "unlimited")
            {
                targetHoPeriod = BudgetPeriod.unlimited;
                targetHoCap = null;
            }
            else if (dto.HomeOfficePeriod == "yearly")
            {
                targetHoPeriod = BudgetPeriod.yearly;
                targetHoCap = dto.HomeOfficeDaysLimit ?? 20m;
            }
            else if (dto.HomeOfficePeriod == "monthly")
            {
                targetHoPeriod = BudgetPeriod.monthly;
                targetHoCap = dto.HomeOfficeDaysLimit ?? 10m;
            }
            else if (dto.HomeOfficePeriod == "weekly" || dto.HomeOfficeDaysLimit.HasValue || dto.HomeOfficeWeeklyDays.HasValue)
            {
                targetHoPeriod = BudgetPeriod.weekly;
                targetHoCap = dto.HomeOfficeDaysLimit ?? dto.HomeOfficeWeeklyDays ?? 5m;
            }

            if (hoSetting == null)
            {
                hoSetting = new UserAbsenceSetting
                {
                    Id = Guid.NewGuid(),
                    UserId = dto.UserId,
                    AbsenceTypeId = hoType.Id,
                    Year = dto.Year,
                    BudgetPeriod = targetHoPeriod,
                    AllocatedCapacity = targetHoCap,
                    CarriedOverDays = 0m,
                    IsPaid = true
                };
                _context.UserAbsenceSettings.Add(hoSetting);
            }
            else
            {
                hoSetting.BudgetPeriod = targetHoPeriod;
                hoSetting.AllocatedCapacity = targetHoCap;
            }
        }

        await _context.SaveChangesAsync();
        return await GetBalances(dto.UserId, dto.Year);
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
