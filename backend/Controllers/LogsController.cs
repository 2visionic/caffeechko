using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Dochazka.Api.Data;
using Dochazka.Api.Models;

namespace Dochazka.Api.Controllers;

public class CreateLogItemDto
{
    public string? UserId { get; set; }
    public LogType Type { get; set; } = LogType.web;
    public string Status { get; set; } = string.Empty;
    public DateTimeOffset? DateTime { get; set; }
}

public class CreateLogRequestDto : CreateLogItemDto
{
    public List<CreateLogItemDto>? Items { get; set; }
}

[ApiController]
[Route("api/logs")]
public class LogsController : ControllerBase
{
    private readonly DochazkaDbContext _context;

    public LogsController(DochazkaDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<SystemLog>>>> GetLogs(
        [FromQuery] int limit = 100,
        [FromQuery] LogType? type = null,
        [FromQuery] string? userId = null)
    {
        var query = _context.Logs.AsNoTracking().AsQueryable();

        if (type.HasValue)
        {
            query = query.Where(l => l.Type == type.Value);
        }

        if (!string.IsNullOrWhiteSpace(userId))
        {
            query = query.Where(l => l.UserId == userId);
        }

        var allItems = await query.ToListAsync();
        var items = allItems
            .OrderByDescending(l => l.DateTime)
            .Take(Math.Clamp(limit, 1, 500))
            .ToList();

        return Ok(ApiResponse<List<SystemLog>>.Success(items));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<int>>> CreateLog([FromBody] CreateLogRequestDto request)
    {
        var headerUserId = ResolveUserIdFromHeaders();
        var entriesToSave = new List<SystemLog>();

        if (request.Items != null && request.Items.Count > 0)
        {
            foreach (var item in request.Items)
            {
                if (string.IsNullOrWhiteSpace(item.Status)) continue;
                entriesToSave.Add(new SystemLog
                {
                    Id = Guid.NewGuid(),
                    UserId = NormalizeUserId(item.UserId, headerUserId),
                    Type = item.Type,
                    Status = item.Status.Length > 500 ? item.Status.Substring(0, 500) : item.Status,
                    DateTime = (item.DateTime ?? DateTimeOffset.UtcNow).ToUniversalTime()
                });
            }
        }
        else if (!string.IsNullOrWhiteSpace(request.Status))
        {
            entriesToSave.Add(new SystemLog
            {
                Id = Guid.NewGuid(),
                UserId = NormalizeUserId(request.UserId, headerUserId),
                Type = request.Type,
                Status = request.Status.Length > 500 ? request.Status.Substring(0, 500) : request.Status,
                DateTime = (request.DateTime ?? DateTimeOffset.UtcNow).ToUniversalTime()
            });
        }

        if (entriesToSave.Count > 0)
        {
            _context.Logs.AddRange(entriesToSave);
            await _context.SaveChangesAsync();
        }

        return Ok(ApiResponse<int>.Success(entriesToSave.Count));
    }

    [HttpDelete]
    public async Task<ActionResult<ApiResponse<int>>> ClearLogs()
    {
        var deletedCount = await _context.Database.ExecuteSqlRawAsync("DELETE FROM logs;");
        return Ok(ApiResponse<int>.Success(deletedCount));
    }

    private string NormalizeUserId(string? explicitUserId, string headerUserId)
    {
        if (!string.IsNullOrWhiteSpace(explicitUserId) &&
            !explicitUserId.Equals("anonymous", StringComparison.OrdinalIgnoreCase) &&
            explicitUserId != "0")
        {
            return explicitUserId.Trim();
        }
        return headerUserId;
    }

    private string ResolveUserIdFromHeaders()
    {
        if (Request.Headers.TryGetValue("Authorization", out var authHeader) &&
            authHeader.ToString().StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var token = authHeader.ToString().Substring("Bearer ".Length).Trim();
            try
            {
                var decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(token));
                var parts = decoded.Split(':');
                if (parts.Length > 0 && Guid.TryParse(parts[0], out var guidFromToken))
                {
                    return guidFromToken.ToString();
                }
            }
            catch { }
        }

        if (Request.Headers.TryGetValue("X-User-Id", out var headerVal))
        {
            var val = headerVal.ToString().Trim();
            if (!string.IsNullOrEmpty(val) && !val.Equals("anonymous", StringComparison.OrdinalIgnoreCase))
            {
                return val;
            }
        }

        return "0";
    }
}
