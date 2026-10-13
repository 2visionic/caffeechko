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
                await Add("ManagerId", "TEXT NULL");
                await Add("ParentPersonId", "TEXT NULL");
            }
        }
        catch { }

        // 0a. SQLite migration check for user_managers (ParentPersonId)
        try
        {
            using var conn = context.Database.GetDbConnection();
            await conn.OpenAsync();
            var umCols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "PRAGMA table_info(user_managers);";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    umCols.Add(reader.GetString(1));
                }
            }
            if (umCols.Count > 0 && !umCols.Contains("ParentPersonId"))
            {
                using var alter = conn.CreateCommand();
                alter.CommandText = "ALTER TABLE user_managers ADD COLUMN ParentPersonId TEXT NULL;";
                await alter.ExecuteNonQueryAsync();
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

        // 0c. SQLite schema migration check for company_settings (DefaultVacationDays, DefaultSickDays, DefaultHomeOfficeWeeklyDays)
        try
        {
            using var conn = context.Database.GetDbConnection();
            await conn.OpenAsync();
            var csCols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "PRAGMA table_info(company_settings);";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    csCols.Add(reader.GetString(1));
                }
            }
            if (csCols.Count > 0)
            {
                if (!csCols.Contains("DailyHours"))
                {
                    using var alter = conn.CreateCommand();
                    alter.CommandText = "ALTER TABLE company_settings ADD COLUMN DailyHours TEXT NOT NULL DEFAULT '8.00';";
                    await alter.ExecuteNonQueryAsync();
                }
                if (!csCols.Contains("WeeklyWorkDays"))
                {
                    using var alter = conn.CreateCommand();
                    alter.CommandText = "ALTER TABLE company_settings ADD COLUMN WeeklyWorkDays INTEGER NOT NULL DEFAULT 5;";
                    await alter.ExecuteNonQueryAsync();
                }
                if (!csCols.Contains("DefaultVacationDays"))
                {
                    using var alter = conn.CreateCommand();
                    alter.CommandText = "ALTER TABLE company_settings ADD COLUMN DefaultVacationDays TEXT NOT NULL DEFAULT '20.00';";
                    await alter.ExecuteNonQueryAsync();
                }
                if (!csCols.Contains("DefaultSickDays"))
                {
                    using var alter = conn.CreateCommand();
                    alter.CommandText = "ALTER TABLE company_settings ADD COLUMN DefaultSickDays TEXT NOT NULL DEFAULT '3.00';";
                    await alter.ExecuteNonQueryAsync();
                }
                if (!csCols.Contains("DefaultHomeOfficeWeeklyDays"))
                {
                    using var alter = conn.CreateCommand();
                    alter.CommandText = "ALTER TABLE company_settings ADD COLUMN DefaultHomeOfficeWeeklyDays TEXT NOT NULL DEFAULT '2.00';";
                    await alter.ExecuteNonQueryAsync();
                }
            }
        }
        catch { }

        // 0d. Synchronizace SQLite schématu šablony dochazka_dev.template.db
        try
        {
            var templateCandidates = new[]
            {
                "dochazka_dev.template.db",
                System.IO.Path.Combine("backend", "dochazka_dev.template.db"),
                System.IO.Path.Combine(AppContext.BaseDirectory, "dochazka_dev.template.db")
            };
            var tmplPath = templateCandidates.FirstOrDefault(System.IO.File.Exists);
            if (tmplPath != null)
            {
                using var tmplConn = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={tmplPath}");
                await tmplConn.OpenAsync();
                var csCols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                using (var cmd = tmplConn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA table_info(company_settings);";
                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        csCols.Add(reader.GetString(1));
                    }
                }
                if (csCols.Count > 0)
                {
                    if (!csCols.Contains("DailyHours"))
                    {
                        using var alter = tmplConn.CreateCommand();
                        alter.CommandText = "ALTER TABLE company_settings ADD COLUMN DailyHours TEXT NOT NULL DEFAULT '8.00';";
                        await alter.ExecuteNonQueryAsync();
                    }
                    if (!csCols.Contains("WeeklyWorkDays"))
                    {
                        using var alter = tmplConn.CreateCommand();
                        alter.CommandText = "ALTER TABLE company_settings ADD COLUMN WeeklyWorkDays INTEGER NOT NULL DEFAULT 5;";
                        await alter.ExecuteNonQueryAsync();
                    }
                    if (!csCols.Contains("DefaultVacationDays"))
                    {
                        using var alter = tmplConn.CreateCommand();
                        alter.CommandText = "ALTER TABLE company_settings ADD COLUMN DefaultVacationDays TEXT NOT NULL DEFAULT '20.00';";
                        await alter.ExecuteNonQueryAsync();
                    }
                    if (!csCols.Contains("DefaultSickDays"))
                    {
                        using var alter = tmplConn.CreateCommand();
                        alter.CommandText = "ALTER TABLE company_settings ADD COLUMN DefaultSickDays TEXT NOT NULL DEFAULT '3.00';";
                        await alter.ExecuteNonQueryAsync();
                    }
                    if (!csCols.Contains("DefaultHomeOfficeWeeklyDays"))
                    {
                        using var alter = tmplConn.CreateCommand();
                        alter.CommandText = "ALTER TABLE company_settings ADD COLUMN DefaultHomeOfficeWeeklyDays TEXT NOT NULL DEFAULT '2.00';";
                        await alter.ExecuteNonQueryAsync();
                    }
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
                DailyHours = 8.00m,
                WeeklyWorkDays = 5,
                DefaultVacationDays = 20.00m,
                DefaultSickDays = 3.00m,
                DefaultHomeOfficeWeeklyDays = 2.00m
            });
            await context.SaveChangesAsync();
        }
        else
        {
            var cs = await context.CompanySettings.FirstOrDefaultAsync();
            if (cs != null)
            {
                bool changed = false;
                if (cs.DailyHours <= 0) { cs.DailyHours = 8.00m; changed = true; }
                if (cs.WeeklyWorkDays <= 0) { cs.WeeklyWorkDays = 5; changed = true; }
                if (cs.DefaultVacationDays <= 0) { cs.DefaultVacationDays = 20.00m; changed = true; }
                if (cs.DefaultSickDays <= 0) { cs.DefaultSickDays = 3.00m; changed = true; }
                if (cs.DefaultHomeOfficeWeeklyDays <= 0) { cs.DefaultHomeOfficeWeeklyDays = 2.00m; changed = true; }
                if (changed) await context.SaveChangesAsync();
            }
        }

        // 1b. Contract Types (Úvazky a koeficienty: full_time=1.0, half_time=0.5, part_time=0.25)
        try
        {
            using var conn = context.Database.GetDbConnection();
            await conn.OpenAsync();
            var ctCols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "PRAGMA table_info(contract_types);";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    ctCols.Add(reader.GetString(1));
                }
            }
            if (ctCols.Contains("DailyHours") || ctCols.Contains("WeeklyHours"))
            {
                using var dropCmd = conn.CreateCommand();
                dropCmd.CommandText = "DROP TABLE IF EXISTS contract_types;";
                await dropCmd.ExecuteNonQueryAsync();
            }

            using var createCmd = conn.CreateCommand();
            createCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS contract_types (
                    Id TEXT PRIMARY KEY,
                    Code TEXT NOT NULL UNIQUE,
                    Name TEXT NOT NULL,
                    Coefficient TEXT NOT NULL DEFAULT '1.00'
                );";
            await createCmd.ExecuteNonQueryAsync();
        }
        catch { }

        if (!await context.ContractTypes.AnyAsync())
        {
            context.ContractTypes.AddRange(
                new ContractTypeSetting
                {
                    Id = Guid.NewGuid(),
                    Code = "full_time",
                    Name = "Plný úvazek (1.0)",
                    Coefficient = 1.00m
                },
                new ContractTypeSetting
                {
                    Id = Guid.NewGuid(),
                    Code = "half_time",
                    Name = "Poloviční úvazek (0.5)",
                    Coefficient = 0.50m
                },
                new ContractTypeSetting
                {
                    Id = Guid.NewGuid(),
                    Code = "part_time",
                    Name = "Zkrácený úvazek (0.25)",
                    Coefficient = 0.25m
                }
            );
            await context.SaveChangesAsync();
        }

        // 1c. Ensure Tomas Dvorak (half_time) and Martin Kovar (part_time) settings
        var tomas = await context.Users.FirstOrDefaultAsync(u => u.Id == Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"));
        if (tomas != null && (tomas.ContractType != ContractType.half_time || tomas.WeeklyHoursBudget != 20.00m))
        {
            tomas.ContractType = ContractType.half_time;
            tomas.WeeklyHoursBudget = 20.00m;
        }

        var martin = await context.Users.FirstOrDefaultAsync(u => u.Id == Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"));
        if (martin != null && (martin.ContractType != ContractType.part_time || martin.WeeklyHoursBudget != 10.00m))
        {
            martin.ContractType = ContractType.part_time;
            martin.WeeklyHoursBudget = 10.00m;
        }
        await context.SaveChangesAsync();

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

        var brnoWorkplaceId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        if (!await context.Workplaces.AnyAsync(w => w.NfcIdentifier == "brno1"))
        {
            context.Workplaces.Add(new Workplace
            {
                Id = brnoWorkplaceId,
                Name = "Pobočka Brno - Spielberk",
                NfcIdentifier = "brno1",
                NfcHardwareUid = "04B1C2D3E4F5A6",
                Address = "Holandská 10, Brno",
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

        // 4. Name Declensions (Standard Czech language dictionary)
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
            var year = DateTimeOffset.UtcNow.Year;
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


