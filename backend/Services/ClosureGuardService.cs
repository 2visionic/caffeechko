using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Dochazka.Api.Data;
using Dochazka.Api.Models;

namespace Dochazka.Api.Services;

/// <summary>
/// Centrální komponenta (Single Source of Truth) pro kontrolu uzamčení záznamů
/// roční uzávěrkou (existence user_absence_settings pro Year + 1 nebo IsClosed = true)
/// a měsíční uzávěrkou (monthly_closures).
/// </summary>
public sealed class UserClosureLockLookup
{
    private readonly Dictionary<Guid, HashSet<(int Year, int Month)>> _closedMonthsByUser;
    private readonly Dictionary<Guid, int> _maxSettingYearByUser;
    private readonly Dictionary<Guid, HashSet<int>> _explicitClosedYearsByUser;

    public UserClosureLockLookup(
        Dictionary<Guid, HashSet<(int Year, int Month)>> closedMonthsByUser,
        Dictionary<Guid, int> maxSettingYearByUser,
        Dictionary<Guid, HashSet<int>> explicitClosedYearsByUser)
    {
        _closedMonthsByUser = closedMonthsByUser;
        _maxSettingYearByUser = maxSettingYearByUser;
        _explicitClosedYearsByUser = explicitClosedYearsByUser;
    }

    public bool IsYearClosed(Guid userId, int year)
    {
        if (_maxSettingYearByUser.TryGetValue(userId, out var maxYear) && year < maxYear)
        {
            return true;
        }
        if (_explicitClosedYearsByUser.TryGetValue(userId, out var closedYears) && closedYears.Contains(year))
        {
            return true;
        }
        return false;
    }

    public bool IsMonthOrYearClosed(Guid userId, int year, int month)
    {
        if (IsYearClosed(userId, year))
        {
            return true;
        }
        return _closedMonthsByUser.TryGetValue(userId, out var months) && months.Contains((year, month));
    }

    public bool OverlapsAnyClosedPeriod(Guid userId, DateTime startDate, DateTime endDate)
    {
        if (IsYearClosed(userId, startDate.Year) || IsYearClosed(userId, endDate.Year))
        {
            return true;
        }
        if (!_closedMonthsByUser.TryGetValue(userId, out var closedMonths) || closedMonths.Count == 0)
        {
            return false;
        }
        return ClosureGuard.OverlapsAnyClosedMonth(startDate, endDate, closedMonths);
    }

    public (bool IsLockedByClosure, string? EditableMinEndDate) EvaluateAbsenceClosureLock(
        Guid userId,
        DateTime startDate,
        DateTime endDate)
    {
        if (IsYearClosed(userId, startDate.Year) || IsYearClosed(userId, endDate.Year))
        {
            return (true, null);
        }
        _closedMonthsByUser.TryGetValue(userId, out var closedMonths);
        return ClosureGuard.EvaluateAbsenceClosureLock(startDate, endDate, closedMonths);
    }
}

public static class ClosureGuard
{
    public const string ErrYearClosed = "ERR_YEAR_CLOSED";
    public const string ErrMonthClosed = "ERR_MONTH_CLOSED";

    /// <summary>
    /// Ověří v DB, zda má uživatel daný rok již uzavřený roční uzávěrkou
    /// (tj. existuje nastavení user_absence_settings pro následující rok Year > year, nebo má záznam Year == year s IsClosed == true).
    /// </summary>
    public static async Task<bool> IsUserYearClosedAsync(DochazkaDbContext context, Guid userId, int year)
    {
        return await context.UserAbsenceSettings
            .AnyAsync(s => s.UserId == userId && (s.Year > year || (s.Year == year && s.IsClosed)));
    }

    /// <summary>
    /// Synchronní vyhodnocení nad již načtenou kolekcí nastavení daného uživatele.
    /// </summary>
    public static bool IsUserYearClosed(IEnumerable<UserAbsenceSetting> userSettings, int year)
    {
        return userSettings.Any(s => s.Year > year || (s.Year == year && s.IsClosed));
    }

    /// <summary>
    /// První ověření v API pro akce vázané na konkrétní rok (např. uložení fondů, měsíční uzávěrka).
    /// </summary>
    public static async Task<(bool Allowed, string? ErrorCode, string? ErrorMessage)> CheckYearActionAllowedAsync(
        DochazkaDbContext context,
        Guid userId,
        int year,
        string? customMessage = null)
    {
        if (await IsUserYearClosedAsync(context, userId, year))
        {
            return (
                false,
                ErrYearClosed,
                customMessage ?? $"Rok {year} je u této osoby již uzavřen roční uzávěrkou (existuje nastavení pro rok {year + 1}). Záznamy z roku {year} nelze upravovat, mazat ani obnovovat."
            );
        }
        return (true, null, null);
    }

    /// <summary>
    /// První ověření v API pro mutace záznamů přítomnosti (TimeEntry: update, delete, restore).
    /// Nejprve kontroluje roční uzávěrku a poté měsíční uzávěrku.
    /// </summary>
    public static async Task<(bool Allowed, string? ErrorCode, string? ErrorMessage)> CheckTimeEntryActionAllowedAsync(
        DochazkaDbContext context,
        Guid userId,
        DateTime originDate,
        DateTime? targetDate,
        string monthClosedMessage)
    {
        if (await IsUserYearClosedAsync(context, userId, originDate.Year))
        {
            return (
                false,
                ErrYearClosed,
                $"Rok {originDate.Year} je u této osoby již uzavřen roční uzávěrkou. Záznamy přítomnosti z roku {originDate.Year} jsou uzamčeny a nelze je měnit, mazat ani obnovovat."
            );
        }

        if (targetDate.HasValue && targetDate.Value.Year != originDate.Year && await IsUserYearClosedAsync(context, userId, targetDate.Value.Year))
        {
            return (
                false,
                ErrYearClosed,
                $"Rok {targetDate.Value.Year} je u této osoby již uzavřen roční uzávěrkou. Záznamy přítomnosti v uzavřeném roce jsou uzamčeny."
            );
        }

        bool isOriginMonthClosed = await context.MonthlyClosures.AnyAsync(mc =>
            mc.UserId == userId && mc.Year == originDate.Year && mc.Month == originDate.Month);
        bool isTargetMonthClosed = targetDate.HasValue &&
            (targetDate.Value.Year != originDate.Year || targetDate.Value.Month != originDate.Month) &&
            await context.MonthlyClosures.AnyAsync(mc =>
                mc.UserId == userId && mc.Year == targetDate.Value.Year && mc.Month == targetDate.Value.Month);

        if (isOriginMonthClosed || isTargetMonthClosed)
        {
            return (false, ErrMonthClosed, monthClosedMessage);
        }

        return (true, null, null);
    }

    /// <summary>
    /// První ověření v API pro mutace absencí (create, delete, restore, approve, reject, resubmit).
    /// Nejprve kontroluje roční uzávěrku a volitelně i měsíční uzávěrku.
    /// </summary>
    public static async Task<(bool Allowed, string? ErrorCode, string? ErrorMessage)> CheckAbsenceActionAllowedAsync(
        DochazkaDbContext context,
        Guid userId,
        DateTime startDate,
        DateTime endDate,
        bool checkMonthlyClosure = true,
        string? monthClosedMessage = null)
    {
        if (await IsUserYearClosedAsync(context, userId, startDate.Year))
        {
            return (
                false,
                ErrYearClosed,
                $"Rok {startDate.Year} je u této osoby již uzavřen roční uzávěrkou. Absence z roku {startDate.Year} jsou uzamčeny a nelze je měnit, mazat ani obnovovat."
            );
        }

        if (endDate.Year != startDate.Year && await IsUserYearClosedAsync(context, userId, endDate.Year))
        {
            return (
                false,
                ErrYearClosed,
                $"Rok {endDate.Year} je u této osoby již uzavřen roční uzávěrkou. Absence v uzavřeném roce jsou uzamčeny."
            );
        }

        if (checkMonthlyClosure)
        {
            var userClosedMonths = (await context.MonthlyClosures
                .Where(mc => mc.UserId == userId)
                .Select(mc => new { mc.Year, mc.Month })
                .ToListAsync())
                .Select(x => (x.Year, x.Month))
                .ToHashSet();

            if (OverlapsAnyClosedMonth(startDate.Date, endDate.Date, userClosedMonths))
            {
                return (
                    false,
                    ErrMonthClosed,
                    monthClosedMessage ?? "Docházka osoby v tomto měsíci je již uzavřena. V uzavřeném měsíci již nelze měnit, mazat ani obnovovat absence."
                );
            }
        }

        return (true, null, null);
    }

    /// <summary>
    /// Dávkové načtení uzamčených měsíců a roků pro seznam uživatelů (pro GET endpointy výkazů, absencí a koše).
    /// </summary>
    public static async Task<UserClosureLockLookup> GetLockLookupForUsersAsync(
        DochazkaDbContext context,
        IReadOnlyCollection<Guid> userIds)
    {
        if (userIds == null || userIds.Count == 0)
        {
            return new UserClosureLockLookup(new(), new(), new());
        }

        var closedMonthsList = await context.MonthlyClosures
            .Where(mc => userIds.Contains(mc.UserId))
            .Select(mc => new { mc.UserId, mc.Year, mc.Month })
            .ToListAsync();

        var settingsList = await context.UserAbsenceSettings
            .Where(s => userIds.Contains(s.UserId))
            .Select(s => new { s.UserId, s.Year, s.IsClosed })
            .ToListAsync();

        var closedMonthsByUser = closedMonthsList
            .GroupBy(mc => mc.UserId)
            .ToDictionary(g => g.Key, g => g.Select(x => (x.Year, x.Month)).ToHashSet());

        var maxSettingYearByUser = settingsList
            .GroupBy(s => s.UserId)
            .ToDictionary(g => g.Key, g => g.Max(x => x.Year));

        var explicitClosedYearsByUser = settingsList
            .Where(s => s.IsClosed)
            .GroupBy(s => s.UserId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Year).ToHashSet());

        return new UserClosureLockLookup(closedMonthsByUser, maxSettingYearByUser, explicitClosedYearsByUser);
    }

    public static bool OverlapsAnyClosedMonth(DateTime startDate, DateTime endDate, HashSet<(int Year, int Month)>? closedMonths)
    {
        if (closedMonths == null || closedMonths.Count == 0) return false;
        var cur = new DateTime(startDate.Year, startDate.Month, 1);
        var last = new DateTime(endDate.Year, endDate.Month, 1);
        while (cur <= last)
        {
            if (closedMonths.Contains((cur.Year, cur.Month))) return true;
            cur = cur.AddMonths(1);
        }
        return false;
    }

    public static (bool IsLockedByClosure, string? EditableMinEndDate) EvaluateAbsenceClosureLock(
        DateTime startDate,
        DateTime endDate,
        HashSet<(int Year, int Month)>? closedMonths)
    {
        if (closedMonths == null || closedMonths.Count == 0)
        {
            return (false, null);
        }

        var sDate = startDate.Date;
        var eDate = endDate.Date;

        DateTime? latestClosedMonthEnd = null;
        bool anyClosedOverlap = false;

        var cur = new DateTime(sDate.Year, sDate.Month, 1);
        var last = new DateTime(eDate.Year, eDate.Month, 1);
        while (cur <= last)
        {
            if (closedMonths.Contains((cur.Year, cur.Month)))
            {
                anyClosedOverlap = true;
                var mEnd = new DateTime(cur.Year, cur.Month, DateTime.DaysInMonth(cur.Year, cur.Month));
                if (latestClosedMonthEnd == null || mEnd > latestClosedMonthEnd.Value)
                {
                    latestClosedMonthEnd = mEnd;
                }
            }
            cur = cur.AddMonths(1);
        }

        if (!anyClosedOverlap || !latestClosedMonthEnd.HasValue)
        {
            return (false, null);
        }

        if (sDate <= latestClosedMonthEnd.Value && eDate > latestClosedMonthEnd.Value)
        {
            return (false, latestClosedMonthEnd.Value.ToString("yyyy-MM-dd"));
        }

        return (true, null);
    }
}
