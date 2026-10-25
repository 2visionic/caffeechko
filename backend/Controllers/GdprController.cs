using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Dochazka.Api.Data;
using Dochazka.Api.Models;

namespace Dochazka.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GdprController : ControllerBase
{
    private readonly DochazkaDbContext _context;

    public GdprController(DochazkaDbContext context)
    {
        _context = context;
    }

    public static async Task EnsureGdprTablesAsync(DochazkaDbContext context, bool seedDefaultIfEmpty = false)
    {
        try
        {
            var conn = context.Database.GetDbConnection();
            bool wasClosed = conn.State != System.Data.ConnectionState.Open;
            if (wasClosed) await conn.OpenAsync();
            try
            {
                await EnsureGdprTablesOnConnectionAsync(conn, seedDefaultIfEmpty);
            }
            finally
            {
                if (wasClosed) await conn.CloseAsync();
            }
        }
        catch { }
    }

    public static async Task EnsureGdprTablesOnConnectionAsync(DbConnection conn, bool seedDefaultIfEmpty = false)
    {
        bool tableAlreadyExisted = false;
        using (var checkCmd = conn.CreateCommand())
        {
            checkCmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='gdpr_documents';";
            tableAlreadyExisted = Convert.ToInt32(await checkCmd.ExecuteScalarAsync()) > 0;
        }

        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS gdpr_documents (
                    Id TEXT PRIMARY KEY,
                    ValidFrom TEXT NOT NULL,
                    Content TEXT NOT NULL,
                    CreatedAt TEXT NOT NULL,
                    UpdatedAt TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS IX_gdpr_documents_ValidFrom ON gdpr_documents (ValidFrom);
                CREATE TABLE IF NOT EXISTS gdpr_sends (
                    Id TEXT PRIMARY KEY,
                    GdprDocumentId TEXT NOT NULL,
                    UserId TEXT NOT NULL,
                    UserEmail TEXT NOT NULL,
                    IsGranted INTEGER NOT NULL DEFAULT 0,
                    SentAt TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS IX_gdpr_sends_GdprDocumentId ON gdpr_sends (GdprDocumentId);
                CREATE INDEX IF NOT EXISTS IX_gdpr_sends_UserId ON gdpr_sends (UserId);";
            await cmd.ExecuteNonQueryAsync();
        }

        if (seedDefaultIfEmpty || !tableAlreadyExisted)
        {
            using var countCmd = conn.CreateCommand();
            countCmd.CommandText = "SELECT COUNT(*) FROM gdpr_documents;";
            var count = Convert.ToInt32(await countCmd.ExecuteScalarAsync());
            if (count == 0)
            {
                using var insertCmd = conn.CreateCommand();
                insertCmd.CommandText = @"
                    INSERT INTO gdpr_documents (Id, ValidFrom, Content, CreatedAt, UpdatedAt)
                    VALUES ($id, $validFrom, $content, $createdAt, $updatedAt);";
                var pId = insertCmd.CreateParameter();
                pId.ParameterName = "$id";
                pId.Value = GdprHelper.DefaultSeedGdprId.ToString();
                insertCmd.Parameters.Add(pId);

                var pVf = insertCmd.CreateParameter();
                pVf.ParameterName = "$validFrom";
                pVf.Value = "2026-01-01";
                insertCmd.Parameters.Add(pVf);

                var pContent = insertCmd.CreateParameter();
                pContent.ParameterName = "$content";
                pContent.Value = GdprHelper.DefaultGdprHtmlContent;
                insertCmd.Parameters.Add(pContent);

                var nowStr = "2026-01-01T08:00:00.0000000+00:00";
                var pCreated = insertCmd.CreateParameter();
                pCreated.ParameterName = "$createdAt";
                pCreated.Value = nowStr;
                insertCmd.Parameters.Add(pCreated);

                var pUpdated = insertCmd.CreateParameter();
                pUpdated.ParameterName = "$updatedAt";
                pUpdated.Value = nowStr;
                insertCmd.Parameters.Add(pUpdated);

                await insertCmd.ExecuteNonQueryAsync();
            }
        }
    }

    private static string GetTodayLocalIso()
    {
        var nowLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.Local);
        return nowLocal.ToString("yyyy-MM-dd");
    }

    private static string GetTomorrowLocalIso()
    {
        var tomorrowLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.Local).AddDays(1);
        return tomorrowLocal.ToString("yyyy-MM-dd");
    }

    /// <summary>
    /// Vrátí seznam všech záznamů z tabulky gdpr_documents seřazených od nejnovějších (pro Nastavení systému -> GDPR).
    /// </summary>
    [HttpGet("documents")]
    public async Task<ActionResult<ApiResponse<List<GdprDocumentDto>>>> GetDocuments()
    {
        await EnsureGdprTablesAsync(_context);
        var todayIso = GetTodayLocalIso();

        var docs = (await _context.GdprDocuments.ToListAsync())
            .OrderByDescending(d => d.ValidFrom)
            .ThenByDescending(d => d.CreatedAt)
            .ToList();

        var sends = await _context.GdprSends.ToListAsync();
        var activeDoc = GdprHelper.GetActiveDocument(docs, todayIso);

        var result = docs.Select(d =>
        {
            var docSends = sends
                .Where(s => s.GdprDocumentId == d.Id)
                .OrderByDescending(s => s.SentAt)
                .ToList();

            var latestByUser = docSends
                .GroupBy(s => s.UserId)
                .Select(g => g.First())
                .ToList();

            return new GdprDocumentDto
            {
                Id = d.Id,
                ValidFrom = d.ValidFrom,
                Content = d.Content,
                CreatedAt = d.CreatedAt.ToString("O"),
                UpdatedAt = d.UpdatedAt.ToString("O"),
                SendsCount = docSends.Count,
                GrantedCount = latestByUser.Count(s => s.IsGranted),
                RevokedCount = latestByUser.Count(s => !s.IsGranted),
                IsCurrentlyActive = activeDoc != null && activeDoc.Id == d.Id
            };
        }).ToList();

        return Ok(ApiResponse<List<GdprDocumentDto>>.Success(result));
    }

    /// <summary>
    /// Založí nový záznam GDPR v tabulce gdpr_documents.
    /// </summary>
    [HttpPost("documents")]
    public async Task<ActionResult<ApiResponse<List<GdprDocumentDto>>>> CreateDocument([FromBody] SaveGdprDocumentDto dto)
    {
        await EnsureGdprTablesAsync(_context);

        var validFrom = (dto.ValidFrom ?? string.Empty).Trim();
        var content = (dto.Content ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(validFrom))
        {
            return BadRequest(ApiResponse<List<GdprDocumentDto>>.Failure("ERR_INVALID_DATE", "Datum platnosti od je povinné."));
        }
        var tomorrowIso = GetTomorrowLocalIso();
        if (string.CompareOrdinal(validFrom, tomorrowIso) < 0)
        {
            return BadRequest(ApiResponse<List<GdprDocumentDto>>.Failure("ERR_DATE_TOO_EARLY", "Datum platnosti od lze nastavit nejdříve od následujícího dne."));
        }
        if (string.IsNullOrWhiteSpace(content))
        {
            return BadRequest(ApiResponse<List<GdprDocumentDto>>.Failure("ERR_EMPTY_CONTENT", "Text GDPR souhlasu je povinný."));
        }

        var now = DateTimeOffset.UtcNow;
        var doc = new GdprDocument
        {
            Id = Guid.NewGuid(),
            ValidFrom = validFrom,
            Content = content,
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.GdprDocuments.Add(doc);
        await _context.SaveChangesAsync();

        return await GetDocuments();
    }

    /// <summary>
    /// Upraví existující záznam GDPR pouze tehdy, pokud má 0 záznamů v tabulce gdpr_sends.
    /// </summary>
    [HttpPut("documents/{id}")]
    public async Task<ActionResult<ApiResponse<List<GdprDocumentDto>>>> UpdateDocument([FromRoute] Guid id, [FromBody] SaveGdprDocumentDto dto)
    {
        await EnsureGdprTablesAsync(_context);

        var allDocs = await _context.GdprDocuments.ToListAsync();
        var doc = allDocs.FirstOrDefault(d => d.Id == id);
        if (doc == null)
        {
            return NotFound(ApiResponse<List<GdprDocumentDto>>.Failure("ERR_NOT_FOUND", "Záznam GDPR nebyl nalezen."));
        }

        var allSends = await _context.GdprSends.ToListAsync();
        var sendsCount = allSends.Count(s => s.GdprDocumentId == doc.Id);
        if (sendsCount > 0)
        {
            return BadRequest(ApiResponse<List<GdprDocumentDto>>.Failure(
                "ERR_GDPR_LOCKED",
                "Tento záznam GDPR již obsahuje odeslané záznamy od uživatelů a nelze jej měnit. Založte prosím nový záznam GDPR."));
        }

        var validFrom = (dto.ValidFrom ?? string.Empty).Trim();
        var content = (dto.Content ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(validFrom))
        {
            return BadRequest(ApiResponse<List<GdprDocumentDto>>.Failure("ERR_INVALID_DATE", "Datum platnosti od je povinné."));
        }
        var tomorrowIso = GetTomorrowLocalIso();
        if (string.CompareOrdinal(validFrom, tomorrowIso) < 0)
        {
            return BadRequest(ApiResponse<List<GdprDocumentDto>>.Failure("ERR_DATE_TOO_EARLY", "Datum platnosti od lze nastavit nejdříve od následujícího dne."));
        }
        if (string.IsNullOrWhiteSpace(content))
        {
            return BadRequest(ApiResponse<List<GdprDocumentDto>>.Failure("ERR_EMPTY_CONTENT", "Text GDPR souhlasu je povinný."));
        }

        doc.ValidFrom = validFrom;
        doc.Content = content;
        doc.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync();
        return await GetDocuments();
    }

    /// <summary>
    /// Smaže záznam GDPR pouze tehdy, pokud má 0 záznamů v tabulce gdpr_sends.
    /// </summary>
    [HttpDelete("documents/{id}")]
    public async Task<ActionResult<ApiResponse<List<GdprDocumentDto>>>> DeleteDocument([FromRoute] Guid id)
    {
        await EnsureGdprTablesAsync(_context);

        var allDocs = await _context.GdprDocuments.ToListAsync();
        var doc = allDocs.FirstOrDefault(d => d.Id == id);
        if (doc == null)
        {
            return NotFound(ApiResponse<List<GdprDocumentDto>>.Failure("ERR_NOT_FOUND", "Záznam GDPR nebyl nalezen."));
        }

        var allSends = await _context.GdprSends.ToListAsync();
        var sendsCount = allSends.Count(s => s.GdprDocumentId == doc.Id);
        if (sendsCount > 0)
        {
            return BadRequest(ApiResponse<List<GdprDocumentDto>>.Failure(
                "ERR_GDPR_LOCKED",
                "Tento záznam GDPR již obsahuje odeslané záznamy od uživatelů a nelze jej smazat."));
        }

        _context.GdprDocuments.Remove(doc);
        await _context.SaveChangesAsync();
        return await GetDocuments();
    }

    /// <summary>
    /// Vyprázdní tabulku gdpr_sends (všechny udělené a neudělené souhlasy) - pro vývojářskou lištu (RESET GDPR).
    /// </summary>
    [HttpDelete("sends")]
    public async Task<ActionResult<ApiResponse<int>>> ResetGdprSends()
    {
        await EnsureGdprTablesAsync(_context);
        var allSends = await _context.GdprSends.ToListAsync();
        var count = allSends.Count;
        if (count > 0)
        {
            _context.GdprSends.RemoveRange(allSends);
            await _context.SaveChangesAsync();
        }
        return Ok(ApiResponse<int>.Success(count));
    }

    /// <summary>
    /// Vrátí přehled GDPR pro konkrétní osobu:
    /// - aktivní GDPR dokument (ValidFrom <= dnes, nejnovější)
    /// - aktuální stav souhlasu osoby na aktivním GDPR dokumentu (granted / revoked / unfilled)
    /// - seznam všech platných GDPR (i minulých) seřazených od nejnovějších a u každého subřádky všech odeslaných voleb osoby od nejnovějšího.
    /// </summary>
    [HttpGet("user/{userId}")]
    public async Task<ActionResult<ApiResponse<UserGdprOverviewDto>>> GetUserOverview([FromRoute] Guid userId)
    {
        await EnsureGdprTablesAsync(_context);
        var overview = await BuildUserOverviewAsync(userId, unchanged: false);
        return Ok(ApiResponse<UserGdprOverviewDto>.Success(overview));
    }

    /// <summary>
    /// Uloží volbu uživatele (Souhlasím / Nesouhlasím) do tabulky gdpr_sends.
    /// Pokud uživatel vybere stejnou volbu, v jaké jeho souhlas pro daný dokument již je, nic neaktualizujeme.
    /// </summary>
    [HttpPost("submit")]
    public async Task<ActionResult<ApiResponse<UserGdprOverviewDto>>> SubmitConsent([FromBody] SubmitGdprConsentDto dto)
    {
        await EnsureGdprTablesAsync(_context);

        var user = await _context.Users.FindAsync(dto.UserId);
        if (user == null)
        {
            return NotFound(ApiResponse<UserGdprOverviewDto>.Failure("ERR_USER_NOT_FOUND", "Osoba nebyla nalezena."));
        }

        var todayIso = GetTodayLocalIso();
        var allDocs = await _context.GdprDocuments.ToListAsync();
        GdprDocument? targetDoc = null;
        if (dto.GdprDocumentId.HasValue)
        {
            targetDoc = allDocs.FirstOrDefault(d => d.Id == dto.GdprDocumentId.Value);
        }
        targetDoc ??= GdprHelper.GetActiveDocument(allDocs, todayIso);

        if (targetDoc == null)
        {
            return BadRequest(ApiResponse<UserGdprOverviewDto>.Failure("ERR_NO_ACTIVE_GDPR", "V systému zatím neexistuje žádný platný záznam GDPR."));
        }

        var existingUserSends = (await _context.GdprSends
            .Where(s => s.GdprDocumentId == targetDoc.Id && s.UserId == user.Id)
            .ToListAsync())
            .OrderByDescending(s => s.SentAt)
            .ToList();

        var latestSend = existingUserSends.FirstOrDefault();
        if (latestSend != null && latestSend.IsGranted == dto.IsGranted)
        {
            // Stejná volba, v jaké již GDPR je -> nic neukládáme a jen vracíme stav
            var unchangedOverview = await BuildUserOverviewAsync(user.Id, unchanged: true);
            return Ok(ApiResponse<UserGdprOverviewDto>.Success(unchangedOverview));
        }

        var newSend = new GdprSend
        {
            Id = Guid.NewGuid(),
            GdprDocumentId = targetDoc.Id,
            UserId = user.Id,
            UserEmail = !string.IsNullOrWhiteSpace(user.Email) ? user.Email : (dto.UserEmail ?? string.Empty),
            IsGranted = dto.IsGranted,
            SentAt = DateTimeOffset.UtcNow
        };

        _context.GdprSends.Add(newSend);
        await _context.SaveChangesAsync();

        var updatedOverview = await BuildUserOverviewAsync(user.Id, unchanged: false);
        return Ok(ApiResponse<UserGdprOverviewDto>.Success(updatedOverview));
    }

    private async Task<UserGdprOverviewDto> BuildUserOverviewAsync(Guid userId, bool unchanged)
    {
        var todayIso = GetTodayLocalIso();
        var allDocs = await _context.GdprDocuments.ToListAsync();
        var validDocs = allDocs
            .Where(d => !string.IsNullOrWhiteSpace(d.ValidFrom) && string.CompareOrdinal(d.ValidFrom, todayIso) <= 0)
            .OrderByDescending(d => d.ValidFrom)
            .ThenByDescending(d => d.CreatedAt)
            .ToList();

        var activeDoc = validDocs.FirstOrDefault();
        var userSends = (await _context.GdprSends
            .Where(s => s.UserId == userId)
            .ToListAsync())
            .OrderByDescending(s => s.SentAt)
            .ToList();

        var activeLatestSend = activeDoc != null
            ? userSends.FirstOrDefault(s => s.GdprDocumentId == activeDoc.Id)
            : null;

        string currentStatus = activeDoc == null
            ? "unfilled"
            : activeLatestSend == null
            ? "unfilled"
            : activeLatestSend.IsGranted
            ? "granted"
            : "revoked";

        var validDocDtos = validDocs.Select(d =>
        {
            var sendsForDoc = userSends
                .Where(s => s.GdprDocumentId == d.Id)
                .OrderByDescending(s => s.SentAt)
                .Select(s => new GdprSendDto
                {
                    Id = s.Id,
                    GdprDocumentId = s.GdprDocumentId,
                    UserId = s.UserId,
                    UserEmail = s.UserEmail,
                    IsGranted = s.IsGranted,
                    SentAt = s.SentAt.ToString("O")
                })
                .ToList();

            return new GdprDocumentDto
            {
                Id = d.Id,
                ValidFrom = d.ValidFrom,
                Content = d.Content,
                CreatedAt = d.CreatedAt.ToString("O"),
                UpdatedAt = d.UpdatedAt.ToString("O"),
                SendsCount = sendsForDoc.Count,
                IsCurrentlyActive = activeDoc != null && activeDoc.Id == d.Id,
                UserSends = sendsForDoc
            };
        }).ToList();

        return new UserGdprOverviewDto
        {
            ActiveGdprId = activeDoc?.Id,
            ActiveValidFrom = activeDoc?.ValidFrom,
            ActiveContent = activeDoc?.Content,
            CurrentStatus = currentStatus,
            LatestSentAt = activeLatestSend?.SentAt.ToString("O"),
            Unchanged = unchanged,
            ValidDocuments = validDocDtos
        };
    }
}
