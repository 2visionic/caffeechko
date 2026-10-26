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
    public bool IsPermanentHomeOffice { get; set; } = false;
    public bool IsFemale { get; set; } = false;
}

public class SetPermanentHomeOfficeDto
{
    public bool IsPermanentHomeOffice { get; set; }
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
    public string ContractType { get; set; } = "full_time";
    public string? ContractTypeCode { get; set; }
    public decimal? WeeklyHoursBudget { get; set; }
    public decimal? VacationDays { get; set; }
    public decimal? SickDays { get; set; }
    public decimal? HomeOfficeWeeklyDays { get; set; }
    public Dictionary<string, decimal>? Allowances { get; set; }
    public bool IsPermanentHomeOffice { get; set; } = false;
}

public class ImpersonateRequestDto
{
    public Guid UserId { get; set; }
}

// ==========================================
// 2. ABSENCE & SETTINGS DTOs
// ==========================================
public class RecordEditLogDto
{
    public string Id { get; set; } = string.Empty;
    public string EditedByUserId { get; set; } = string.Empty;
    public string EditedByName { get; set; } = string.Empty;
    public string EditedAt { get; set; } = string.Empty;
    public string? Summary { get; set; }
}

public class AbsenceRequestItemDto
{
    public string Id { get; set; } = string.Empty;
    public string ApplicantId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string? UserRole { get; set; } = string.Empty;
    public string? Contract { get; set; } = "HPP";
    public string? ContractType { get; set; } = "full_time";
    public string? ContractTypeName { get; set; }
    public bool IsPermanentHomeOffice { get; set; } = false;
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
    public string? ApprovedByName { get; set; }
    public bool? ApprovedByIsFemale { get; set; }
    public string? ApprovedAt { get; set; }
    public int RemainingDays { get; set; } = 0;
    public int TotalDays { get; set; } = 0;
    public bool IsDeleted { get; set; } = false;
    public string? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
    public bool IsLockedByClosure { get; set; } = false;
    public string? EditableMinEndDate { get; set; }
    public List<RecordEditLogDto> EditLogs { get; set; } = new();
    public List<AbsenceRequestItemDto>? SplitItems { get; set; }
}

public class UpdateAbsenceRequestDto
{
    public Guid? EditorUserId { get; set; }
    public Guid? EditedByUserId { get; set; }
    public string? EditedByUserName { get; set; }
    public string? EditReason { get; set; }
    public string? TypeCode { get; set; }
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? FacilityName { get; set; }
    public bool? HasConfirmationDocument { get; set; }
    public string? Note { get; set; }
}

public class DeleteRecordRequestDto
{
    public Guid? DeletedByUserId { get; set; }
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
    public string HomeOfficePeriod { get; set; } = "unlimited";
    public decimal? HomeOfficeDaysLimit { get; set; }
    public int UnpaidLeaveDays { get; set; } = 0;
    public bool CompensatoryLeaveEnabled { get; set; } = false;
    public int CompensatoryLeaveDays { get; set; } = 0;
    public int CompensatoryLeavePendingDays { get; set; } = 0;
    public double CompensatoryLeaveAvailableSaldoHours { get; set; } = 0;
    public int CompensatoryLeaveMaxDays { get; set; } = 0;
    public bool IsClosed { get; set; } = false;
    public List<int> AvailableYears { get; set; } = new();
    public List<string> AbsenceSortOrder { get; set; } = new();
    public Dictionary<string, AbsenceTypeBalanceDto> Balances { get; set; } = new();
}

public class CompanySettingDto
{
    public decimal DailyHours { get; set; } = 8.00m;
    public int WeeklyWorkDays { get; set; } = 5;
}

public class ContractTypeSettingDto
{
    public Guid? Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Coefficient { get; set; }
    public int UsersCount { get; set; }
}

public class HolidayConfigDto
{
    public Guid? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? Month { get; set; }
    public int? Day { get; set; }
    public string? Rule { get; set; }
    public string PackageCode { get; set; } = "cz";
    public bool IsCustomHoliday { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public string? ResolvedDateCurrentYear { get; set; }
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
    public Guid? Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string NameEmployee { get; set; } = string.Empty;
    public string? NameOsvc { get; set; }
    public bool AllowOsvc { get; set; } = false;
    public string DurationMode { get; set; } = "days";
    public int SubmissionOffsetDays { get; set; } = 0;
    public string? SubmissionDeadlineTime { get; set; }
    public int? MaxPerMonthLimit { get; set; }
    public string DefaultBudgetPeriod { get; set; } = "yearly";
    public int? DefaultAllowance { get; set; }
    public bool IsActive { get; set; } = true;
    public string Icon { get; set; } = "Palmtree";
    public string Color { get; set; } = "amber";
    public string? ApproverRole { get; set; }
    public bool IsSystem { get; set; } = false;
    public bool IsPrivate { get; set; } = false;
    public bool IsPaid { get; set; } = true;
    public bool IsWorkMode { get; set; } = false;
    public bool AllowCarryOver { get; set; } = false;
    public bool ProrateByContract { get; set; } = false;
    public bool SwitchToUnpaidOnExhausted { get; set; } = false;
    public bool DrawsFromSaldo { get; set; } = false;
    public string? InfoText { get; set; }
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
    public bool IsSuspicious { get; set; } = false;
    public string? EditedBy { get; set; }
    public DateTimeOffset? EditedAt { get; set; }
    public string? EditReason { get; set; }
    public List<RecordEditLogDto> EditLogs { get; set; } = new();
}

public class SuspiciousTimeEntryDto : TimeEntryDetailDto
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string UserRole { get; set; } = "colleague";
    public string UserRoleLabel { get; set; } = string.Empty;
    public string Contract { get; set; } = "HPP";
    public string ContractType { get; set; } = "full_time";
    public string? ContractTypeName { get; set; }
    public bool IsPermanentHomeOffice { get; set; } = false;
}

public class DeletedTimeEntryDto : TimeEntryDetailDto
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsPermanentHomeOffice { get; set; } = false;
    public DateTimeOffset? DeletedAt { get; set; }
    public string? DeletedByName { get; set; }
    public bool IsLockedByClosure { get; set; } = false;
}

public class UpdateTimeEntryDto
{
    public Guid? EditorUserId { get; set; }
    public Guid? EditedByUserId { get; set; }
    public string? EditedByUserName { get; set; }
    public string? EditReason { get; set; }
    public string? Date { get; set; }
    public string StartTime { get; set; } = string.Empty;
    public string? EndTime { get; set; }
    public string? LocationType { get; set; }
    public Guid? WorkplaceId { get; set; }
    public bool? VerifyOffice { get; set; }
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
    public double CarriedOverSaldoHours { get; set; }
    public int HomeOfficeDays { get; set; }
    public bool IsMonthClosed { get; set; }
    public bool IsMonthLocked { get; set; }
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
    public Guid? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string NfcIdentifier { get; set; } = string.Empty;
    public string? NfcHardwareUid { get; set; }
    public string? Address { get; set; }
    public bool IsActive { get; set; } = true;
    public bool HasCardPassword { get; set; } = false;
}

public class EncodeWorkplaceCardDto
{
    public string Password { get; set; } = string.Empty;
    public string? NfcHardwareUid { get; set; }
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
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? ExpectedReturnAt { get; set; }
    public bool IsPermanentHomeOffice { get; set; } = false;
    public bool IsFemale { get; set; } = false;
    public string? EmploymentStartDate { get; set; }
    public string GdprStatus { get; set; } = "unfilled";
    public Guid? ActiveGdprDocumentId { get; set; }
}

public class UpdateUserProfileDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string Role { get; set; } = "colleague";
    public string ContractKind { get; set; } = "employee";
    public string? ContractTypeCode { get; set; }
    public Guid? ManagerId { get; set; }
    public Guid? ParentPersonId { get; set; }
    public bool IsFemale { get; set; }
    public bool IsPermanentHomeOffice { get; set; }
    public string? EmploymentStartDate { get; set; }
}

public class CreateUserDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string Role { get; set; } = "colleague";
    public string ContractKind { get; set; } = "employee";
    public string? ContractTypeCode { get; set; }
    public Guid? ManagerId { get; set; }
    public Guid? ParentPersonId { get; set; }
    public bool IsFemale { get; set; } = false;
    public bool IsPermanentHomeOffice { get; set; } = false;
    public string? EmploymentStartDate { get; set; }

    // Absence settings pro rok nástupu / aktuální rok
    public decimal VacationBase { get; set; } = 20m;
    public decimal VacationCarriedOver { get; set; } = 0m;
    public decimal SickDaysTotal { get; set; } = 5m;
    public string HomeOfficePeriod { get; set; } = "unlimited"; // unlimited, weekly, yearly, disabled
    public decimal? HomeOfficeDaysLimit { get; set; }
    public bool CompensatoryLeaveEnabled { get; set; } = false;
}

public class SaveUserAbsenceSettingsDto
{
    public Guid UserId { get; set; }
    public int Year { get; set; }
    public decimal VacationBase { get; set; }
    public decimal VacationCarriedOver { get; set; }
    public decimal SickDaysTotal { get; set; }
    public decimal? HomeOfficeWeeklyDays { get; set; }
    public string? HomeOfficePeriod { get; set; }
    public decimal? HomeOfficeDaysLimit { get; set; }
    public bool? CompensatoryLeaveEnabled { get; set; }
}

public class UserAbsenceSortDto
{
    public Guid UserId { get; set; }
    public List<string> AbsenceCodes { get; set; } = new();
    public bool IsCustom { get; set; }
}

public class SaveUserAbsenceSortDto
{
    public Guid UserId { get; set; }
    public List<string> AbsenceCodes { get; set; } = new();
}

public class NameDeclensionDto
{
    public string Nominative { get; set; } = string.Empty;
    public string? Genitive { get; set; }
    public string? Dative { get; set; }
    public string? Accusative { get; set; }
    public string? Vocative { get; set; }
    public string? Locative { get; set; }
    public string? Instrumental { get; set; }
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

// ==========================================
// 5. GDPR DTOs
// ==========================================
public class GdprSendDto
{
    public Guid Id { get; set; }
    public Guid GdprDocumentId { get; set; }
    public Guid UserId { get; set; }
    public string UserEmail { get; set; } = string.Empty;
    public string? UserName { get; set; }
    public bool IsGranted { get; set; }
    public string SentAt { get; set; } = string.Empty;
}

public class GdprDocumentDto
{
    public Guid Id { get; set; }
    public string ValidFrom { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
    public int SendsCount { get; set; }
    public int GrantedCount { get; set; }
    public int RevokedCount { get; set; }
    public bool IsCurrentlyActive { get; set; }
    public List<GdprSendDto> UserSends { get; set; } = new();
}

public class SaveGdprDocumentDto
{
    public string ValidFrom { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}

public class SubmitGdprConsentDto
{
    public Guid UserId { get; set; }
    public string? UserEmail { get; set; }
    public Guid? GdprDocumentId { get; set; }
    public bool IsGranted { get; set; }
}

public class UserGdprOverviewDto
{
    public Guid? ActiveGdprId { get; set; }
    public string? ActiveValidFrom { get; set; }
    public string? ActiveContent { get; set; }
    public string CurrentStatus { get; set; } = "unfilled";
    public string? LatestSentAt { get; set; }
    public bool Unchanged { get; set; } = false;
    public List<GdprDocumentDto> ValidDocuments { get; set; } = new();
}

// ==========================================
// 6. MONTHLY & YEARLY CLOSURES DTOs
// ==========================================
public class MonthlyClosureRecordDto
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public int Year { get; set; }
    public int Month { get; set; }
    public double WorkedHours { get; set; }
    public double FundHours { get; set; }
    public double OvertimeBalanceHours { get; set; }
    public double SaldoUsedHours { get; set; }
    public double OvertimeToSaldoHours { get; set; }
    public double NetSaldoChangeHours { get; set; }
    public double PaidOvertimeHours { get; set; }
    public List<string> VerifiedAbsenceIds { get; set; } = new();
    public string ClosedByUserId { get; set; } = string.Empty;
    public string? ClosedByName { get; set; }
    public string ClosedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}

public class ClosureAbsenceChecklistItemDto
{
    public string Id { get; set; } = string.Empty;
    public string TypeCode { get; set; } = string.Empty;
    public string TypeName { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public int DaysCount { get; set; }
    public double HoursCount { get; set; }
    public string? Note { get; set; }
    public bool RequiresChecklist { get; set; }
    public string? ChecklistLabel { get; set; }
    public bool IsVerified { get; set; }
}

public class PersonMonthlyClosureItemDto
{
    public string UserId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "colleague";
    public string RoleLabel { get; set; } = string.Empty;
    public string Contract { get; set; } = "HPP";
    public string ContractType { get; set; } = "full_time";
    public string? ContractTypeName { get; set; }
    public bool IsPermanentHomeOffice { get; set; }
    public double DailyTargetHours { get; set; } = 8.0;
    public int Year { get; set; }
    public int Month { get; set; }
    public double WorkedHours { get; set; }
    public double FundHours { get; set; }
    public double OvertimeBalanceHours { get; set; }
    public double IncomingSaldoHours { get; set; }
    public double CarriedOverSaldoHours { get; set; }
    public int UnverifiedPresencesCount { get; set; }
    public List<TimeEntryDetailDto> UnverifiedPresences { get; set; } = new();
    public int IllnessDays { get; set; }
    public int OcrDays { get; set; }
    public int VacationDays { get; set; }
    public int SickDays { get; set; }
    public double DoctorHours { get; set; }
    public int UnpaidLeaveDays { get; set; }
    public int CompensatoryLeaveDays { get; set; }
    public bool CompensatoryLeaveEnabled { get; set; }
    public List<ClosureAbsenceChecklistItemDto> AbsencesForChecklist { get; set; } = new();
    public bool IsClosed { get; set; }
    public bool IsLocked { get; set; }
    public MonthlyClosureRecordDto? ClosureRecord { get; set; }
}

public class EligibleClosureMonthDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public bool HasActivity { get; set; }
    public int TotalUsersCount { get; set; }
    public int ClosedUsersCount { get; set; }
    public int UnclosedUsersCount { get; set; }
    public bool IsFullyClosed { get; set; }
    public bool IsLocked { get; set; }
}

public class YearlyClosurePersonDto
{
    public string UserId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string RoleLabel { get; set; } = string.Empty;
    public string Contract { get; set; } = "HPP";
    public string ContractType { get; set; } = "full_time";
    public string ContractTypeName { get; set; } = string.Empty;
    public bool IsPermanentHomeOffice { get; set; }
    public int Year { get; set; }
    public int NextYear { get; set; }
    public bool IsClosed { get; set; }

    public decimal VacationBase { get; set; }
    public decimal VacationCarriedOver { get; set; }
    public decimal VacationTotal { get; set; }
    public decimal VacationUsed { get; set; }
    public decimal VacationRemaining { get; set; }
    public decimal SickDays { get; set; }
    public string HomeOfficePeriod { get; set; } = "unlimited";
    public decimal? HomeOfficeDaysLimit { get; set; }
    public string HomeOfficeLabel { get; set; } = string.Empty;
    public bool CompensatoryLeaveEnabled { get; set; }
    public string CompensatoryLeaveLabel { get; set; } = string.Empty;

    public decimal NextVacationBase { get; set; }
    public decimal NextVacationCarriedOver { get; set; }
    public decimal NextVacationTotal { get; set; }
    public decimal NextSickDays { get; set; }
    public string NextHomeOfficePeriod { get; set; } = "unlimited";
    public decimal? NextHomeOfficeDaysLimit { get; set; }
    public string NextHomeOfficeLabel { get; set; } = string.Empty;
    public bool NextCompensatoryLeaveEnabled { get; set; }
    public string NextCompensatoryLeaveLabel { get; set; } = string.Empty;
}

public class EligibleClosureYearDto
{
    public int Year { get; set; }
    public bool HasActivity { get; set; }
    public int EligibleMonthsCount { get; set; }
    public int ClosedMonthsCount { get; set; }
    public bool IsReadyForYearlyClosure { get; set; }
    public bool IsYearlyClosed { get; set; }
    public List<YearlyClosurePersonDto> People { get; set; } = new();
}

public class ExecuteYearlyClosureDto
{
    public int Year { get; set; }
    public Guid? UserId { get; set; }
    public Guid? ClosedByUserId { get; set; }
    public decimal? VacationBase { get; set; }
    public decimal? VacationCarriedOver { get; set; }
    public decimal? SickDays { get; set; }
    public string? HomeOfficePeriod { get; set; }
    public decimal? HomeOfficeDaysLimit { get; set; }
    public bool? CompensatoryLeaveEnabled { get; set; }
}

public class MonthlyClosuresOverviewDto
{
    public int SelectedYear { get; set; }
    public int SelectedMonth { get; set; }
    public int FirstUnclosedYear { get; set; }
    public int FirstUnclosedMonth { get; set; }
    public bool CanCloseSelectedMonth { get; set; }
    public bool IsSelectedMonthLocked { get; set; }
    public List<EligibleClosureMonthDto> AvailableMonths { get; set; } = new();
    public List<EligibleClosureYearDto> AvailableYears { get; set; } = new();
    public List<PersonMonthlyClosureItemDto> People { get; set; } = new();
}

public class SavePersonMonthlyClosureDto
{
    public Guid UserId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal SaldoUsedHours { get; set; }
    public decimal OvertimeToSaldoHours { get; set; }
    public List<string> VerifiedAbsenceIds { get; set; } = new();
    public Guid? ClosedByUserId { get; set; }
}

public class AutoCloseMonthDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public Guid? ClosedByUserId { get; set; }
}

public class DeleteMonthlyClosureDto
{
    public Guid? DeletedByUserId { get; set; }
}

public class DeleteYearlyClosureDto
{
    public int Year { get; set; }
    public Guid? DeletedByUserId { get; set; }
}
