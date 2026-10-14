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
    days,
    hours,
    both
}

public enum BudgetPeriod
{
    weekly,
    yearly,
    permanent,
    unlimited
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
    public CompensationType CompensationType { get; set; } = CompensationType.hourly;

    [Column(TypeName = "decimal(10,2)")]
    public decimal? HourlyRate { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? FixedMonthlyRate { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal WeeklyHoursBudget { get; set; } = 40.00m;

    public DateTimeOffset? ExpectedReturnAt { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsApproved { get; set; } = true;
    public DateTimeOffset? ApprovedAt { get; set; }
    public Guid? ApprovedBy { get; set; }

    public Guid? ManagerId { get; set; }
    public Guid? ParentPersonId { get; set; }

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

    [Required, MaxLength(100)]
    public string NameOsvc { get; set; } = string.Empty;

    public DurationMode DurationMode { get; set; } = DurationMode.days;
    public int SubmissionOffsetDays { get; set; } = 0;
    public int? SubmissionDeadlineHoursBefore { get; set; }
    public int? MaxPerMonthLimit { get; set; }
    public BudgetPeriod DefaultBudgetPeriod { get; set; } = BudgetPeriod.yearly;
    public bool IsActive { get; set; } = true;
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
}

[Table("company_settings")]
public class CompanySetting
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column(TypeName = "decimal(4,2)")]
    public decimal DailyHours { get; set; } = 8.00m;

    public int WeeklyWorkDays { get; set; } = 5;

    [Column(TypeName = "decimal(5,2)")]
    public decimal DefaultVacationDays { get; set; } = 20.00m;

    [Column(TypeName = "decimal(5,2)")]
    public decimal DefaultSickDays { get; set; } = 3.00m;

    [Column(TypeName = "decimal(5,2)")]
    public decimal DefaultHomeOfficeWeeklyDays { get; set; } = 2.00m;
}

[Table("holidays")]
public class Holiday
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateOnly Date { get; set; }

    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    public bool IsCustomHoliday { get; set; } = false;
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

