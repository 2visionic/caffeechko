using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Dochazka.Api.Data;
using Dochazka.Api.Models;

namespace Dochazka.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly DochazkaDbContext _context;
    private readonly IConfiguration _config;

    public AuthController(DochazkaDbContext context, IConfiguration config)
    {
        _context = context;
        _config = config;
    }

    private async Task<decimal> ComputeWeeklyHoursBudgetAsync(ContractKind kind, ContractType contractType)
    {
        var cs = await _context.CompanySettings.AsNoTracking().FirstOrDefaultAsync();
        decimal dailyHours = cs?.DailyHours ?? 8.00m;
        int weeklyDays = cs?.WeeklyWorkDays ?? 5;
        decimal coeff = 1.0m;
        if (kind == ContractKind.employee)
        {
            var code = contractType.ToString();
            var ct = await _context.ContractTypes.AsNoTracking().FirstOrDefaultAsync(c => c.Code == code);
            if (ct != null) coeff = ct.Coefficient;
        }
        return Math.Round(dailyHours * weeklyDays * coeff, 2);
    }

    private AuthUserDto MapAuthUserDto(User user, string? contractTypeName = null, string? roleLabelOverride = null)
    {
        return new AuthUserDto
        {
            Id = user.Id.ToString(),
            Email = user.Email,
            Name = user.DisplayName,
            Role = user.Role.ToString(),
            RoleLabel = roleLabelOverride ?? UserDisplayHelper.GetRoleLabelCzech(user.Role),
            IsApproved = user.IsApproved,
            AvatarUrl = user.AvatarUrl,
            Contract = user.ContractKind == ContractKind.osvc ? "OSVČ" : "HPP",
            ContractType = user.ContractType.ToString(),
            ContractTypeName = contractTypeName,
            PhoneNumber = user.PhoneNumber,
            IsPermanentHomeOffice = user.IsPermanentHomeOffice
        };
    }

    /// <summary>
    /// Google Workspace OAuth 2.0 přihlášení s ověřením hosted domain hd (@firma.cz).
    /// </summary>
    [HttpPost("google")]
    public async Task<ActionResult<ApiResponse<AuthResponseDto>>> GoogleLogin([FromBody] GoogleLoginDto request)
    {
        var allowedDomain = _config["GOOGLE_WORKSPACE_DOMAIN"] ?? "firma.cz";
        var isGmailAllowed = string.Equals(allowedDomain, "gmail.com", StringComparison.OrdinalIgnoreCase);

        // 1. Pokud je přítomen ID Token, vytáhneme z něj autoritativní údaje (e-mail, jméno, Google ID, hd)
        if (!string.IsNullOrEmpty(request.IdToken) && request.IdToken.Contains("."))
        {
            try
            {
                var parts = request.IdToken.Split('.');
                if (parts.Length >= 2)
                {
                    var payloadJson = System.Text.Encoding.UTF8.GetString(Base64UrlDecode(parts[1]));
                    using var doc = System.Text.Json.JsonDocument.Parse(payloadJson);

                    if (string.IsNullOrWhiteSpace(request.Email) && doc.RootElement.TryGetProperty("email", out var emailProp))
                    {
                        request.Email = emailProp.GetString() ?? "";
                    }
                    if (string.IsNullOrWhiteSpace(request.Name) && doc.RootElement.TryGetProperty("name", out var nameProp))
                    {
                        request.Name = nameProp.GetString() ?? "";
                    }
                    if (string.IsNullOrWhiteSpace(request.GoogleId) && doc.RootElement.TryGetProperty("sub", out var subProp))
                    {
                        request.GoogleId = subProp.GetString() ?? "";
                    }

                    // Ověření Google Workspace Hosted Domain (hd) claimu
                    if (doc.RootElement.TryGetProperty("hd", out var hdProp))
                    {
                        var tokenHd = hdProp.GetString();
                        if (!string.Equals(tokenHd, allowedDomain, StringComparison.OrdinalIgnoreCase) && !isGmailAllowed)
                        {
                            return StatusCode(403, ApiResponse<AuthResponseDto>.Failure(
                                "ERR_DOMAIN_FORBIDDEN",
                                $"Přístup zamítnut. Účet nepatří do autorizovaného Google Workspace (@{allowedDomain}). Token obsahuje doménu @{tokenHd}."
                            ));
                        }
                    }
                    else if (!request.IdToken.StartsWith("simulated-") &&
                             !isGmailAllowed &&
                             (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Trim().EndsWith($"@{allowedDomain}", StringComparison.OrdinalIgnoreCase)))
                    {
                        return StatusCode(403, ApiResponse<AuthResponseDto>.Failure(
                            "ERR_NOT_WORKSPACE_ACCOUNT",
                            $"Google účet '{request.Email}' je osobní spotřebitelský účet (chybí firemní Google Workspace podpis 'hd'). Docházkový systém je určen pro firemní účty @{allowedDomain}."
                        ));
                    }
                }
            }
            catch { }
        }

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(ApiResponse<AuthResponseDto>.Failure("ERR_INVALID_EMAIL", "E-mail je povinný a nepodařilo se jej načíst z Google tokenu."));
        }

        var email = request.Email.Trim().ToLowerInvariant();

        // 2. Kontrola firemní domény dle konfigurace
        if (!email.EndsWith($"@{allowedDomain.ToLowerInvariant()}"))
        {
            return StatusCode(403, ApiResponse<AuthResponseDto>.Failure(
                "ERR_DOMAIN_FORBIDDEN",
                $"Přístup zamítnut. Docházkový systém je určen výhradně pro pracovníky s Google účtem @{allowedDomain}. Váš účet: {email}."
            ));
        }

        // 3. Vyhledání uživatele v databázi podle přesného e-mailu
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

        if (user == null)
        {
            // Detekce prázdného stavu: Admin Bootstrap Rule (Kapitola 02, sekce 4.2)
            var adminCount = await _context.Users.CountAsync(u => u.Role == UserRole.admin);
            var isFirstAdmin = adminCount == 0;

            var nameParts = (request.Name ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var firstName = nameParts.Length > 0 ? nameParts[0] : email.Split('@')[0];
            var lastName = nameParts.Length > 1 ? string.Join(" ", nameParts.Skip(1)) : "";
            var displayName = !string.IsNullOrWhiteSpace(request.Name) ? request.Name : $"{firstName} {lastName}".Trim();

            var defaultWeeklyHours = await ComputeWeeklyHoursBudgetAsync(ContractKind.employee, ContractType.full_time);

            // Případ B: Pokud uživatel dosud v DB neexistuje:
            // - První admin je schválen rovnou
            // - Další běžní zaměstnanci se založí se stavem IsApproved = false (čeká na schválení úvazku Office Managerem)
            user = new User
            {
                Id = Guid.NewGuid(),
                Email = email,
                GoogleId = request.GoogleId ?? Guid.NewGuid().ToString(),
                FirstName = firstName,
                LastName = lastName,
                DisplayName = displayName,
                AvatarUrl = request.AvatarUrl,
                Role = isFirstAdmin ? UserRole.admin : UserRole.colleague,
                ContractKind = ContractKind.employee,
                ContractType = ContractType.full_time,
                CompensationType = CompensationType.hourly,
                WeeklyHoursBudget = defaultWeeklyHours,
                IsActive = true,
                IsApproved = isFirstAdmin, // První admin je schválen rovnou, ostatní čekají na schválení
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
        }
        else
        {
            // Případ A: Uživatel už v DB existuje (byl předem vytvořen sekretářkou/Office Managerem):
            // Pouze spárujeme google_id a avatar
            if (!user.IsActive)
            {
                return StatusCode(403, ApiResponse<AuthResponseDto>.Failure(
                    "ERR_USER_INACTIVE",
                    "Váš uživatelský účet byl deaktivován administrátorem."
                ));
            }

            if (!string.IsNullOrWhiteSpace(request.AvatarUrl) && user.AvatarUrl != request.AvatarUrl)
            {
                user.AvatarUrl = request.AvatarUrl;
            }
            if (!string.IsNullOrWhiteSpace(request.GoogleId) && string.IsNullOrEmpty(user.GoogleId))
            {
                user.GoogleId = request.GoogleId; // Spárování s existujícím profilem
            }

            // Pokud má uživatel pouze technický fallback (např. jmeno.prijmeni z e-mailu),
            // automaticky doplňme skutečné jméno z autorizovaného Google profilu
            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                var emailPrefix = email.Split('@')[0];
                if (string.IsNullOrWhiteSpace(user.DisplayName) ||
                    user.DisplayName.Equals(emailPrefix, StringComparison.OrdinalIgnoreCase) ||
                    (string.IsNullOrWhiteSpace(user.LastName) && request.Name.Contains(' ')))
                {
                    var nameParts = request.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    user.FirstName = nameParts.Length > 0 ? nameParts[0] : user.FirstName;
                    user.LastName = nameParts.Length > 1 ? string.Join(" ", nameParts.Skip(1)) : user.LastName;
                    user.DisplayName = request.Name;
                }
            }

            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync();
        }

        // 3. Vystavení JWT / tokenů dle specifikace
        var token = GenerateSimulatedJwtToken(user);
        var ctName = await _context.ContractTypes.AsNoTracking()
            .Where(c => c.Code == user.ContractType.ToString())
            .Select(c => c.Name)
            .FirstOrDefaultAsync();

        return Ok(ApiResponse<AuthResponseDto>.Success(new AuthResponseDto
        {
            AccessToken = token,
            RefreshToken = Guid.NewGuid().ToString("N"),
            ExpiresIn = 86400,
            User = MapAuthUserDto(user, ctName)
        }));
    }

    /// <summary>
    /// Získá stav schválení účtu a kontaktní osobu pro dokončení registrace (Office Manager / Admin).
    /// Přístupné pro každého přihlášeného uživatele z firemní domény.
    /// </summary>
    [HttpGet("pending-status")]
    public async Task<ActionResult<ApiResponse<PendingStatusResponseDto>>> GetPendingStatus([FromQuery] Guid? userId)
    {
        var targetUserId = userId ?? GetCurrentUserId();
        if (!targetUserId.HasValue)
        {
            return Unauthorized(ApiResponse<PendingStatusResponseDto>.Failure("ERR_UNAUTHORIZED", "Nejste přihlášen."));
        }

        var user = await _context.Users.FindAsync(targetUserId.Value);
        if (user == null)
        {
            return NotFound(ApiResponse<PendingStatusResponseDto>.Failure("ERR_USER_NOT_FOUND", "Uživatel nebyl nalezen."));
        }

        // 1. Vyhledání Office Managera
        var officeMgr = await _context.Users
            .Where(u => u.Role == UserRole.office_manager && u.IsActive && u.IsApproved)
            .OrderBy(u => u.LastName)
            .FirstOrDefaultAsync();

        // 2. Fallback na Administrátora
        User? adminMgr = null;
        if (officeMgr == null)
        {
            var admins = await _context.Users
                .Where(u => u.Role == UserRole.admin && u.IsActive && u.IsApproved)
                .ToListAsync();
            adminMgr = admins.OrderBy(u => u.CreatedAt).FirstOrDefault();
        }

        var contact = officeMgr ?? adminMgr;

        var contactDto = new ContactPersonDto
        {
            Name = contact?.DisplayName ?? "Administrátor systému",
            Role = contact != null ? UserDisplayHelper.GetRoleLabelCzech(contact.Role) : "Správce",
            Email = contact?.Email ?? (_config["VAPID:Subject"]?.Replace("mailto:", "") ?? "admin@firma.cz"),
            PhoneNumber = contact?.PhoneNumber ?? "+420 777 000 001"
        };

        return Ok(ApiResponse<PendingStatusResponseDto>.Success(new PendingStatusResponseDto
        {
            IsApproved = user.IsApproved,
            UserId = user.Id.ToString(),
            UserName = user.DisplayName,
            UserEmail = user.Email,
            ContactPerson = contactDto
        }));
    }

    /// <summary>
    /// Seznam všech nově přihlášených zaměstnanců čekajících na nastavení úvazku a schválení.
    /// </summary>
    [HttpGet("pending-users")]
    public async Task<ActionResult<ApiResponse<List<AuthUserDto>>>> GetPendingUsers()
    {
        var contractTypesMap = await _context.ContractTypes.AsNoTracking()
            .ToDictionaryAsync(c => c.Code, c => c.Name);

        var rawPending = await _context.Users
            .Where(u => !u.IsApproved)
            .ToListAsync();

        var pending = rawPending
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => MapAuthUserDto(
                u,
                contractTypesMap.TryGetValue(u.ContractType.ToString(), out var cName) ? cName : null,
                "Čeká na schválení úvazku"))
            .ToList();

        return Ok(ApiResponse<List<AuthUserDto>>.Success(pending));
    }

    /// <summary>
    /// Schválení nového zaměstnance a nastavení jeho úvazku (Office Manager / Admin).
    /// </summary>
    [HttpPost("approve-user")]
    public async Task<ActionResult<ApiResponse<AuthUserDto>>> ApproveUser([FromBody] ApproveUserRequestDto request)
    {
        var user = await _context.Users.FindAsync(request.UserId);
        if (user == null)
        {
            return NotFound(ApiResponse<AuthUserDto>.Failure("ERR_USER_NOT_FOUND", "Uživatel nebyl nalezen."));
        }

        var computedWeeklyHours = await ComputeWeeklyHoursBudgetAsync(request.ContractKind, request.ContractType);

        user.IsApproved = true;
        user.ApprovedAt = DateTimeOffset.UtcNow;
        user.Role = request.Role;
        user.ContractKind = request.ContractKind;
        user.ContractType = request.ContractType;
        user.WeeklyHoursBudget = request.WeeklyHoursBudget ?? computedWeeklyHours;
        user.IsPermanentHomeOffice = request.IsPermanentHomeOffice;
        user.UpdatedAt = DateTimeOffset.UtcNow;

        int currentYear = DateTimeOffset.UtcNow.Year;

        // Dynamické nastavení nároků podle číselníku absence_types a contract_types
        var ctEntity = await _context.ContractTypes.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Code == request.ContractType.ToString());
        decimal coeff = request.ContractKind == ContractKind.osvc ? 0m : (ctEntity?.Coefficient ?? 1.0m);

        var absenceTypes = await _context.AbsenceTypes
            .Where(t => t.IsActive && t.DefaultBudgetPeriod != BudgetPeriod.unlimited)
            .ToListAsync();

        var existingSettings = await _context.UserAbsenceSettings
            .Where(s => s.UserId == user.Id && s.Year == currentYear)
            .ToListAsync();

        foreach (var absType in absenceTypes)
        {
            if (request.ContractKind == ContractKind.osvc && !absType.AllowOsvc)
                continue;

            decimal? requestedCapacity = null;
            if (request.Allowances != null && request.Allowances.TryGetValue(absType.Code, out var dictVal))
            {
                requestedCapacity = dictVal;
            }
            else if (absType.Code == "vacation" && request.VacationDays.HasValue)
            {
                requestedCapacity = request.VacationDays.Value;
            }
            else if (absType.Code == "sick_day" && request.SickDays.HasValue)
            {
                requestedCapacity = request.SickDays.Value;
            }
            else if (absType.Code == "home_office" && request.HomeOfficeWeeklyDays.HasValue)
            {
                requestedCapacity = request.HomeOfficeWeeklyDays.Value;
            }
            else if (request.ContractKind == ContractKind.employee && absType.DefaultAllowance.HasValue)
            {
                requestedCapacity = absType.DefaultBudgetPeriod == BudgetPeriod.weekly
                    ? absType.DefaultAllowance.Value
                    : Math.Round(absType.DefaultAllowance.Value * coeff, 0);
            }

            if (requestedCapacity.HasValue)
            {
                var existing = existingSettings.FirstOrDefault(s => s.AbsenceTypeId == absType.Id);
                if (existing == null)
                {
                    _context.UserAbsenceSettings.Add(new UserAbsenceSetting
                    {
                        Id = Guid.NewGuid(),
                        UserId = user.Id,
                        AbsenceTypeId = absType.Id,
                        Year = currentYear,
                        BudgetPeriod = absType.DefaultBudgetPeriod,
                        AllocatedCapacity = requestedCapacity.Value,
                        CarriedOverDays = 0m,
                        MaxPerMonthOverride = absType.MaxPerMonthLimit,
                        IsPaid = true
                    });
                }
                else
                {
                    existing.AllocatedCapacity = requestedCapacity.Value;
                    existing.BudgetPeriod = absType.DefaultBudgetPeriod;
                    existing.MaxPerMonthOverride = absType.MaxPerMonthLimit;
                }
            }
        }

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<AuthUserDto>.Success(MapAuthUserDto(user, ctEntity?.Name)));
    }

    /// <summary>
    /// Dev endpoint: vygeneruje platný JWT token pro libovolnou testovací osobu v Dev módu.
    /// </summary>
    [HttpPost("dev-impersonate")]
    public async Task<ActionResult<ApiResponse<AuthResponseDto>>> DevImpersonate([FromBody] ImpersonateRequestDto request)
    {
        var user = await _context.Users.FindAsync(request.UserId);
        if (user == null)
        {
            return NotFound(ApiResponse<AuthResponseDto>.Failure("ERR_USER_NOT_FOUND", "Testovací osoba nebyla nalezena."));
        }

        var token = GenerateSimulatedJwtToken(user);
        var ctName = await _context.ContractTypes.AsNoTracking()
            .Where(c => c.Code == user.ContractType.ToString())
            .Select(c => c.Name)
            .FirstOrDefaultAsync();

        return Ok(ApiResponse<AuthResponseDto>.Success(new AuthResponseDto
        {
            AccessToken = token,
            RefreshToken = Guid.NewGuid().ToString("N"),
            ExpiresIn = 86400,
            User = MapAuthUserDto(user, ctName)
        }));
    }

    /// <summary>
    /// Získá profil aktuálně přihlášeného uživatele.
    /// </summary>
    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<AuthUserDto>>> GetMe()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(ApiResponse<AuthUserDto>.Failure("ERR_UNAUTHORIZED", "Nejste přihlášen."));
        }

        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null || !user.IsActive)
        {
            return NotFound(ApiResponse<AuthUserDto>.Failure("ERR_USER_NOT_FOUND", "Uživatel nebyl nalezen nebo je neaktivní."));
        }

        var ctName = await _context.ContractTypes.AsNoTracking()
            .Where(c => c.Code == user.ContractType.ToString())
            .Select(c => c.Name)
            .FirstOrDefaultAsync();

        return Ok(ApiResponse<AuthUserDto>.Success(MapAuthUserDto(user, ctName)));
    }

    [HttpPost("users/{userId}/permanent-home-office")]
    public async Task<ActionResult<ApiResponse<AuthUserDto>>> SetPermanentHomeOffice([FromRoute] Guid userId, [FromBody] SetPermanentHomeOfficeDto dto)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound(ApiResponse<AuthUserDto>.Failure("ERR_USER_NOT_FOUND", "Uživatel nebyl nalezen."));
        }

        user.IsPermanentHomeOffice = dto.IsPermanentHomeOffice;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();

        var ctName = await _context.ContractTypes.AsNoTracking()
            .Where(c => c.Code == user.ContractType.ToString())
            .Select(c => c.Name)
            .FirstOrDefaultAsync();

        return Ok(ApiResponse<AuthUserDto>.Success(MapAuthUserDto(user, ctName)));
    }

    [HttpPost("logout")]
    public ActionResult<ApiResponse<string>> Logout()
    {
        return Ok(ApiResponse<string>.Success("Odhlášení proběhlo úspěšně."));
    }

    private Guid? GetCurrentUserId()
    {
        if (Request.Headers.TryGetValue("Authorization", out var authHeader) && authHeader.ToString().StartsWith("Bearer "))
        {
            var token = authHeader.ToString().Substring("Bearer ".Length).Trim();
            try
            {
                var decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(token));
                var parts = decoded.Split(':');
                if (parts.Length > 0 && Guid.TryParse(parts[0], out var guidFromToken))
                {
                    return guidFromToken;
                }
            }
            catch { }
        }

        if (Request.Headers.TryGetValue("X-User-Id", out var headerVal) && Guid.TryParse(headerVal, out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private string GenerateSimulatedJwtToken(User user)
    {
        var payload = $"{user.Id}:{user.Email}:{user.Role}:{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        return Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(payload));
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var output = input.Replace('-', '+').Replace('_', '/');
        switch (output.Length % 4)
        {
            case 2: output += "=="; break;
            case 3: output += "="; break;
        }
        return Convert.FromBase64String(output);
    }
}

