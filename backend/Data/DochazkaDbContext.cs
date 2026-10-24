using Microsoft.EntityFrameworkCore;
using Dochazka.Api.Models;

namespace Dochazka.Api.Data;

public class DochazkaDbContext : DbContext
{
    private readonly DevDatabaseManager? _dbManager;

    public DochazkaDbContext(DbContextOptions<DochazkaDbContext> options, DevDatabaseManager? dbManager = null) : base(options)
    {
        _dbManager = dbManager;
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (!optionsBuilder.IsConfigured && _dbManager != null)
        {
            optionsBuilder.UseSqlite(_dbManager.GetConnectionString());
        }
        base.OnConfiguring(optionsBuilder);
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<UserManager> UserManagers => Set<UserManager>();
    public DbSet<NameDeclension> NameDeclensions => Set<NameDeclension>();
    public DbSet<Workplace> Workplaces => Set<Workplace>();
    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();
    public DbSet<TimeEntryEditLog> TimeEntryEditLogs => Set<TimeEntryEditLog>();
    public DbSet<AbsenceType> AbsenceTypes => Set<AbsenceType>();
    public DbSet<UserAbsenceSetting> UserAbsenceSettings => Set<UserAbsenceSetting>();
    public DbSet<AbsenceRequest> AbsenceRequests => Set<AbsenceRequest>();
    public DbSet<AbsenceEditLog> AbsenceEditLogs => Set<AbsenceEditLog>();
    public DbSet<CompanySetting> CompanySettings => Set<CompanySetting>();
    public DbSet<Holiday> Holidays => Set<Holiday>();
    public DbSet<UserNotificationPreference> UserNotificationPreferences => Set<UserNotificationPreference>();
    public DbSet<ContractTypeSetting> ContractTypes => Set<ContractTypeSetting>();
    public DbSet<SystemLog> Logs => Set<SystemLog>();
    public DbSet<GdprDocument> GdprDocuments => Set<GdprDocument>();
    public DbSet<GdprSend> GdprSends => Set<GdprSend>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<UserManager>(entity =>
        {
            entity.HasIndex(um => new { um.UserId, um.ManagerId }).IsUnique();
        });

        modelBuilder.Entity<NameDeclension>(entity =>
        {
            entity.HasIndex(d => d.Nominative).IsUnique();
        });

        modelBuilder.Entity<Workplace>(entity =>
        {
            entity.HasIndex(w => w.NfcIdentifier).IsUnique();
        });

        modelBuilder.Entity<TimeEntry>(entity =>
        {
            entity.HasIndex(t => t.UserId);
            entity.HasIndex(t => t.StartTime);
        });

        modelBuilder.Entity<TimeEntryEditLog>(entity =>
        {
            entity.HasIndex(l => l.TimeEntryId);
        });

        modelBuilder.Entity<AbsenceEditLog>(entity =>
        {
            entity.HasIndex(l => l.AbsenceRequestId);
        });

        modelBuilder.Entity<AbsenceType>(entity =>
        {
            entity.HasIndex(a => a.Code).IsUnique();
        });

        modelBuilder.Entity<UserAbsenceSetting>(entity =>
        {
            entity.HasIndex(s => new { s.UserId, s.AbsenceTypeId, s.Year }).IsUnique();
        });

        modelBuilder.Entity<Holiday>(entity =>
        {
            entity.HasIndex(h => h.PackageCode);
        });

        modelBuilder.Entity<SystemLog>(entity =>
        {
            entity.Property(l => l.Type).HasConversion<string>();
            entity.HasIndex(l => l.DateTime);
            entity.HasIndex(l => l.UserId);
        });

        modelBuilder.Entity<GdprDocument>(entity =>
        {
            entity.HasIndex(g => g.ValidFrom);
        });

        modelBuilder.Entity<GdprSend>(entity =>
        {
            entity.HasIndex(s => s.GdprDocumentId);
            entity.HasIndex(s => s.UserId);
            entity.HasIndex(s => new { s.GdprDocumentId, s.UserId });
        });
    }
}

