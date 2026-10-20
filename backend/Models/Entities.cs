using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Dochazka.Api.Models;

public enum UserRole
{
    colleague,
    team_lead,
    office_manager,
    manager,
    admin
}

public enum ContractKind
{
    employee,
    osvc
}

public enum ContractType
{
    full_time,
    half_time,
    part_time
}

public enum CompensationType
{
    hourly,
    fixed_rate
}

public enum LocationType
{
    office,
    home_office,
    remote
}

public enum DurationMode
{
    days = 0,
    hours = 1,
    single_day = 2,
    both = 3
}

public enum BudgetPeriod
{
    weekly,
    yearly,
    permanent,
    unlimited,
    monthly
}

public enum AbsenceStatus
{
    pending,
    completed,
    rejected,
    cancelled
}

[Table("users")]
public class User
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? GoogleId { get; set; }

    [Required, MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string DisplayName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? PhoneNumber { get; set; }

    [MaxLength(500)]
    public string? AvatarUrl { get; set; }

    public UserRole Role { get; set; } = UserRole.colleague;
    public ContractKind ContractKind { get; set; } = ContractKind.employee;
    public ContractType ContractType { get; set; } = ContractType.full_time;

    [MaxLength(50)]
    public string? ContractTypeCode { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal WeeklyHoursBudget { get; set; } = 40.00m;

    public DateTimeOffset? ExpectedReturnAt { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsApproved { get; set; } = true;
    public DateTimeOffset? ApprovedAt { get; set; }
    public Guid? ApprovedBy { get; set; }

    public Guid? ManagerId { get; set; }
    public Guid? ParentPersonId { get; set; }
    public bool IsPermanentHomeOffice { get; set; } = false;
    public bool IsFemale { get; set; } = false;
    public DateTimeOffset? EmploymentStartDate { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("user_managers")]
public class UserManager
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public Guid ManagerId { get; set; }
    public Guid? ParentPersonId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

[Table("name_declensions")]
public class NameDeclension
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(100)]
    public string Nominative { get; set; } = string.Empty; // 1. pád (např. petr)

    [MaxLength(100)]
    public string? Genitive { get; set; } // 2. pád (Petra)

    [MaxLength(100)]
    public string? Dative { get; set; } // 3. pád (Petrovi)

    [MaxLength(100)]
    public string? Accusative { get; set; } // 4. pád (Petra)

    [MaxLength(100)]
    public string? Vocative { get; set; } // 5. pád (Petře)

    [MaxLength(100)]
    public string? Locative { get; set; } // 6. pád (Petrovi)

    [MaxLength(100)]
    public string? Instrumental { get; set; } // 7. pád (Petrem)

    public bool IsIgnored { get; set; } = false;
}

[Table("workplaces")]
public class Workplace
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string NfcIdentifier { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? NfcHardwareUid { get; set; }

    public string? NfcKeyEncrypted { get; set; }

    [MaxLength(255)]
    public string? Address { get; set; }

    public bool IsActive { get; set; } = true;
}

[Table("time_entries")]
public class TimeEntry
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public Guid? WorkplaceId { get; set; }
    public DateTimeOffset StartTime { get; set; }
    public DateTimeOffset? EndTime { get; set; }
    public LocationType LocationType { get; set; } = LocationType.office;
    public bool IsManual { get; set; } = false;
    public Guid? EditedBy { get; set; }
    public DateTimeOffset? EditedAt { get; set; }
    public string? EditReason { get; set; }
    public bool IsDeleted { get; set; } = false;
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

[Table("time_entry_edit_logs")]
public class TimeEntryEditLog
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TimeEntryId { get; set; }
    public Guid EditedByUserId { get; set; }

    [Required, MaxLength(200)]
    public string EditedByUserName { get; set; } = string.Empty;

    [NotMapped]
    public string EditedByName
    {
        get => EditedByUserName;
        set => EditedByUserName = value;
    }

    public DateTimeOffset EditedAt { get; set; } = DateTimeOffset.UtcNow;

    [MaxLength(500)]
    public string? ChangesSummary { get; set; }

    [NotMapped]
    public string? Summary
    {
        get => ChangesSummary;
        set => ChangesSummary = value;
    }
}

[Table("absence_types")]
public class AbsenceType
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string NameEmployee { get; set; } = string.Empty;

    public bool AllowOsvc { get; set; } = false;

    public DurationMode DurationMode { get; set; } = DurationMode.days;
    public int SubmissionOffsetDays { get; set; } = 0;

    [MaxLength(20)]
    public string? SubmissionDeadlineTime { get; set; }

    public int? MaxPerMonthLimit { get; set; }
    public BudgetPeriod DefaultBudgetPeriod { get; set; } = BudgetPeriod.yearly;
    public int? DefaultAllowance { get; set; }
    public bool IsActive { get; set; } = true;

    [MaxLength(50)]
    public string Icon { get; set; } = "Palmtree";

    [MaxLength(50)]
    public string Color { get; set; } = "amber";

    [MaxLength(32)]
    public string? ApproverRole { get; set; }

    public bool IsSystem { get; set; } = false;
}

[Table("user_absence_settings")]
public class UserAbsenceSetting
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public Guid AbsenceTypeId { get; set; }
    public int Year { get; set; } = 2026;
    public BudgetPeriod BudgetPeriod { get; set; } = BudgetPeriod.yearly;

    [Column(TypeName = "decimal(6,2)")]
    public decimal? AllocatedCapacity { get; set; }

    [Column(TypeName = "decimal(6,2)")]
    public decimal CarriedOverDays { get; set; } = 0.00m;

    public int? MaxPerMonthOverride { get; set; }
    public bool IsPaid { get; set; } = true;
    public bool IsClosed { get; set; } = false;
}

[Table("absence_requests")]
public class AbsenceRequest
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public Guid AbsenceTypeId { get; set; }
    public AbsenceStatus Status { get; set; } = AbsenceStatus.pending;
    public DateTimeOffset PlannedStart { get; set; }
    public DateTimeOffset PlannedEnd { get; set; }
    public DateTimeOffset? ActualStart { get; set; }
    public DateTimeOffset? ActualEnd { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public Guid? VerifiedBy { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
    public string? Note { get; set; }
    public string? RejectionReason { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTimeOffset? CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsDeleted { get; set; } = false;
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

[Table("absence_edit_logs")]
public class AbsenceEditLog
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid AbsenceRequestId { get; set; }
    public Guid EditedByUserId { get; set; }

    [Required, MaxLength(200)]
    public string EditedByUserName { get; set; } = string.Empty;

    [NotMapped]
    public string EditedByName
    {
        get => EditedByUserName;
        set => EditedByUserName = value;
    }

    public DateTimeOffset EditedAt { get; set; } = DateTimeOffset.UtcNow;

    [MaxLength(500)]
    public string? ChangesSummary { get; set; }

    [NotMapped]
    public string? Summary
    {
        get => ChangesSummary;
        set => ChangesSummary = value;
    }
}

[Table("company_settings")]
public class CompanySetting
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column(TypeName = "decimal(4,2)")]
    public decimal DailyHours { get; set; } = 8.00m;

    public int WeeklyWorkDays { get; set; } = 5;
}

[Table("holidays")]
public class Holiday
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    public int? Month { get; set; }

    public int? Day { get; set; }

    [MaxLength(100)]
    public string? Rule { get; set; }

    [Required, MaxLength(50)]
    public string PackageCode { get; set; } = "cz";

    public bool IsCustomHoliday { get; set; } = false;

    public bool IsActive { get; set; } = true;
}

[Table("user_notification_preferences")]
public class UserNotificationPreference
{
    [Key]
    public Guid UserId { get; set; }

    public bool ChannelInApp { get; set; } = true;
    public bool ChannelEmail { get; set; } = true;
    public bool ChannelPush { get; set; } = true;
    public bool NotifyLeaveApproval { get; set; } = true;
    public bool NotifyPendingApproval { get; set; } = true;
    public bool NotifyDoctorVerified { get; set; } = true;
    public bool NotifyForgottenClockout { get; set; } = true;
}

[Table("contract_types")]
public class ContractTypeSetting
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column(TypeName = "decimal(4,2)")]
    public decimal Coefficient { get; set; } = 1.00m;
}

public enum LogType
{
    api,
    web,
    auth,
    nfc,
    system
}

[Table("logs")]
public class SystemLog
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(100)]
    public string UserId { get; set; } = "0";

    public LogType Type { get; set; } = LogType.api;

    [Required, MaxLength(500)]
    public string Status { get; set; } = string.Empty;

    public DateTimeOffset DateTime { get; set; } = DateTimeOffset.UtcNow;
}

public static class UserDisplayHelper
{
    public static string GetRoleLabelCzech(UserRole role) => role switch
    {
        UserRole.admin => "Administrátor",
        UserRole.manager => "Manažer",
        UserRole.office_manager => "Office Manager",
        UserRole.team_lead => "Vedoucí",
        _ => "Uživatel"
    };

    public static string GetContractTypeCode(User user)
    {
        if (!string.IsNullOrWhiteSpace(user.ContractTypeCode))
        {
            return user.ContractTypeCode.Trim().ToLowerInvariant();
        }
        return user.ContractType.ToString().ToLowerInvariant();
    }

    public static string GetContractDisplayLabel(
        ContractKind kind,
        ContractType type,
        IReadOnlyDictionary<string, string>? contractTypeNamesByCode = null,
        string? customCode = null)
    {
        if (kind == ContractKind.osvc)
        {
            if (contractTypeNamesByCode != null &&
                contractTypeNamesByCode.TryGetValue("osvc", out var osvcName) &&
                !string.IsNullOrWhiteSpace(osvcName))
            {
                return osvcName;
            }
            return "OSVČ";
        }

        var code = !string.IsNullOrWhiteSpace(customCode)
            ? customCode.Trim().ToLowerInvariant()
            : type.ToString().ToLowerInvariant();
        if (contractTypeNamesByCode != null &&
            contractTypeNamesByCode.TryGetValue(code, out var dbName) &&
            !string.IsNullOrWhiteSpace(dbName))
        {
            return dbName;
        }

        return type switch
        {
            ContractType.half_time => "Poloviční úvazek",
            ContractType.part_time => "Zkrácený úvazek",
            _ => "Plný úvazek"
        };
    }

    public static string GetContractDisplayLabel(
        ContractKind kind,
        string contractTypeCode,
        IReadOnlyDictionary<string, string>? contractTypeNamesByCode = null)
    {
        var parsedType = Enum.TryParse<ContractType>(contractTypeCode, true, out var t)
            ? t
            : ContractType.full_time;
        return GetContractDisplayLabel(kind, parsedType, contractTypeNamesByCode, contractTypeCode);
    }
}


