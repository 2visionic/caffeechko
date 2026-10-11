using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Dochazka.Api.Models;

namespace Dochazka.Api.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(DochazkaDbContext context)
    {
        // 1. Company Settings
        if (!await context.CompanySettings.AnyAsync())
        {
            context.CompanySettings.Add(new CompanySetting
            {
                Id = Guid.NewGuid(),
                DefaultWeeklyHours = 40.00m,
                MultiplierWeekend = 200,
                MultiplierHoliday = 200,
                MultiplierWeekendHoliday = 300,
                WorkdayStartTime = "08:00"
            });
            await context.SaveChangesAsync();
        }

        // 2. Workplaces
        var setupWorkplaceId = Guid.Parse("00000000-0000-0000-0000-000000000000");
        if (!await context.Workplaces.AnyAsync(w => w.NfcIdentifier == "setup-0"))
        {
            context.Workplaces.Add(new Workplace
            {
                Id = setupWorkplaceId,
                Name = "Centrála - Setup",
                NfcIdentifier = "setup-0",
                Address = "Virtuální pracoviště",
                IsActive = true
            });
        }

        var prahaWorkplaceId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        if (!await context.Workplaces.AnyAsync(w => w.NfcIdentifier == "praha1"))
        {
            context.Workplaces.Add(new Workplace
            {
                Id = prahaWorkplaceId,
                Name = "Pobočka Praha 1 - Palmovka",
                NfcIdentifier = "praha1",
                NfcHardwareUid = "04A1B2C3D4E5F6",
                Address = "Voctářova 18, Praha 8",
                IsActive = true
            });
        }
        await context.SaveChangesAsync();

        // 3. Absence Types
        if (!await context.AbsenceTypes.AnyAsync())
        {
            context.AbsenceTypes.AddRange(
                new AbsenceType { Id = Guid.NewGuid(), Code = "vacation", NameEmployee = "Dovolená", NameOsvc = "Volno", DurationMode = DurationMode.days, SubmissionOffsetDays = 3, DefaultBudgetPeriod = BudgetPeriod.yearly },
                new AbsenceType { Id = Guid.NewGuid(), Code = "doctor", NameEmployee = "Lékař", NameOsvc = "Lékař", DurationMode = DurationMode.hours, SubmissionOffsetDays = 0, DefaultBudgetPeriod = BudgetPeriod.unlimited },
                new AbsenceType { Id = Guid.NewGuid(), Code = "sick_day", NameEmployee = "Sick day", NameOsvc = "Sick day", DurationMode = DurationMode.days, SubmissionOffsetDays = 0, SubmissionDeadlineHoursBefore = 2, MaxPerMonthLimit = 2, DefaultBudgetPeriod = BudgetPeriod.yearly },
                new AbsenceType { Id = Guid.NewGuid(), Code = "home_office", NameEmployee = "Home office", NameOsvc = "Home office", DurationMode = DurationMode.days, SubmissionOffsetDays = 0, DefaultBudgetPeriod = BudgetPeriod.weekly },
                new AbsenceType { Id = Guid.NewGuid(), Code = "unpaid_leave", NameEmployee = "Neplacené volno", NameOsvc = "Neplacené volno", DurationMode = DurationMode.days, SubmissionOffsetDays = 1, DefaultBudgetPeriod = BudgetPeriod.unlimited },
                new AbsenceType { Id = Guid.NewGuid(), Code = "illness", NameEmployee = "Pracovní neschopnost", NameOsvc = "Pracovní neschopnost", DurationMode = DurationMode.days, SubmissionOffsetDays = 0, DefaultBudgetPeriod = BudgetPeriod.unlimited }
            );
            await context.SaveChangesAsync();
        }

        // 4. Sample Users
        if (!await context.Users.AnyAsync())
        {
            var admin = new User
            {
                Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                Email = "admin@firma.cz",
                FirstName = "Petr",
                LastName = "Kulhánek",
                DisplayName = "Petr Kulhánek",
                PhoneNumber = "+420 777 123 456",
                Role = UserRole.admin,
                ContractKind = ContractKind.employee,
                ContractType = ContractType.full_time,
                CompensationType = CompensationType.fixed_rate,
                FixedMonthlyRate = 95000m,
                WeeklyHoursBudget = 40m
            };

            var lead = new User
            {
                Id = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                Email = "lead@firma.cz",
                FirstName = "Jana",
                LastName = "Nováková",
                DisplayName = "Jana Nováková",
                PhoneNumber = "+420 777 234 567",
                Role = UserRole.team_lead,
                ContractKind = ContractKind.employee,
                ContractType = ContractType.full_time,
                CompensationType = CompensationType.hourly,
                HourlyRate = 650m,
                WeeklyHoursBudget = 40m
            };

            var office = new User
            {
                Id = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                Email = "office@firma.cz",
                FirstName = "Martina",
                LastName = "Svobodová",
                DisplayName = "Martina Svobodová",
                PhoneNumber = "+420 777 345 678",
                Role = UserRole.office_manager,
                ContractKind = ContractKind.employee,
                ContractType = ContractType.full_time,
                CompensationType = CompensationType.fixed_rate,
                FixedMonthlyRate = 55000m,
                WeeklyHoursBudget = 40m
            };

            var colleague = new User
            {
                Id = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
                Email = "kolega@firma.cz",
                FirstName = "Tomáš",
                LastName = "Dvořák",
                DisplayName = "Tomáš Dvořák",
                PhoneNumber = "+420 777 456 789",
                Role = UserRole.colleague,
                ContractKind = ContractKind.employee,
                ContractType = ContractType.full_time,
                CompensationType = CompensationType.hourly,
                HourlyRate = 450m,
                WeeklyHoursBudget = 40m
            };

            var osvc = new User
            {
                Id = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
                Email = "osvc@firma.cz",
                FirstName = "Lukáš",
                LastName = "Černý",
                DisplayName = "Lukáš Černý (OSVČ)",
                PhoneNumber = "+420 777 567 890",
                Role = UserRole.colleague,
                ContractKind = ContractKind.osvc,
                ContractType = ContractType.full_time,
                CompensationType = CompensationType.hourly,
                HourlyRate = 750m,
                WeeklyHoursBudget = 40m
            };

            var martin = new User
            {
                Id = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"),
                Email = "martin.kovar@magicware.cz",
                FirstName = "Martin",
                LastName = "Kovář",
                DisplayName = "Martin Kovář",
                PhoneNumber = "+420 777 678 901",
                Role = UserRole.colleague,
                ContractKind = ContractKind.employee,
                ContractType = ContractType.full_time,
                CompensationType = CompensationType.hourly,
                HourlyRate = 420m,
                WeeklyHoursBudget = 40m
            };

            var david = new User
            {
                Id = Guid.Parse("77777777-7777-7777-7777-777777777777"),
                Email = "david.sykora@magicware.cz",
                FirstName = "David",
                LastName = "Sýkora",
                DisplayName = "David Sýkora",
                PhoneNumber = "+420 777 789 012",
                Role = UserRole.team_lead,
                ContractKind = ContractKind.employee,
                ContractType = ContractType.full_time,
                CompensationType = CompensationType.hourly,
                HourlyRate = 600m,
                WeeklyHoursBudget = 40m
            };

            var eliska = new User
            {
                Id = Guid.Parse("88888888-8888-8888-8888-888888888888"),
                Email = "eliska.kralova@magicware.cz",
                FirstName = "Eliška",
                LastName = "Králová",
                DisplayName = "Eliška Králová",
                PhoneNumber = "+420 777 890 123",
                Role = UserRole.colleague,
                ContractKind = ContractKind.employee,
                ContractType = ContractType.full_time,
                CompensationType = CompensationType.hourly,
                HourlyRate = 400m,
                WeeklyHoursBudget = 40m
            };

            context.Users.AddRange(admin, lead, office, colleague, osvc, martin, david, eliska);

            // Organization links
            context.UserManagers.AddRange(
                new UserManager { Id = Guid.NewGuid(), UserId = colleague.Id, ManagerId = lead.Id },
                new UserManager { Id = Guid.NewGuid(), UserId = martin.Id, ManagerId = lead.Id },
                new UserManager { Id = Guid.NewGuid(), UserId = osvc.Id, ManagerId = lead.Id },
                new UserManager { Id = Guid.NewGuid(), UserId = lead.Id, ManagerId = admin.Id },
                new UserManager { Id = Guid.NewGuid(), UserId = office.Id, ManagerId = admin.Id },
                new UserManager { Id = Guid.NewGuid(), UserId = david.Id, ManagerId = admin.Id },
                new UserManager { Id = Guid.NewGuid(), UserId = eliska.Id, ManagerId = david.Id }
            );

            // Sample Absence Requests
            var vacType = await context.AbsenceTypes.FirstAsync(t => t.Code == "vacation");
            var docType = await context.AbsenceTypes.FirstAsync(t => t.Code == "doctor");

            context.AbsenceRequests.AddRange(
                new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = colleague.Id,
                    AbsenceTypeId = vacType.Id,
                    Status = AbsenceStatus.pending,
                    PlannedStart = new DateTimeOffset(new DateTime(2026, 10, 20), TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(new DateTime(2026, 10, 24), TimeSpan.Zero),
                    Note = "Plánovaná rodinná dovolená po dokončení sprintu 41."
                },
                new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = eliska.Id,
                    AbsenceTypeId = vacType.Id,
                    Status = AbsenceStatus.pending,
                    PlannedStart = new DateTimeOffset(new DateTime(2026, 11, 2), TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(new DateTime(2026, 11, 6), TimeSpan.Zero),
                    Note = "Dovolená po spuštění podzimní marketingové kampaně."
                },
                new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = martin.Id,
                    AbsenceTypeId = docType.Id,
                    Status = AbsenceStatus.pending,
                    PlannedStart = new DateTimeOffset(new DateTime(2026, 10, 14, 8, 30, 0), TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(new DateTime(2026, 10, 14, 11, 30, 0), TimeSpan.Zero),
                    Note = "Ordinace: Stomatologická klinika MUDr. Dvořáková, Praha 1"
                }
            );

            // Today's sample attendance
            var today = DateTimeOffset.UtcNow.Date;
            var todayUtc = new DateTimeOffset(today, TimeSpan.Zero);

            // Admin is currently active at office
            context.TimeEntries.Add(new TimeEntry
            {
                Id = Guid.NewGuid(),
                UserId = admin.Id,
                WorkplaceId = prahaWorkplaceId,
                StartTime = todayUtc.AddHours(8).AddMinutes(15),
                EndTime = null, // open shift
                LocationType = LocationType.office,
                IsManual = false
            });

            // Lead is on Home Office
            context.TimeEntries.Add(new TimeEntry
            {
                Id = Guid.NewGuid(),
                UserId = lead.Id,
                WorkplaceId = null,
                StartTime = todayUtc.AddHours(8).AddMinutes(45),
                EndTime = null,
                LocationType = LocationType.home_office,
                IsManual = false
            });

            // Colleague completed morning shift and is on pause
            context.TimeEntries.Add(new TimeEntry
            {
                Id = Guid.NewGuid(),
                UserId = colleague.Id,
                WorkplaceId = prahaWorkplaceId,
                StartTime = todayUtc.AddHours(8),
                EndTime = todayUtc.AddHours(12),
                LocationType = LocationType.office,
                IsManual = false
            });

            await context.SaveChangesAsync();
        }

        // 5. Name Declensions
        if (!await context.NameDeclensions.AnyAsync())
        {
            context.NameDeclensions.AddRange(
                new NameDeclension { Id = Guid.NewGuid(), Nominative = "petr", Genitive = "Petra", Dative = "Petrovi", Accusative = "Petra", Vocative = "Petře", Locative = "Petrovi", Instrumental = "Petrem" },
                new NameDeclension { Id = Guid.NewGuid(), Nominative = "jana", Genitive = "Jany", Dative = "Janě", Accusative = "Janu", Vocative = "Jano", Locative = "Janě", Instrumental = "Janou" },
                new NameDeclension { Id = Guid.NewGuid(), Nominative = "martina", Genitive = "Martiny", Dative = "Martině", Accusative = "Martinu", Vocative = "Martino", Locative = "Martině", Instrumental = "Martinou" },
                new NameDeclension { Id = Guid.NewGuid(), Nominative = "tomáš", Genitive = "Tomáše", Dative = "Tomášovi", Accusative = "Tomáše", Vocative = "Tomáši", Locative = "Tomášovi", Instrumental = "Tomášem" },
                new NameDeclension { Id = Guid.NewGuid(), Nominative = "lukáš", Genitive = "Lukáše", Dative = "Lukášovi", Accusative = "Lukáše", Vocative = "Lukáši", Locative = "Lukášovi", Instrumental = "Lukášem" }
            );
            await context.SaveChangesAsync();
        }

        // 6. Czech Holidays for 2026
        if (!await context.Holidays.AnyAsync())
        {
            var year = DateTime.UtcNow.Year;
            context.Holidays.AddRange(
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(year, 1, 1), Name = "Den obnovy samostatného českého státu; Nový rok" },
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(year, 5, 1), Name = "Svátek práce" },
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(year, 5, 8), Name = "Den vítězství" },
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(year, 7, 5), Name = "Den slovanských věrozvěstů Cyrila a Metoděje" },
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(year, 7, 6), Name = "Den upálení mistra Jana Husa" },
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(year, 9, 28), Name = "Den české státnosti" },
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(year, 10, 28), Name = "Den vzniku samostatného československého státu" },
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(year, 11, 17), Name = "Den boje za svobodu a demokracii" },
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(year, 12, 24), Name = "Štědrý den" },
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(year, 12, 25), Name = "1. svátek vánoční" },
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(year, 12, 26), Name = "2. svátek vánoční" },
                // 2026 Easter
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(2026, 4, 3), Name = "Velký pátek" },
                new Holiday { Id = Guid.NewGuid(), Date = new DateOnly(2026, 4, 6), Name = "Velikonoční pondělí" }
            );
            await context.SaveChangesAsync();
        }
    }
}
