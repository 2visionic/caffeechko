using Microsoft.EntityFrameworkCore;
using Dochazka.Api.Models;

namespace Dochazka.Api.Data;

public class DochazkaDbContext : DbContext
{
    public DochazkaDbContext(DbContextOptions<DochazkaDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<UserManager> UserManagers => Set<UserManager>();
    public DbSet<NameDeclension> NameDeclensions => Set<NameDeclension>();
    public DbSet<Workplace> Workplaces => Set<Workplace>();
    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();
    public DbSet<AbsenceType> AbsenceTypes => Set<AbsenceType>();
    public DbSet<UserAbsenceSetting> UserAbsenceSettings => Set<UserAbsenceSetting>();
    public DbSet<AbsenceRequest> AbsenceRequests => Set<AbsenceRequest>();
    public DbSet<CompanySetting> CompanySettings => Set<CompanySetting>();
    public DbSet<Holiday> Holidays => Set<Holiday>();
    public DbSet<UserNotificationPreference> UserNotificationPreferences => Set<UserNotificationPreference>();

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

        modelBuilder.Entity<AbsenceType>(entity =>
        {
            entity.HasIndex(a => a.Code).IsUnique();
        });

        modelBuilder.Entity<Holiday>(entity =>
        {
            entity.HasIndex(h => h.Date).IsUnique();
        });
    }
}
