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
                if (!cols.Contains("IsPermanentHomeOffice"))
                {
                    await Add("IsPermanentHomeOffice", "INTEGER NOT NULL DEFAULT 0");
                    using var seedHo = conn.CreateCommand();
                    seedHo.CommandText = "UPDATE users SET IsPermanentHomeOffice = 1 WHERE lower(Id) = '88888888-8888-8888-8888-888888888888';";
                    await seedHo.ExecuteNonQueryAsync();
                }
                if (!cols.Contains("IsFemale"))
                {
                    await Add("IsFemale", "INTEGER NOT NULL DEFAULT 0");
                    using var seedFem = conn.CreateCommand();
                    seedFem.CommandText = "UPDATE users SET IsFemale = 1 WHERE LastName LIKE '%á' OR DisplayName LIKE '%á';";
                    await seedFem.ExecuteNonQueryAsync();
                }
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

        // 0c. SQLite schema migration check for company_settings, absence_requests, time_entries, edit logs, absence_types, holidays
        try
        {
            using var conn = context.Database.GetDbConnection();
            await conn.OpenAsync();
            await MigrateCompanySettingsTableAsync(conn);

            // Tabulky logs, absence_edit_logs, time_entry_edit_logs
            using (var createLogsCmd = conn.CreateCommand())
            {
                createLogsCmd.CommandText = @"
                    CREATE TABLE IF NOT EXISTS logs (
                        Id TEXT PRIMARY KEY,
                        UserId TEXT NOT NULL DEFAULT '0',
                        Type TEXT NOT NULL,
                        Status TEXT NOT NULL,
                        DateTime TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS IX_logs_DateTime ON logs (DateTime);
                    CREATE INDEX IF NOT EXISTS IX_logs_UserId ON logs (UserId);
                    CREATE TABLE IF NOT EXISTS absence_edit_logs (
                        Id TEXT PRIMARY KEY,
                        AbsenceRequestId TEXT NOT NULL,
                        EditedByUserId TEXT NOT NULL,
                        EditedByUserName TEXT NOT NULL,
                        EditedAt TEXT NOT NULL,
                        ChangesSummary TEXT NULL
                    );
                    CREATE INDEX IF NOT EXISTS IX_absence_edit_logs_AbsenceRequestId ON absence_edit_logs (AbsenceRequestId);
                    CREATE TABLE IF NOT EXISTS time_entry_edit_logs (
                        Id TEXT PRIMARY KEY,
                        TimeEntryId TEXT NOT NULL,
                        EditedByUserId TEXT NOT NULL,
                        EditedByUserName TEXT NOT NULL,
                        EditedAt TEXT NOT NULL,
                        ChangesSummary TEXT NULL
                    );
                    CREATE INDEX IF NOT EXISTS IX_time_entry_edit_logs_TimeEntryId ON time_entry_edit_logs (TimeEntryId);";
                await createLogsCmd.ExecuteNonQueryAsync();
            }

            // Sloupce IsRead, CreatedAt, IsDeleted, DeletedAt, DeletedBy u absence_requests
            var arCols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using (var arCmd = conn.CreateCommand())
            {
                arCmd.CommandText = "PRAGMA table_info(absence_requests);";
                using var arReader = await arCmd.ExecuteReaderAsync();
                while (await arReader.ReadAsync())
                {
                    arCols.Add(arReader.GetString(1));
                }
            }
            if (arCols.Count > 0 && !arCols.Contains("IsRead"))
            {
                using var alterAr = conn.CreateCommand();
                alterAr.CommandText = "ALTER TABLE absence_requests ADD COLUMN IsRead INTEGER NOT NULL DEFAULT 0;";
                await alterAr.ExecuteNonQueryAsync();
            }
            if (arCols.Count > 0 && !arCols.Contains("CreatedAt"))
            {
                using var alterAr = conn.CreateCommand();
                alterAr.CommandText = "ALTER TABLE absence_requests ADD COLUMN CreatedAt TEXT NULL;";
                await alterAr.ExecuteNonQueryAsync();
                using var initAr = conn.CreateCommand();
                initAr.CommandText = "UPDATE absence_requests SET CreatedAt = COALESCE(ApprovedAt, PlannedStart) WHERE CreatedAt IS NULL;";
                await initAr.ExecuteNonQueryAsync();
            }
            if (arCols.Count > 0 && !arCols.Contains("IsDeleted"))
            {
                using var alterAr = conn.CreateCommand();
                alterAr.CommandText = "ALTER TABLE absence_requests ADD COLUMN IsDeleted INTEGER NOT NULL DEFAULT 0;";
                await alterAr.ExecuteNonQueryAsync();
            }
            if (arCols.Count > 0 && !arCols.Contains("DeletedAt"))
            {
                using var alterAr = conn.CreateCommand();
                alterAr.CommandText = "ALTER TABLE absence_requests ADD COLUMN DeletedAt TEXT NULL;";
                await alterAr.ExecuteNonQueryAsync();
            }
            if (arCols.Count > 0 && !arCols.Contains("DeletedBy"))
            {
                using var alterAr = conn.CreateCommand();
                alterAr.CommandText = "ALTER TABLE absence_requests ADD COLUMN DeletedBy TEXT NULL;";
                await alterAr.ExecuteNonQueryAsync();
            }

            // Sloupce IsDeleted, DeletedAt, DeletedBy u time_entries
            var teCols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using (var teCmd = conn.CreateCommand())
            {
                teCmd.CommandText = "PRAGMA table_info(time_entries);";
                using var teReader = await teCmd.ExecuteReaderAsync();
                while (await teReader.ReadAsync())
                {
                    teCols.Add(teReader.GetString(1));
                }
            }
            if (teCols.Count > 0 && !teCols.Contains("IsDeleted"))
            {
                using var alterTe = conn.CreateCommand();
                alterTe.CommandText = "ALTER TABLE time_entries ADD COLUMN IsDeleted INTEGER NOT NULL DEFAULT 0;";
                await alterTe.ExecuteNonQueryAsync();
            }
            if (teCols.Count > 0 && !teCols.Contains("DeletedAt"))
            {
                using var alterTe = conn.CreateCommand();
                alterTe.CommandText = "ALTER TABLE time_entries ADD COLUMN DeletedAt TEXT NULL;";
                await alterTe.ExecuteNonQueryAsync();
            }
            if (teCols.Count > 0 && !teCols.Contains("DeletedBy"))
            {
                using var alterTe = conn.CreateCommand();
                alterTe.CommandText = "ALTER TABLE time_entries ADD COLUMN DeletedBy TEXT NULL;";
                await alterTe.ExecuteNonQueryAsync();
            }

            // Migrace tabulky absence_types (AllowOsvc bool místo NameOsvc, Nemoc místo Pracovní neschopnost, Home office offset 1)
            await MigrateAbsenceTypesTableAsync(conn);

            // Tabulka holidays s plovoucími pravidly (Rule) a balíčkem svátků (PackageCode)
            await Dochazka.Api.Services.HolidayService.EnsureSqliteHolidaysSchemaAndPackageAsync(conn, "cz", seedPackageRows: true);
        }
        catch { }

        // 0d. Automatická synchronizace SQLite schématu šablon (dochazka_clean.template.db a dochazka_dev.template.db)
        try
        {
            var templateFiles = new[]
            {
                "dochazka_clean.template.db",
                System.IO.Path.Combine("backend", "dochazka_clean.template.db"),
                System.IO.Path.Combine(AppContext.BaseDirectory, "dochazka_clean.template.db"),
                "dochazka_dev.template.db",
                System.IO.Path.Combine("backend", "dochazka_dev.template.db"),
                System.IO.Path.Combine(AppContext.BaseDirectory, "dochazka_dev.template.db")
            }
            .Where(System.IO.File.Exists)
            .Select(System.IO.Path.GetFullPath)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

            foreach (var tmplPath in templateFiles)
            {
                using var tmplConn = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={tmplPath};Pooling=False");
                await tmplConn.OpenAsync();
                await MigrateCompanySettingsTableAsync(tmplConn);

                // Sloupce u users v šabloně
                var tmplUCols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                using (var tmplUCmd = tmplConn.CreateCommand())
                {
                    tmplUCmd.CommandText = "PRAGMA table_info(users);";
                    using var tmplUReader = await tmplUCmd.ExecuteReaderAsync();
                    while (await tmplUReader.ReadAsync())
                    {
                        tmplUCols.Add(tmplUReader.GetString(1));
                    }
                }
                if (tmplUCols.Count > 0 && !tmplUCols.Contains("IsPermanentHomeOffice"))
                {
                    using var alterU = tmplConn.CreateCommand();
                    alterU.CommandText = "ALTER TABLE users ADD COLUMN IsPermanentHomeOffice INTEGER NOT NULL DEFAULT 0; UPDATE users SET IsPermanentHomeOffice = 1 WHERE lower(Id) = '88888888-8888-8888-8888-888888888888';";
                    await alterU.ExecuteNonQueryAsync();
                }
                if (tmplUCols.Count > 0 && !tmplUCols.Contains("IsFemale"))
                {
                    using var alterU = tmplConn.CreateCommand();
                    alterU.CommandText = "ALTER TABLE users ADD COLUMN IsFemale INTEGER NOT NULL DEFAULT 0; UPDATE users SET IsFemale = 1 WHERE LastName LIKE '%á' OR DisplayName LIKE '%á';";
                    await alterU.ExecuteNonQueryAsync();
                }

                // Sloupec IsRead, CreatedAt, IsDeleted u absence_requests v šabloně (pokud tabulka existuje)
                var tmplArCols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                using (var tmplArCmd = tmplConn.CreateCommand())
                {
                    tmplArCmd.CommandText = "PRAGMA table_info(absence_requests);";
                    using var tmplArReader = await tmplArCmd.ExecuteReaderAsync();
                    while (await tmplArReader.ReadAsync())
                    {
                        tmplArCols.Add(tmplArReader.GetString(1));
                    }
                }
                if (tmplArCols.Count > 0 && !tmplArCols.Contains("IsRead"))
                {
                    using var alterTmplAr = tmplConn.CreateCommand();
                    alterTmplAr.CommandText = "ALTER TABLE absence_requests ADD COLUMN IsRead INTEGER NOT NULL DEFAULT 0;";
                    await alterTmplAr.ExecuteNonQueryAsync();
                }
                if (tmplArCols.Count > 0 && !tmplArCols.Contains("CreatedAt"))
                {
                    using var alterTmplAr = tmplConn.CreateCommand();
                    alterTmplAr.CommandText = "ALTER TABLE absence_requests ADD COLUMN CreatedAt TEXT NULL;";
                    await alterTmplAr.ExecuteNonQueryAsync();
                }
                if (tmplArCols.Count > 0 && !tmplArCols.Contains("IsDeleted"))
                {
                    using var alterTmplAr = tmplConn.CreateCommand();
                    alterTmplAr.CommandText = "ALTER TABLE absence_requests ADD COLUMN IsDeleted INTEGER NOT NULL DEFAULT 0; ALTER TABLE absence_requests ADD COLUMN DeletedAt TEXT NULL; ALTER TABLE absence_requests ADD COLUMN DeletedBy TEXT NULL;";
                    await alterTmplAr.ExecuteNonQueryAsync();
                }

                // Sloupec IsDeleted u time_entries v šabloně
                var tmplTeCols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                using (var tmplTeCmd = tmplConn.CreateCommand())
                {
                    tmplTeCmd.CommandText = "PRAGMA table_info(time_entries);";
                    using var tmplTeReader = await tmplTeCmd.ExecuteReaderAsync();
                    while (await tmplTeReader.ReadAsync())
                    {
                        tmplTeCols.Add(tmplTeReader.GetString(1));
                    }
                }
                if (tmplTeCols.Count > 0 && !tmplTeCols.Contains("IsDeleted"))
                {
                    using var alterTmplTe = tmplConn.CreateCommand();
                    alterTmplTe.CommandText = "ALTER TABLE time_entries ADD COLUMN IsDeleted INTEGER NOT NULL DEFAULT 0; ALTER TABLE time_entries ADD COLUMN DeletedAt TEXT NULL; ALTER TABLE time_entries ADD COLUMN DeletedBy TEXT NULL;";
                    await alterTmplTe.ExecuteNonQueryAsync();
                }

                bool isDevTemplate = !tmplPath.Contains("clean", StringComparison.OrdinalIgnoreCase);
                await MigrateAbsenceTypesTableAsync(tmplConn, seedDefaultsIfEmpty: isDevTemplate);

                // Předpřipravená tabulka contract_types, logs a edit_logs v šablonové databázi
                using (var tmplTablesCmd = tmplConn.CreateCommand())
                {
                    tmplTablesCmd.CommandText = @"
                        CREATE TABLE IF NOT EXISTS contract_types (
                            Id TEXT PRIMARY KEY,
                            Code TEXT NOT NULL UNIQUE,
                            Name TEXT NOT NULL,
                            Coefficient TEXT NOT NULL DEFAULT '1.00'
                        );
                        UPDATE contract_types SET Name = 'Plný úvazek' WHERE Code = 'full_time' AND Name LIKE '%(%';
                        UPDATE contract_types SET Name = 'Poloviční úvazek' WHERE Code = 'half_time' AND Name LIKE '%(%';
                        UPDATE contract_types SET Name = 'Zkrácený úvazek' WHERE Code = 'part_time' AND Name LIKE '%(%';
                        CREATE TABLE IF NOT EXISTS logs (
                            Id TEXT PRIMARY KEY,
                            UserId TEXT NOT NULL DEFAULT '0',
                            Type TEXT NOT NULL,
                            Status TEXT NOT NULL,
                            DateTime TEXT NOT NULL
                        );
                        CREATE INDEX IF NOT EXISTS IX_logs_DateTime ON logs (DateTime);
                        CREATE INDEX IF NOT EXISTS IX_logs_UserId ON logs (UserId);
                        CREATE TABLE IF NOT EXISTS absence_edit_logs (
                            Id TEXT PRIMARY KEY,
                            AbsenceRequestId TEXT NOT NULL,
                            EditedByUserId TEXT NOT NULL,
                            EditedByUserName TEXT NOT NULL,
                            EditedAt TEXT NOT NULL,
                            ChangesSummary TEXT NULL
                        );
                        CREATE INDEX IF NOT EXISTS IX_absence_edit_logs_AbsenceRequestId ON absence_edit_logs (AbsenceRequestId);
                        CREATE TABLE IF NOT EXISTS time_entry_edit_logs (
                            Id TEXT PRIMARY KEY,
                            TimeEntryId TEXT NOT NULL,
                            EditedByUserId TEXT NOT NULL,
                            EditedByUserName TEXT NOT NULL,
                            EditedAt TEXT NOT NULL,
                            ChangesSummary TEXT NULL
                        );
                        CREATE INDEX IF NOT EXISTS IX_time_entry_edit_logs_TimeEntryId ON time_entry_edit_logs (TimeEntryId);";
                    await tmplTablesCmd.ExecuteNonQueryAsync();
                }

                await Dochazka.Api.Services.HolidayService.EnsureSqliteHolidaysSchemaAndPackageAsync(tmplConn, "cz", seedPackageRows: isDevTemplate);

                using (var checkpointCmd = tmplConn.CreateCommand())
                {
                    checkpointCmd.CommandText = "PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;";
                    await checkpointCmd.ExecuteNonQueryAsync();
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
                WeeklyWorkDays = 5
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
                );
                UPDATE contract_types SET Name = 'Plný úvazek' WHERE Code = 'full_time' AND Name LIKE '%(%';
                UPDATE contract_types SET Name = 'Poloviční úvazek' WHERE Code = 'half_time' AND Name LIKE '%(%';
                UPDATE contract_types SET Name = 'Zkrácený úvazek' WHERE Code = 'part_time' AND Name LIKE '%(%';";
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
                    Name = "Plný úvazek",
                    Coefficient = 1.00m
                },
                new ContractTypeSetting
                {
                    Id = Guid.NewGuid(),
                    Code = "half_time",
                    Name = "Poloviční úvazek",
                    Coefficient = 0.50m
                },
                new ContractTypeSetting
                {
                    Id = Guid.NewGuid(),
                    Code = "part_time",
                    Name = "Zkrácený úvazek",
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
        var defaultAbsenceTypes = new[]
        {
            new AbsenceType { Id = Guid.NewGuid(), Code = "vacation", NameEmployee = "Dovolená", AllowOsvc = true, DurationMode = DurationMode.days, SubmissionOffsetDays = 3, SubmissionDeadlineTime = null, DefaultBudgetPeriod = BudgetPeriod.yearly, DefaultAllowance = 20 },
            new AbsenceType { Id = Guid.NewGuid(), Code = "doctor", NameEmployee = "Lékař", AllowOsvc = false, DurationMode = DurationMode.hours, SubmissionOffsetDays = 0, SubmissionDeadlineTime = null, DefaultBudgetPeriod = BudgetPeriod.unlimited, DefaultAllowance = null },
            new AbsenceType { Id = Guid.NewGuid(), Code = "sick_day", NameEmployee = "Sick day", AllowOsvc = true, DurationMode = DurationMode.single_day, SubmissionOffsetDays = 0, SubmissionDeadlineTime = "09:00:00", MaxPerMonthLimit = 2, DefaultBudgetPeriod = BudgetPeriod.yearly, DefaultAllowance = 3 },
            new AbsenceType { Id = Guid.NewGuid(), Code = "home_office", NameEmployee = "Home office", AllowOsvc = true, DurationMode = DurationMode.days, SubmissionOffsetDays = 1, SubmissionDeadlineTime = null, DefaultBudgetPeriod = BudgetPeriod.weekly, DefaultAllowance = 2 },
            new AbsenceType { Id = Guid.NewGuid(), Code = "unpaid_leave", NameEmployee = "Neplacené volno", AllowOsvc = true, DurationMode = DurationMode.days, SubmissionOffsetDays = 1, SubmissionDeadlineTime = null, DefaultBudgetPeriod = BudgetPeriod.unlimited, DefaultAllowance = null },
            new AbsenceType { Id = Guid.NewGuid(), Code = "illness", NameEmployee = "Nemoc", AllowOsvc = false, DurationMode = DurationMode.days, SubmissionOffsetDays = 0, SubmissionDeadlineTime = null, DefaultBudgetPeriod = BudgetPeriod.unlimited, DefaultAllowance = null }
        };

        var existingTypes = await context.AbsenceTypes.ToListAsync();
        bool typesUpdated = false;
        foreach (var defType in defaultAbsenceTypes)
        {
            var existing = existingTypes.FirstOrDefault(t => t.Code == defType.Code);
            if (existing == null)
            {
                context.AbsenceTypes.Add(defType);
                typesUpdated = true;
            }
            else
            {
                if (existing.DefaultAllowance == null && defType.DefaultAllowance != null)
                {
                    existing.DefaultAllowance = defType.DefaultAllowance;
                    typesUpdated = true;
                }
                if (existing.Code == "doctor" && existing.DurationMode != DurationMode.hours)
                {
                    existing.DurationMode = DurationMode.hours;
                    typesUpdated = true;
                }
                else if (existing.Code == "sick_day")
                {
                    if (existing.DurationMode != DurationMode.single_day) { existing.DurationMode = DurationMode.single_day; typesUpdated = true; }
                    if (string.IsNullOrWhiteSpace(existing.SubmissionDeadlineTime)) { existing.SubmissionDeadlineTime = "09:00:00"; typesUpdated = true; }
                }
                else if (existing.Code != "doctor" && existing.Code != "sick_day" && existing.DurationMode != DurationMode.days)
                {
                    existing.DurationMode = DurationMode.days;
                    typesUpdated = true;
                }
            }
        }
        if (typesUpdated)
        {
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

        // 6. Svátky z balíčku (Packages/Holidays/cz.json)
        await Dochazka.Api.Services.HolidayService.ApplyPackageToDatabaseAsync(context, "cz");
    }

    private static async Task MigrateCompanySettingsTableAsync(System.Data.Common.DbConnection conn)
    {
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

        if (csCols.Count == 0)
        {
            return;
        }

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

        if (csCols.Contains("DefaultVacationDays") || csCols.Contains("DefaultSickDays") || csCols.Contains("DefaultHomeOfficeWeeklyDays"))
        {
            using var migrateCsCmd = conn.CreateCommand();
            migrateCsCmd.CommandText = @"
                PRAGMA foreign_keys = OFF;
                DROP TABLE IF EXISTS company_settings_new;
                CREATE TABLE company_settings_new (
                    Id TEXT NOT NULL CONSTRAINT PK_company_settings PRIMARY KEY,
                    DailyHours TEXT NOT NULL DEFAULT '8.00',
                    WeeklyWorkDays INTEGER NOT NULL DEFAULT 5
                );
                INSERT INTO company_settings_new (Id, DailyHours, WeeklyWorkDays)
                SELECT Id, COALESCE(DailyHours, '8.00'), COALESCE(WeeklyWorkDays, 5)
                FROM company_settings;
                DROP TABLE company_settings;
                ALTER TABLE company_settings_new RENAME TO company_settings;
                PRAGMA foreign_keys = ON;";
            await migrateCsCmd.ExecuteNonQueryAsync();
        }
    }

    private static async Task MigrateAbsenceTypesTableAsync(System.Data.Common.DbConnection conn, bool seedDefaultsIfEmpty = false)
    {
        var atCols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (var atCmd = conn.CreateCommand())
        {
            atCmd.CommandText = "PRAGMA table_info(absence_types);";
            using var atReader = await atCmd.ExecuteReaderAsync();
            while (await atReader.ReadAsync())
            {
                atCols.Add(atReader.GetString(1));
            }
        }

        if (atCols.Count == 0)
        {
            return;
        }

        if (!atCols.Contains("SubmissionDeadlineTime"))
        {
            using var alterAt = conn.CreateCommand();
            alterAt.CommandText = "ALTER TABLE absence_types ADD COLUMN SubmissionDeadlineTime TEXT NULL;";
            await alterAt.ExecuteNonQueryAsync();
            atCols.Add("SubmissionDeadlineTime");
        }

        if (!atCols.Contains("DefaultAllowance"))
        {
            using var alterDef = conn.CreateCommand();
            alterDef.CommandText = "ALTER TABLE absence_types ADD COLUMN DefaultAllowance INTEGER NULL;";
            await alterDef.ExecuteNonQueryAsync();
            atCols.Add("DefaultAllowance");
        }

        if (!atCols.Contains("AllowOsvc") || atCols.Contains("NameOsvc") || atCols.Contains("SubmissionDeadlineHoursBefore"))
        {
            using var migrateCmd = conn.CreateCommand();
            string allowOsvcSelect = atCols.Contains("AllowOsvc")
                ? "AllowOsvc"
                : "CASE WHEN Code IN ('vacation', 'sick_day', 'home_office', 'unpaid_leave') THEN 1 ELSE 0 END";

            migrateCmd.CommandText = $@"
                PRAGMA foreign_keys = OFF;
                DROP TABLE IF EXISTS absence_types_new;
                CREATE TABLE absence_types_new (
                    Id TEXT NOT NULL CONSTRAINT PK_absence_types PRIMARY KEY,
                    Code TEXT NOT NULL,
                    NameEmployee TEXT NOT NULL,
                    AllowOsvc INTEGER NOT NULL DEFAULT 0,
                    DurationMode TEXT NOT NULL,
                    SubmissionOffsetDays INTEGER NOT NULL DEFAULT 0,
                    SubmissionDeadlineTime TEXT NULL,
                    MaxPerMonthLimit INTEGER NULL,
                    DefaultBudgetPeriod TEXT NOT NULL,
                    DefaultAllowance INTEGER NULL,
                    IsActive INTEGER NOT NULL DEFAULT 1
                );
                INSERT INTO absence_types_new (
                    Id, Code, NameEmployee, AllowOsvc, DurationMode,
                    SubmissionOffsetDays, SubmissionDeadlineTime, MaxPerMonthLimit, DefaultBudgetPeriod, DefaultAllowance, IsActive
                )
                SELECT
                    Id,
                    Code,
                    CASE WHEN Code = 'illness' AND NameEmployee = 'Pracovní neschopnost' THEN 'Nemoc' ELSE NameEmployee END,
                    {allowOsvcSelect},
                    CASE WHEN Code = 'doctor' THEN 'hours' WHEN Code = 'sick_day' THEN 'single_day' ELSE 'days' END,
                    CASE WHEN Code = 'home_office' AND SubmissionOffsetDays = 0 THEN 1 ELSE SubmissionOffsetDays END,
                    CASE WHEN Code = 'sick_day' AND (SubmissionDeadlineTime IS NULL OR SubmissionDeadlineTime = '') THEN '09:00:00' ELSE SubmissionDeadlineTime END,
                    MaxPerMonthLimit,
                    DefaultBudgetPeriod,
                    COALESCE(DefaultAllowance, CASE WHEN Code = 'vacation' THEN 20 WHEN Code = 'sick_day' THEN 3 WHEN Code = 'home_office' THEN 2 ELSE NULL END),
                    IsActive
                FROM absence_types;
                DROP TABLE absence_types;
                ALTER TABLE absence_types_new RENAME TO absence_types;
                CREATE UNIQUE INDEX IF NOT EXISTS IX_absence_types_Code ON absence_types (Code);
                PRAGMA foreign_keys = ON;";
            await migrateCmd.ExecuteNonQueryAsync();
        }

        using (var initDefCmd = conn.CreateCommand())
        {
            initDefCmd.CommandText = @"
                UPDATE absence_types SET DefaultAllowance = 20 WHERE Code = 'vacation' AND DefaultAllowance IS NULL;
                UPDATE absence_types SET DefaultAllowance = 3 WHERE Code = 'sick_day' AND DefaultAllowance IS NULL;
                UPDATE absence_types SET DefaultAllowance = 2 WHERE Code = 'home_office' AND DefaultAllowance IS NULL;";
            await initDefCmd.ExecuteNonQueryAsync();
        }

        if (seedDefaultsIfEmpty)
        {
            using var ensureCmd = conn.CreateCommand();
            ensureCmd.CommandText = @"
                UPDATE absence_types SET NameEmployee = 'Nemoc' WHERE Code = 'illness' AND NameEmployee = 'Pracovní neschopnost';
                UPDATE absence_types SET SubmissionOffsetDays = 1 WHERE Code = 'home_office' AND SubmissionOffsetDays = 0;
                UPDATE absence_types SET AllowOsvc = 1 WHERE Code IN ('vacation', 'sick_day', 'home_office', 'unpaid_leave');
                UPDATE absence_types SET AllowOsvc = 0 WHERE Code IN ('doctor', 'illness');
                INSERT INTO absence_types (Id, Code, NameEmployee, AllowOsvc, DurationMode, SubmissionOffsetDays, SubmissionDeadlineTime, MaxPerMonthLimit, DefaultBudgetPeriod, DefaultAllowance, IsActive)
                SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
                       'unpaid_leave', 'Neplacené volno', 1, 'days', 1, NULL, NULL, 'unlimited', NULL, 1
                WHERE NOT EXISTS (SELECT 1 FROM absence_types WHERE Code = 'unpaid_leave');
                INSERT INTO absence_types (Id, Code, NameEmployee, AllowOsvc, DurationMode, SubmissionOffsetDays, SubmissionDeadlineTime, MaxPerMonthLimit, DefaultBudgetPeriod, DefaultAllowance, IsActive)
                SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
                       'illness', 'Nemoc', 0, 'days', 0, NULL, NULL, 'unlimited', NULL, 1
                WHERE NOT EXISTS (SELECT 1 FROM absence_types WHERE Code = 'illness');";
            await ensureCmd.ExecuteNonQueryAsync();
        }
    }
}



