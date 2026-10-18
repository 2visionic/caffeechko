using System;
using System.Collections.Generic;

namespace Dochazka.Api.Models;

// ==========================================
// 1. AUTH DTOs
// ==========================================
public class GoogleLoginDto
{
    public string? IdToken { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? GoogleId { get; set; }
}

public class AuthUserDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string RoleLabel { get; set; } = string.Empty;
    public bool IsApproved { get; set; } = true;
    public string? AvatarUrl { get; set; }
    public string Contract { get; set; } = "HPP";
    public string ContractType { get; set; } = "full_time";
    public string? ContractTypeName { get; set; }
    public string? PhoneNumber { get; set; }
}

public class AuthResponseDto
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public int ExpiresIn { get; set; } = 86400;
    public AuthUserDto User { get; set; } = new();
}

public class ContactPersonDto
{
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
}

public class PendingStatusResponseDto
{
    public bool IsApproved { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public ContactPersonDto ContactPerson { get; set; } = new();
}

public class ApproveUserRequestDto
{
    public Guid UserId { get; set; }
    public UserRole Role { get; set; } = UserRole.colleague;
    public ContractKind ContractKind { get; set; } = ContractKind.employee;
    public ContractType ContractType { get; set; } = ContractType.full_time;
    public decimal? WeeklyHoursBudget { get; set; }
    public decimal? VacationDays { get; set; }
    public decimal? SickDays { get; set; }
    public decimal? HomeOfficeWeeklyDays { get; set; }
    public Dictionary<string, decimal>? Allowances { get; set; }
}

public class ImpersonateRequestDto
{
    public Guid UserId { get; set; }
}

// ==========================================
// 2. ABSENCE & SETTINGS DTOs
// ==========================================
public class AbsenceRequestItemDto
{
    public string Id { get; set; } = string.Empty;
    public string ApplicantId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string UserRole { get; set; } = string.Empty;
    public string Contract { get; set; } = "HPP";
    public string ContractType { get; set; } = "full_time";
    public string? ContractTypeName { get; set; }
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
    public string? CreatedAt { get; set; }
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
    public bool AutoApprove { get; set; } = false;
    public Guid? ApprovedByUserId { get; set; }
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

public class ResubmitAbsenceDto
{
    public string? TypeCode { get; set; }
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? FacilityName { get; set; }
    public bool? HasConfirmationDocument { get; set; }
    public string? Note { get; set; }
    public bool AutoApprove { get; set; } = false;
    public Guid? ApprovedByUserId { get; set; }
}

public class AbsenceTypeBalanceDto
{
    public string Code { get; set; } = string.Empty;
    public string BudgetPeriod { get; set; } = "unlimited";
    public int Base { get; set; }
    public int CarriedOver { get; set; }
    public int Total { get; set; }
    public int Used { get; set; }
    public int Remaining { get; set; }
    public int? MaxPerMonth { get; set; }
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
    public Dictionary<string, AbsenceTypeBalanceDto> Balances { get; set; } = new();
}

public class CompanySettingDto
{
    public decimal DailyHours { get; set; } = 8.00m;
    public int WeeklyWorkDays { get; set; } = 5;
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

public class AbsenceTypeConfigDto
{
    public string Code { get; set; } = string.Empty;
    public string NameEmployee { get; set; } = string.Empty;
    public bool AllowOsvc { get; set; } = false;
    public string DurationMode { get; set; } = "days";
    public int SubmissionOffsetDays { get; set; } = 0;
    public string? SubmissionDeadlineTime { get; set; }
    public int? MaxPerMonthLimit { get; set; }
    public string DefaultBudgetPeriod { get; set; } = "yearly";
    public int? DefaultAllowance { get; set; }
    public bool IsActive { get; set; } = true;
}

// ==========================================
// 3. ATTENDANCE DTOs
// ==========================================
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
    public bool IsManual { get; set; } = false;
    public string? EditedBy { get; set; }
    public DateTimeOffset? EditedAt { get; set; }
    public string? EditReason { get; set; }
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
    public Guid? EditedByUserId { get; set; }
    public string? EditedByUserName { get; set; }
}

public class ClockOutRequestDto
{
    public Guid? UserId { get; set; }
    public string? NfcIdentifier { get; set; }
    public bool IsPause { get; set; } = false;
    public DateTimeOffset? ExpectedReturnAt { get; set; }
    public Guid? EditedByUserId { get; set; }
    public string? EditedByUserName { get; set; }
}

public class TimeEntryDto
{
    public Guid Id { get; set; }
    public DateTimeOffset StartTime { get; set; }
    public DateTimeOffset? EndTime { get; set; }
    public string LocationType { get; set; } = string.Empty;
    public Guid? WorkplaceId { get; set; }
    public bool DeletedUnderOneMinute { get; set; } = false;
    public bool IsManual { get; set; } = false;
    public Guid? EditedBy { get; set; }
    public DateTimeOffset? EditedAt { get; set; }
    public string? EditReason { get; set; }
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
    public string RoleLabel { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string ContractKind { get; set; } = "HPP";
    public string ContractType { get; set; } = "full_time";
    public string? ContractTypeName { get; set; }
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

// ==========================================
// 4. DEV DTOs
// ==========================================
public class DevConfigDto
{
    public string AppName { get; set; } = "caffeechko";
    public string CompanyName { get; set; } = "Firma s.r.o.";
    public string InstanceName { get; set; } = "firma";
    public string GoogleWorkspaceDomain { get; set; } = "firma.cz";
    public string? GoogleClientId { get; set; }
    public string? GoogleClientSecret { get; set; }
    public bool UsePostgres { get; set; } = false;
    public string? ConnectionString { get; set; }
}

public class DevDatabaseStatusDto
{
    public string CurrentMode { get; set; } = "dev";
    public string DatabaseFile { get; set; } = "dochazka_dev.db";
    public int TableCount { get; set; }
    public int UserCount { get; set; }
    public bool IsInstalled { get; set; }
}

public class SwitchDatabaseRequestDto
{
    public string Mode { get; set; } = "dev";
}

public class BootstrapInstallRequestDto
{
    public string? CompanyName { get; set; }
    public string? AdminName { get; set; }
    public string? AdminEmail { get; set; }
}
