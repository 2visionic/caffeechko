using System;
using System.Collections.Generic;
using System.Data.Common;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Dochazka.Api.Data;
using Dochazka.Api.Models;

namespace Dochazka.Api.Services;

public class HolidayPackageItemDto
{
    public string Name { get; set; } = string.Empty;
    public int? Month { get; set; }
    public int? Day { get; set; }
    public string? Rule { get; set; }
}

public class HolidayPackageFileDto
{
    public string PackageCode { get; set; } = "cz";
    public string Name { get; set; } = string.Empty;
    public List<HolidayPackageItemDto> Holidays { get; set; } = new();
}

public class ResolvedHolidayDto
{
    public Guid Id { get; set; }
    public string Date { get; set; } = string.Empty; // "YYYY-MM-DD"
    [JsonIgnore]
    public DateOnly DateOnlyValue { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? Month { get; set; }
    public int? Day { get; set; }
    public string? Rule { get; set; }
    public string PackageCode { get; set; } = "cz";
    public bool IsCustomHoliday { get; set; }
    public bool IsActive { get; set; } = true;
}

public static class HolidayService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    /// <summary>
    /// Načte balíček svátků ze souboru Packages/Holidays/{packageCode}.json.
    /// </summary>
    public static HolidayPackageFileDto LoadPackage(string packageCode = "cz")
    {
        var fileName = $"{packageCode.ToLowerInvariant()}.json";
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Packages", "Holidays", fileName),
            Path.Combine("Packages", "Holidays", fileName),
            Path.Combine("backend", "Packages", "Holidays", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "Packages", "Holidays", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "backend", "Packages", "Holidays", fileName)
        };

        var foundPath = candidates.FirstOrDefault(File.Exists);
        if (foundPath != null)
        {
            try
            {
                var json = File.ReadAllText(foundPath);
                var parsed = JsonSerializer.Deserialize<HolidayPackageFileDto>(json, JsonOptions);
                if (parsed != null && parsed.Holidays.Count > 0)
                {
                    return parsed;
                }
            }
            catch { }
        }

        // Fallback pokud by soubor na disku nebyl nalezen
        return new HolidayPackageFileDto
        {
            PackageCode = "cz",
            Name = "Česká republika – Státní a ostatní svátky",
            Holidays = new List<HolidayPackageItemDto>
            {
                new() { Name = "Den obnovy samostatného českého státu; Nový rok", Month = 1, Day = 1, Rule = null },
                new() { Name = "Velký pátek", Month = null, Day = null, Rule = "EASTER-2" },
                new() { Name = "Velikonoční pondělí", Month = null, Day = null, Rule = "EASTER+1" },
                new() { Name = "Svátek práce", Month = 5, Day = 1, Rule = null },
                new() { Name = "Den vítězství", Month = 5, Day = 8, Rule = null },
                new() { Name = "Den slovanských věrozvěstů Cyrila a Metoděje", Month = 7, Day = 5, Rule = null },
                new() { Name = "Den upálení mistra Jana Husa", Month = 7, Day = 6, Rule = null },
                new() { Name = "Den české státnosti", Month = 9, Day = 28, Rule = null },
                new() { Name = "Den vzniku samostatného československého státu", Month = 10, Day = 28, Rule = null },
                new() { Name = "Den boje za svobodu a demokracii", Month = 11, Day = 17, Rule = null },
                new() { Name = "Štědrý den", Month = 12, Day = 24, Rule = null },
                new() { Name = "1. svátek vánoční", Month = 12, Day = 25, Rule = null },
                new() { Name = "2. svátek vánoční", Month = 12, Day = 26, Rule = null }
            }
        };
    }

    /// <summary>
    /// Aplikuje svátky z balíčku do databáze přes EF Core DbContext (pro instalaci nebo seed).
    /// </summary>
    public static async Task ApplyPackageToDatabaseAsync(DochazkaDbContext context, string packageCode = "cz")
    {
        var pkg = LoadPackage(packageCode);
        var existing = await context.Holidays.ToListAsync();

        bool changed = false;
        foreach (var item in pkg.Holidays)
        {
            bool exists = existing.Any(h =>
                string.Equals(h.Name, item.Name, StringComparison.OrdinalIgnoreCase) ||
                (item.Month.HasValue && item.Day.HasValue && h.Month == item.Month && h.Day == item.Day && string.IsNullOrEmpty(h.Rule)) ||
                (!string.IsNullOrEmpty(item.Rule) && string.Equals(h.Rule, item.Rule, StringComparison.OrdinalIgnoreCase)));

            if (!exists)
            {
                context.Holidays.Add(new Holiday
                {
                    Id = Guid.NewGuid(),
                    Name = item.Name,
                    Month = item.Month,
                    Day = item.Day,
                    Rule = item.Rule,
                    PackageCode = pkg.PackageCode,
                    IsCustomHoliday = false,
                    IsActive = true
                });
                changed = true;
            }
        }

        if (changed)
        {
            await context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Zajistí aktuální schéma tabulky holidays (s plovoucím sloupcem Rule) a aplikuje balíček svátků na SQLite spojení (aktivní DB i *.template.db).
    /// </summary>
    public static async Task EnsureSqliteHolidaysSchemaAndPackageAsync(DbConnection conn, string packageCode = "cz", bool seedPackageRows = true)
    {
        if (conn.State != System.Data.ConnectionState.Open)
        {
            await conn.OpenAsync();
        }

        var cols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (var infoCmd = conn.CreateCommand())
        {
            infoCmd.CommandText = "PRAGMA table_info(holidays);";
            using var reader = await infoCmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                cols.Add(reader.GetString(1));
            }
        }

        // Pokud tabulka obsahuje starý sloupec Date nebo jí chybí sloupec Rule, přestavíme tabulku na plovoucí schéma
        if (cols.Contains("Date") || (cols.Count > 0 && !cols.Contains("Rule")))
        {
            using var dropCmd = conn.CreateCommand();
            dropCmd.CommandText = "DROP TABLE IF EXISTS holidays;";
            await dropCmd.ExecuteNonQueryAsync();
            cols.Clear();
        }

        using (var createCmd = conn.CreateCommand())
        {
            createCmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS holidays (
                    Id TEXT PRIMARY KEY,
                    Name TEXT NOT NULL,
                    Month INTEGER NULL,
                    Day INTEGER NULL,
                    Rule TEXT NULL,
                    PackageCode TEXT NOT NULL DEFAULT 'cz',
                    IsCustomHoliday INTEGER NOT NULL DEFAULT 0,
                    IsActive INTEGER NOT NULL DEFAULT 1
                );
                CREATE INDEX IF NOT EXISTS IX_holidays_PackageCode ON holidays (PackageCode);";
            await createCmd.ExecuteNonQueryAsync();
        }

        if (!seedPackageRows) return;

        int existingCount = 0;
        using (var countCmd = conn.CreateCommand())
        {
            countCmd.CommandText = "SELECT COUNT(*) FROM holidays;";
            var scalar = await countCmd.ExecuteScalarAsync();
            existingCount = Convert.ToInt32(scalar);
        }

        if (existingCount == 0)
        {
            var pkg = LoadPackage(packageCode);
            foreach (var item in pkg.Holidays)
            {
                using var insCmd = conn.CreateCommand();
                insCmd.CommandText = @"
                    INSERT INTO holidays (Id, Name, Month, Day, Rule, PackageCode, IsCustomHoliday, IsActive)
                    VALUES ($id, $name, $month, $day, $rule, $pkg, 0, 1);";

                AddParam(insCmd, "$id", Guid.NewGuid().ToString());
                AddParam(insCmd, "$name", item.Name);
                AddParam(insCmd, "$month", item.Month.HasValue ? item.Month.Value : DBNull.Value);
                AddParam(insCmd, "$day", item.Day.HasValue ? item.Day.Value : DBNull.Value);
                AddParam(insCmd, "$rule", !string.IsNullOrWhiteSpace(item.Rule) ? item.Rule : DBNull.Value);
                AddParam(insCmd, "$pkg", pkg.PackageCode);

                await insCmd.ExecuteNonQueryAsync();
            }
        }
    }

    private static void AddParam(DbCommand cmd, string name, object value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value;
        cmd.Parameters.Add(p);
    }

    /// <summary>
    /// Vyhodnotí všechny svátky z databáze pro konkrétní cílový rok (včetně plovoucích pravidel jako EASTER-2, EASTER+1).
    /// </summary>
    public static List<ResolvedHolidayDto> GetResolvedHolidaysForYear(IEnumerable<Holiday> holidays, int year)
    {
        var resolved = new List<ResolvedHolidayDto>();

        foreach (var h in holidays.Where(x => x.IsActive))
        {
            var date = ResolveHolidayDateForYear(h, year);
            if (date.HasValue)
            {
                resolved.Add(new ResolvedHolidayDto
                {
                    Id = h.Id,
                    Date = date.Value.ToString("yyyy-MM-dd"),
                    DateOnlyValue = date.Value,
                    Name = h.Name,
                    Month = h.Month ?? date.Value.Month,
                    Day = h.Day ?? date.Value.Day,
                    Rule = h.Rule,
                    PackageCode = h.PackageCode,
                    IsCustomHoliday = h.IsCustomHoliday,
                    IsActive = h.IsActive
                });
            }
        }

        return resolved
            .OrderBy(r => r.DateOnlyValue)
            .ToList();
    }

    public static DateOnly? ResolveHolidayDateForYear(Holiday holiday, int year)
    {
        var rule = holiday.Rule?.Trim().ToUpperInvariant();

        if (!string.IsNullOrEmpty(rule) && rule != "FIXED")
        {
            if (rule == "EASTER_FRIDAY") rule = "EASTER-2";
            else if (rule == "EASTER_MONDAY") rule = "EASTER+1";
            else if (rule == "EASTER_SUNDAY" || rule == "EASTER") rule = "EASTER+0";

            if (rule.StartsWith("EASTER"))
            {
                var easterSunday = CalculateEasterSunday(year);
                var offsetStr = rule.Substring("EASTER".Length).Trim();
                if (string.IsNullOrEmpty(offsetStr))
                {
                    return easterSunday;
                }
                if (int.TryParse(offsetStr, out int dayOffset))
                {
                    return easterSunday.AddDays(dayOffset);
                }
            }

            if (rule.StartsWith("ONCE:"))
            {
                var datePart = rule.Substring("ONCE:".Length).Trim();
                if (DateOnly.TryParse(datePart, out var onceDate) && onceDate.Year == year)
                {
                    return onceDate;
                }
                return null;
            }
        }

        if (holiday.Month.HasValue && holiday.Day.HasValue)
        {
            int m = holiday.Month.Value;
            int d = holiday.Day.Value;
            if (m >= 1 && m <= 12)
            {
                int maxDay = DateTime.DaysInMonth(year, m);
                if (d >= 1 && d <= maxDay)
                {
                    return new DateOnly(year, m, d);
                }
            }
        }

        return null;
    }

    /// <summary>
    /// Butcherův algoritmus pro výpočet data Velikonoční neděle v libovolném roce gregoriánského kalendáře.
    /// </summary>
    public static DateOnly CalculateEasterSunday(int year)
    {
        int a = year % 19;
        int b = year / 100;
        int c = year % 100;
        int d = b / 4;
        int e = b % 4;
        int f = (b + 8) / 25;
        int g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4;
        int k = c % 4;
        int l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int month = (h + l - 7 * m + 114) / 31;
        int day = ((h + l - 7 * m + 114) % 31) + 1;

        return new DateOnly(year, month, day);
    }

    /// <summary>
    /// Spočítá počet pracovních dnů (Po–Pá) mezi startDate a endDate (včetně),
    /// které nepřipadají na aktivní státní nebo firemní svátek.
    /// </summary>
    public static int CountWorkingDays(DateTime startDate, DateTime endDate, IEnumerable<Holiday>? holidays)
    {
        var s = startDate.Date;
        var e = endDate.Date;
        if (e < s) return 0;

        var activeHolidays = holidays?.Where(h => h.IsActive).ToList() ?? new List<Holiday>();
        var holidayDates = new HashSet<DateOnly>();
        for (int y = s.Year; y <= e.Year; y++)
        {
            foreach (var rh in GetResolvedHolidaysForYear(activeHolidays, y))
            {
                holidayDates.Add(rh.DateOnlyValue);
            }
        }

        int count = 0;
        for (var dt = s; dt <= e; dt = dt.AddDays(1))
        {
            if (dt.DayOfWeek != DayOfWeek.Saturday &&
                dt.DayOfWeek != DayOfWeek.Sunday &&
                !holidayDates.Contains(DateOnly.FromDateTime(dt)))
            {
                count++;
            }
        }
        return count;
    }
}
