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
        // 0. Automatická migrace schématu pro SQLite (přidání nových sloupců do existující DB)
        try
        {
            using var conn = context.Database.GetDbConnection();
            await conn.OpenAsync();
            var cols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "PRAGMA table_info(users);";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    cols.Add(reader.GetString(1));
                }
            }
            if (cols.Count > 0)
            {
                async Task Add(string name, string def)
                {
                    if (!cols.Contains(name))
                    {
                        using var alter = conn.CreateCommand();
                        alter.CommandText = $"ALTER TABLE users ADD COLUMN {name} {def};";
                        await alter.ExecuteNonQueryAsync();
                    }
                }
                await Add("IsApproved", "INTEGER NOT NULL DEFAULT 1");
                await Add("ApprovedAt", "TEXT NULL");
                await Add("ApprovedBy", "TEXT NULL");
                await Add("GoogleId", "TEXT NULL");
            }
        }
        catch { }

        // 0b. SQLite schema migration check for user_absence_settings (Year, CarriedOverDays)
        try
        {
            using var conn = context.Database.GetDbConnection();
            await conn.OpenAsync();
            var uasCols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "PRAGMA table_info(user_absence_settings);";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    uasCols.Add(reader.GetString(1));
                }
            }
            if (uasCols.Count > 0)
            {
                if (!uasCols.Contains("Year"))
                {
                    using var alter = conn.CreateCommand();
                    alter.CommandText = "ALTER TABLE user_absence_settings ADD COLUMN Year INTEGER NOT NULL DEFAULT 2026;";
                    await alter.ExecuteNonQueryAsync();
                }
                if (!uasCols.Contains("CarriedOverDays"))
                {
                    using var alter = conn.CreateCommand();
                    alter.CommandText = "ALTER TABLE user_absence_settings ADD COLUMN CarriedOverDays TEXT NOT NULL DEFAULT '0.00';";
                    await alter.ExecuteNonQueryAsync();
                }
            }
        }
        catch { }

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
                FirstName = "Jan",
                LastName = "Novotný",
                DisplayName = "Jan Novotný",
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
                Email = "martin.kovar@firma.cz",
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
                Email = "david.sykora@firma.cz",
                FirstName = "David",
                LastName = "Sýkora",
                DisplayName = "David Sýkora",
                PhoneNumber = "+420 777 789 012",
                Role = UserRole.manager,
                ContractKind = ContractKind.employee,
                ContractType = ContractType.full_time,
                CompensationType = CompensationType.hourly,
                HourlyRate = 600m,
                WeeklyHoursBudget = 40m
            };

            var eliska = new User
            {
                Id = Guid.Parse("88888888-8888-8888-8888-888888888888"),
                Email = "eliska.kralova@firma.cz",
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

            // Organization links (user_managers)
            // Note: Petr Kulhánek (admin), David Sýkora (manager), Martina Svobodová (office) do not report to anyone
            context.UserManagers.AddRange(
                new UserManager { Id = Guid.NewGuid(), UserId = colleague.Id, ManagerId = lead.Id },
                new UserManager { Id = Guid.NewGuid(), UserId = martin.Id, ManagerId = lead.Id },
                new UserManager { Id = Guid.NewGuid(), UserId = osvc.Id, ManagerId = lead.Id },
                new UserManager { Id = Guid.NewGuid(), UserId = lead.Id, ManagerId = david.Id },
                new UserManager { Id = Guid.NewGuid(), UserId = eliska.Id, ManagerId = david.Id }
            );

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

        // 7. User Absence Settings (fondy dovolené a sick days pro persony)
        if (!await context.UserAbsenceSettings.AnyAsync())
        {
            var vacType = await context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "vacation");
            var sickType = await context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "sick_day");
            var hoType = await context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "home_office");

            if (vacType != null && sickType != null)
            {
                var users = await context.Users.ToListAsync();
                foreach (var u in users)
                {
                    bool isOsvc = u.ContractKind == ContractKind.osvc;
                    decimal vacCap = isOsvc ? 0m : (u.Role == UserRole.admin ? 25m : 20m);
                    decimal sickCap = isOsvc ? 0m : 3m;

                    context.UserAbsenceSettings.Add(new UserAbsenceSetting
                    {
                        Id = Guid.NewGuid(),
                        UserId = u.Id,
                        AbsenceTypeId = vacType.Id,
                        Year = 2026,
                        BudgetPeriod = BudgetPeriod.yearly,
                        AllocatedCapacity = vacCap,
                        CarriedOverDays = 0m,
                        IsPaid = !isOsvc
                    });

                    context.UserAbsenceSettings.Add(new UserAbsenceSetting
                    {
                        Id = Guid.NewGuid(),
                        UserId = u.Id,
                        AbsenceTypeId = sickType.Id,
                        Year = 2026,
                        BudgetPeriod = BudgetPeriod.yearly,
                        AllocatedCapacity = sickCap,
                        CarriedOverDays = 0m,
                        MaxPerMonthOverride = 2,
                        IsPaid = !isOsvc
                    });

                    if (hoType != null)
                    {
                        context.UserAbsenceSettings.Add(new UserAbsenceSetting
                        {
                            Id = Guid.NewGuid(),
                            UserId = u.Id,
                            AbsenceTypeId = hoType.Id,
                            Year = 2026,
                            BudgetPeriod = BudgetPeriod.weekly,
                            AllocatedCapacity = isOsvc ? 5m : 2m,
                            CarriedOverDays = 0m,
                            IsPaid = true
                        });
                    }
                }
                await context.SaveChangesAsync();
            }
        }

        // 8. Sample Absence Requests (historické i čekající žádosti pro ukázkové scénáře)
        if (!await context.AbsenceRequests.AnyAsync())
        {
            var vacType = await context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "vacation");
            var sickType = await context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "sick_day");
            var docType = await context.AbsenceTypes.FirstOrDefaultAsync(t => t.Code == "doctor");

            var leadId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"); // Jana Nováková
            var officeId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"); // Martina Svobodová
            var tomasId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"); // Tomáš Dvořák
            var martinId = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"); // Martin Kovář
            var davidId = Guid.Parse("77777777-7777-7777-7777-777777777777"); // David Sýkora
            var eliskaId = Guid.Parse("88888888-8888-8888-8888-888888888888"); // Eliška Králová

            var sampleRequests = new List<AbsenceRequest>();

            // Tomáš Dvořák: 8 dní dovolená (schváleno) -> zbývá 12 z 20
            if (vacType != null)
            {
                sampleRequests.Add(new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = tomasId,
                    AbsenceTypeId = vacType.Id,
                    Status = AbsenceStatus.completed,
                    PlannedStart = new DateTimeOffset(2026, 7, 6, 0, 0, 0, TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(2026, 7, 15, 0, 0, 0, TimeSpan.Zero),
                    ApprovedBy = leadId,
                    ApprovedAt = new DateTimeOffset(2026, 6, 20, 10, 0, 0, TimeSpan.Zero),
                    Note = "Letní rodinná dovolená."
                });
            }

            // Tomáš Dvořák: 1 den sick day (vyčerpáno) -> zbývá 2 ze 3
            if (sickType != null)
            {
                sampleRequests.Add(new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = tomasId,
                    AbsenceTypeId = sickType.Id,
                    Status = AbsenceStatus.completed,
                    PlannedStart = new DateTimeOffset(2026, 3, 10, 0, 0, 0, TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(2026, 3, 10, 0, 0, 0, TimeSpan.Zero),
                    ApprovedBy = leadId,
                    ApprovedAt = new DateTimeOffset(2026, 3, 10, 7, 0, 0, TimeSpan.Zero),
                    Note = "Zdravotní indispozice (nachlazení)."
                });
            }

            // Tomáš Dvořák: Návštěva lékaře (ověřeno office managerkou)
            if (docType != null)
            {
                sampleRequests.Add(new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = tomasId,
                    AbsenceTypeId = docType.Id,
                    Status = AbsenceStatus.completed,
                    PlannedStart = new DateTimeOffset(2026, 2, 15, 8, 30, 0, TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(2026, 2, 15, 11, 30, 0, TimeSpan.Zero),
                    VerifiedBy = officeId,
                    VerifiedAt = new DateTimeOffset(2026, 2, 15, 13, 0, 0, TimeSpan.Zero),
                    Note = "Ordinace: Poliklinika Karlín, ortopedie"
                });
            }

            // Martin Kovář: 5 dní dovolená (schváleno) -> zbývá 15 z 20
            if (vacType != null)
            {
                sampleRequests.Add(new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = martinId,
                    AbsenceTypeId = vacType.Id,
                    Status = AbsenceStatus.completed,
                    PlannedStart = new DateTimeOffset(2026, 6, 1, 0, 0, 0, TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(2026, 6, 5, 0, 0, 0, TimeSpan.Zero),
                    ApprovedBy = leadId,
                    ApprovedAt = new DateTimeOffset(2026, 5, 15, 9, 30, 0, TimeSpan.Zero),
                    Note = "Dovolená v Krkonoších."
                });

                // Martin Kovář: 3 dny dovolená (ČEKÁ NA SCHVÁLENÍ u Jany Novákové!)
                sampleRequests.Add(new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = martinId,
                    AbsenceTypeId = vacType.Id,
                    Status = AbsenceStatus.pending,
                    PlannedStart = new DateTimeOffset(2026, 11, 2, 0, 0, 0, TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(2026, 11, 4, 0, 0, 0, TimeSpan.Zero),
                    Note = "Prodloužený víkend na chalupě."
                });
            }

            // Martina Svobodová (Office Manager): 2 dny dovolená (schváleno) -> zbývá 18 z 20
            if (vacType != null)
            {
                sampleRequests.Add(new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = officeId,
                    AbsenceTypeId = vacType.Id,
                    Status = AbsenceStatus.completed,
                    PlannedStart = new DateTimeOffset(2026, 5, 4, 0, 0, 0, TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(2026, 5, 5, 0, 0, 0, TimeSpan.Zero),
                    ApprovedBy = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                    ApprovedAt = new DateTimeOffset(2026, 4, 25, 11, 0, 0, TimeSpan.Zero),
                    Note = "Krátké volno."
                });
            }

            // Martina Svobodová: 1 den sick day -> zbývá 2 ze 3
            if (sickType != null)
            {
                sampleRequests.Add(new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = officeId,
                    AbsenceTypeId = sickType.Id,
                    Status = AbsenceStatus.completed,
                    PlannedStart = new DateTimeOffset(2026, 1, 20, 0, 0, 0, TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(2026, 1, 20, 0, 0, 0, TimeSpan.Zero),
                    Note = "Horečka."
                });
            }

            // Jana Nováková (Team Lead): 4 dny dovolená (schváleno Davidem Sýkorou) -> zbývá 16 z 20
            if (vacType != null)
            {
                sampleRequests.Add(new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = leadId,
                    AbsenceTypeId = vacType.Id,
                    Status = AbsenceStatus.completed,
                    PlannedStart = new DateTimeOffset(2026, 8, 10, 0, 0, 0, TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(2026, 8, 13, 0, 0, 0, TimeSpan.Zero),
                    ApprovedBy = davidId,
                    ApprovedAt = new DateTimeOffset(2026, 7, 28, 14, 0, 0, TimeSpan.Zero),
                    Note = "Dovolená Šumava."
                });
            }

            // Eliška Králová: 3 dny dovolená (schváleno Davidem Sýkorou) -> zbývá 17 z 20
            if (vacType != null)
            {
                sampleRequests.Add(new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = eliskaId,
                    AbsenceTypeId = vacType.Id,
                    Status = AbsenceStatus.completed,
                    PlannedStart = new DateTimeOffset(2026, 9, 1, 0, 0, 0, TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(2026, 9, 3, 0, 0, 0, TimeSpan.Zero),
                    ApprovedBy = davidId,
                    ApprovedAt = new DateTimeOffset(2026, 8, 20, 15, 0, 0, TimeSpan.Zero),
                    Note = "Pozdní letní dovolená."
                });
            }

            // Eliška Králová: Návštěva lékaře (ČEKÁ NA OVĚŘENÍ dokladu u Office Managerky Martiny!)
            if (docType != null)
            {
                sampleRequests.Add(new AbsenceRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = eliskaId,
                    AbsenceTypeId = docType.Id,
                    Status = AbsenceStatus.pending,
                    PlannedStart = new DateTimeOffset(2026, 10, 15, 9, 0, 0, TimeSpan.Zero),
                    PlannedEnd = new DateTimeOffset(2026, 10, 15, 12, 0, 0, TimeSpan.Zero),
                    Note = "Ordinace: MUDr. Dvořáková, zubní klinika"
                });
            }

            context.AbsenceRequests.AddRange(sampleRequests);
            await context.SaveChangesAsync();
        }
    }
}
