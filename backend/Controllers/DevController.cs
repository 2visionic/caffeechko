using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Data.Sqlite;
using Dochazka.Api.Data;
using Dochazka.Api.Models;

namespace Dochazka.Api.Controllers;

[ApiController]
[Route("api/dev")]
public class DevController : ControllerBase
{
    private readonly DochazkaDbContext _context;
    private readonly DevDatabaseManager _dbManager;
    private readonly IConfiguration _config;
    private readonly Microsoft.Extensions.Hosting.IHostEnvironment _env;

    public DevController(
        DochazkaDbContext context,
        DevDatabaseManager dbManager,
        IConfiguration config,
        Microsoft.Extensions.Hosting.IHostEnvironment env)
    {
        _context = context;
        _dbManager = dbManager;
        _config = config;
        _env = env;
    }

    [HttpGet("database/status")]
    public async Task<ActionResult<ApiResponse<DevDatabaseStatusDto>>> GetDatabaseStatus()
    {
        var mode = _dbManager.CurrentMode;
        var fileName = _dbManager.GetDatabaseFileName();

        int tableCount = 0;
        int userCount = 0;
        bool isInstalled = false;

        try
        {
            using var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__EFMigrationsHistory';";
            var scalarResult = await cmd.ExecuteScalarAsync();
            tableCount = Convert.ToInt32(scalarResult);

            if (tableCount > 0)
            {
                userCount = await _context.Users.CountAsync();
                isInstalled = userCount > 0;
            }
        }
        catch
        {
            // Database might be uninitialized or empty file
            tableCount = 0;
            userCount = 0;
            isInstalled = false;
        }

        return Ok(ApiResponse<DevDatabaseStatusDto>.Success(new DevDatabaseStatusDto
        {
            CurrentMode = mode,
            DatabaseFile = fileName,
            TableCount = tableCount,
            UserCount = userCount,
            IsInstalled = isInstalled
        }));
    }

    [HttpPost("database/switch")]
    public async Task<ActionResult<ApiResponse<DevDatabaseStatusDto>>> SwitchDatabase([FromBody] SwitchDatabaseRequestDto request)
    {
        _dbManager.SetGlobalMode(request.Mode);
        return await GetDatabaseStatus();
    }

    [HttpPost("database/wipe-clean")]
    public async Task<ActionResult<ApiResponse<string>>> WipeCleanDatabase()
    {
        try
        {
            // Close connection if open
            using (var conn = _context.Database.GetDbConnection())
            {
                if (conn.State == System.Data.ConnectionState.Open)
                {
                    await conn.CloseAsync();
                }
            }
            SqliteConnection.ClearAllPools();
            GC.Collect();
            GC.WaitForPendingFinalizers();

            var targetFiles = new[]
            {
                "dochazka_clean.db",
                "dochazka_clean.db-wal",
                "dochazka_clean.db-shm",
                Path.Combine("backend", "dochazka_clean.db"),
                Path.Combine("backend", "dochazka_clean.db-wal"),
                Path.Combine("backend", "dochazka_clean.db-shm"),
                Path.Combine(AppContext.BaseDirectory, "dochazka_clean.db")
            };

            foreach (var tf in targetFiles)
            {
                if (System.IO.File.Exists(tf))
                {
                    try { System.IO.File.Delete(tf); } catch { }
                }
            }

            var candidates = new[]
            {
                "dochazka_clean.template.db",
                Path.Combine("backend", "dochazka_clean.template.db"),
                Path.Combine(AppContext.BaseDirectory, "dochazka_clean.template.db"),
                Path.Combine(Directory.GetCurrentDirectory(), "dochazka_clean.template.db"),
                Path.Combine(Directory.GetCurrentDirectory(), "backend", "dochazka_clean.template.db")
            };

            string? templatePath = candidates.FirstOrDefault(System.IO.File.Exists);
            if (templatePath != null)
            {
                System.IO.File.Copy(templatePath, "dochazka_clean.db", true);
            }

            return Ok(ApiResponse<string>.Success("Čistá databáze byla úspěšně obnovena ze šablony dochazka_clean.template.db."));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<string>.Failure("ERR_WIPE_FAILED", ex.Message));
        }
    }

    /// <summary>
    /// Obnoví vývojářskou databázi dochazka_dev.db ze vzorové šablony dochazka_dev.template.db.
    /// Smaže veškerá lokální testovací data a obnoví čistá anonymní data.
    /// </summary>
    [HttpPost("database/reset-dev")]
    public async Task<ActionResult<ApiResponse<string>>> ResetDevDatabase()
    {
        try
        {
            // 1. Zavřít spojení a uvolnit zámky SQLite poolu
            using (var conn = _context.Database.GetDbConnection())
            {
                if (conn.State == System.Data.ConnectionState.Open)
                {
                    await conn.CloseAsync();
                }
            }
            SqliteConnection.ClearAllPools();
            GC.Collect();
            GC.WaitForPendingFinalizers();

            // 2. Najít šablonu
            var candidates = new[]
            {
                "dochazka_dev.template.db",
                Path.Combine("backend", "dochazka_dev.template.db"),
                Path.Combine(AppContext.BaseDirectory, "dochazka_dev.template.db"),
                Path.Combine(Directory.GetCurrentDirectory(), "dochazka_dev.template.db"),
                Path.Combine(Directory.GetCurrentDirectory(), "backend", "dochazka_dev.template.db")
            };

            string? templatePath = candidates.FirstOrDefault(System.IO.File.Exists);

            // 3. Smazat současnou pracovní dochazka_dev.db a WAL soubory
            var targetFiles = new[]
            {
                "dochazka_dev.db",
                "dochazka_dev.db-wal",
                "dochazka_dev.db-shm",
                Path.Combine("backend", "dochazka_dev.db"),
                Path.Combine("backend", "dochazka_dev.db-wal"),
                Path.Combine("backend", "dochazka_dev.db-shm")
            };

            foreach (var tf in targetFiles)
            {
                if (System.IO.File.Exists(tf))
                {
                    try { System.IO.File.Delete(tf); } catch { }
                }
            }

            // 4. Naklonovat ze šablony nebo provést čistý seed
            if (templatePath != null)
            {
                var destPath = _dbManager.GetDatabaseFileName();
                System.IO.File.Copy(templatePath, destPath, true);
            }
            else
            {
                await _context.Database.EnsureCreatedAsync();
                await DbInitializer.SeedAsync(_context);
            }

            return Ok(ApiResponse<string>.Success("Vývojářská databáze byla úspěšně obnovena ze šablony dochazka_dev.template.db."));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<string>.Failure("ERR_RESET_FAILED", ex.Message));
        }
    }

    /// <summary>
    /// Vyčistí záznamy time_entries a user_absence_settings z aktivní databáze i šablony dochazka_dev.template.db.
    /// </summary>
    [HttpPost("database/clean-entries-and-settings")]
    public async Task<ActionResult<ApiResponse<object>>> CleanEntriesAndSettings()
    {
        try
        {
            await _context.Database.ExecuteSqlRawAsync("DELETE FROM time_entries;");
            await _context.Database.ExecuteSqlRawAsync("DELETE FROM user_absence_settings;");

            var templateCandidates = new[]
            {
                "dochazka_dev.template.db",
                Path.Combine("backend", "dochazka_dev.template.db"),
                Path.Combine(AppContext.BaseDirectory, "dochazka_dev.template.db"),
                Path.Combine(Directory.GetCurrentDirectory(), "dochazka_dev.template.db"),
                Path.Combine(Directory.GetCurrentDirectory(), "backend", "dochazka_dev.template.db")
            };

            string? templatePath = templateCandidates.FirstOrDefault(System.IO.File.Exists);
            if (templatePath != null)
            {
                using var tConn = new SqliteConnection($"Data Source={templatePath}");
                await tConn.OpenAsync();
                using var tCmd = tConn.CreateCommand();
                tCmd.CommandText = "DELETE FROM time_entries; DELETE FROM user_absence_settings; VACUUM;";
                await tCmd.ExecuteNonQueryAsync();
                await tConn.CloseAsync();
            }

            await _context.Database.ExecuteSqlRawAsync("VACUUM;");

            return Ok(ApiResponse<object>.Success(new
            {
                message = "Tabulky time_entries a user_absence_settings byly úspěšně vyčištěny z databáze i ze šablony.",
                templatePath = templatePath != null ? Path.GetFullPath(templatePath) : "NOT_FOUND"
            }));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<object>.Failure("ERR_CLEAN_FAILED", ex.Message));
        }
    }

    [HttpPost("database/bootstrap-install")]
    public async Task<ActionResult<ApiResponse<object>>> BootstrapInstall([FromBody] BootstrapInstallRequestDto request)
    {
        try
        {
            // 1. Create tables from EF Core schema
            await _context.Database.EnsureCreatedAsync();

            // 2. Initial company settings
            var company = new CompanySetting
            {
                Id = Guid.NewGuid(),
                DefaultWeeklyHours = 40.00m,
                MultiplierWeekend = 200,
                MultiplierHoliday = 200,
                MultiplierWeekendHoliday = 300,
                WorkdayStartTime = "08:00"
            };
            _context.CompanySettings.Add(company);

            // 3. Absence types
            _context.AbsenceTypes.AddRange(
                new AbsenceType { Id = Guid.NewGuid(), Code = "vacation", NameEmployee = "Dovolená", NameOsvc = "Volno", DurationMode = DurationMode.days, SubmissionOffsetDays = 3, DefaultBudgetPeriod = BudgetPeriod.yearly },
                new AbsenceType { Id = Guid.NewGuid(), Code = "doctor", NameEmployee = "Lékař", NameOsvc = "Lékař", DurationMode = DurationMode.hours, SubmissionOffsetDays = 0, DefaultBudgetPeriod = BudgetPeriod.unlimited },
                new AbsenceType { Id = Guid.NewGuid(), Code = "sick_day", NameEmployee = "Sick day", NameOsvc = "Sick day", DurationMode = DurationMode.days, SubmissionOffsetDays = 0, SubmissionDeadlineHoursBefore = 2, MaxPerMonthLimit = 2, DefaultBudgetPeriod = BudgetPeriod.yearly },
                new AbsenceType { Id = Guid.NewGuid(), Code = "home_office", NameEmployee = "Home office", NameOsvc = "Home office", DurationMode = DurationMode.days, SubmissionOffsetDays = 0, DefaultBudgetPeriod = BudgetPeriod.weekly }
            );

            // 4. Default workplace
            var defaultWp = new Workplace
            {
                Id = Guid.NewGuid(),
                Name = string.IsNullOrWhiteSpace(request.CompanyName) ? "Hlavní sídlo" : request.CompanyName,
                NfcIdentifier = "hq1",
                Address = "Hlavní kancelář",
                IsActive = true
            };
            _context.Workplaces.Add(defaultWp);

            // 5. First admin user
            var nameParts = (string.IsNullOrWhiteSpace(request.AdminName) ? "Hlavní Správce" : request.AdminName.Trim()).Split(' ', 2);
            var first = nameParts.Length > 0 ? nameParts[0] : "Hlavní";
            var last = nameParts.Length > 1 ? nameParts[1] : "Správce";

            var adminUser = new User
            {
                Id = Guid.NewGuid(),
                Email = string.IsNullOrWhiteSpace(request.AdminEmail) ? "admin@firma.cz" : request.AdminEmail.Trim(),
                FirstName = first,
                LastName = last,
                DisplayName = $"{first} {last}",
                Role = UserRole.admin,
                ContractKind = ContractKind.employee,
                ContractType = ContractType.full_time,
                CompensationType = CompensationType.fixed_rate,
                FixedMonthlyRate = 80000m,
                WeeklyHoursBudget = 40m
            };
            _context.Users.Add(adminUser);

            await _context.SaveChangesAsync();

            return Ok(ApiResponse<object>.Success(new
            {
                message = "Instalace byla úspěšně dokončena.",
                user = new
                {
                    id = adminUser.Id,
                    name = adminUser.DisplayName,
                    email = adminUser.Email,
                    role = adminUser.Role.ToString()
                }
            }));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<object>.Failure("ERR_BOOTSTRAP_FAILED", ex.Message));
        }
    }

    /// <summary>
    /// Získá aktuální konfiguraci vývojářského prostředí (firma, doména, oAuth, databáze).
    /// </summary>
    [HttpGet("config")]
    public ActionResult<ApiResponse<DevConfigDto>> GetConfig()
    {
        var dto = new DevConfigDto
        {
            AppName = _config["AppName"] ?? "caffeechko",
            CompanyName = _config["CompanyName"] ?? "Firma s.r.o.",
            InstanceName = _config["InstanceName"] ?? "firma",
            GoogleWorkspaceDomain = _config["GOOGLE_WORKSPACE_DOMAIN"] ?? "firma.cz",
            GoogleClientId = _config["GoogleClientId"] ?? "",
            GoogleClientSecret = _config["GoogleClientSecret"] ?? "",
            UsePostgres = _config.GetValue<bool>("UsePostgres", false),
            ConnectionString = _config.GetConnectionString("DefaultConnection") ?? ""
        };

        return Ok(ApiResponse<DevConfigDto>.Success(dto));
    }

    /// <summary>
    /// Uloží konfiguraci do lokálního git-ignored souboru appsettings.Development.json.
    /// </summary>
    [HttpPost("config")]
    public async Task<ActionResult<ApiResponse<DevConfigDto>>> UpdateConfig([FromBody] DevConfigDto dto)
    {
        try
        {
            _config["AppName"] = dto.AppName;
            _config["CompanyName"] = dto.CompanyName;
            _config["InstanceName"] = dto.InstanceName;
            _config["GOOGLE_WORKSPACE_DOMAIN"] = dto.GoogleWorkspaceDomain;
            _config["GoogleClientId"] = dto.GoogleClientId ?? "";
            _config["GoogleClientSecret"] = dto.GoogleClientSecret ?? "";

            var devSettingsPath = Path.Combine(_env.ContentRootPath, "appsettings.Development.json");
            var configObj = new
            {
                Logging = new
                {
                    LogLevel = new
                    {
                        Default = "Information",
                        Microsoft_AspNetCore = "Warning"
                    }
                },
                AppName = dto.AppName,
                CompanyName = dto.CompanyName,
                InstanceName = dto.InstanceName,
                GOOGLE_WORKSPACE_DOMAIN = dto.GoogleWorkspaceDomain,
                GoogleClientId = dto.GoogleClientId ?? "",
                GoogleClientSecret = dto.GoogleClientSecret ?? "",
                UsePostgres = dto.UsePostgres,
                ConnectionStrings = new
                {
                    DefaultConnection = !string.IsNullOrWhiteSpace(dto.ConnectionString)
                        ? dto.ConnectionString
                        : "Host=localhost;Port=5432;Database=dochazka_dev;Username=dev;Password=devpassword"
                }
            };

            var json = System.Text.Json.JsonSerializer.Serialize(configObj, new System.Text.Json.JsonSerializerOptions
            {
                WriteIndented = true
            });

            await System.IO.File.WriteAllTextAsync(devSettingsPath, json);

            return Ok(ApiResponse<DevConfigDto>.Success(dto));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<DevConfigDto>.Failure("ERR_CONFIG_SAVE_FAILED", ex.Message));
        }
    }
}

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
