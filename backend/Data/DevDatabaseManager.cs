using System;
using Microsoft.AspNetCore.Http;

namespace Dochazka.Api.Data;

public class DevDatabaseManager
{
    private static string _activeMode = "dev"; // "dev" | "clean"
    private readonly IHttpContextAccessor _httpContextAccessor;

    public DevDatabaseManager(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string CurrentMode
    {
        get
        {
            var header = _httpContextAccessor.HttpContext?.Request.Headers["X-Database-Mode"].ToString();
            if (!string.IsNullOrEmpty(header) && (header.Equals("clean", StringComparison.OrdinalIgnoreCase) || header.Equals("dev", StringComparison.OrdinalIgnoreCase)))
            {
                return header.ToLowerInvariant();
            }
            return _activeMode;
        }
    }

    public void SetGlobalMode(string mode)
    {
        _activeMode = mode.ToLowerInvariant() == "clean" ? "clean" : "dev";
    }

    public string GetConnectionString()
    {
        EnsureDatabaseExists();
        return CurrentMode == "clean"
            ? "Data Source=dochazka_clean.db"
            : "Data Source=dochazka_dev.db";
    }

    public string GetDatabaseFileName()
    {
        return CurrentMode == "clean" ? "dochazka_clean.db" : "dochazka_dev.db";
    }

    private void EnsureDatabaseExists()
    {
        var targetFile = GetDatabaseFileName();
        if (!System.IO.File.Exists(targetFile))
        {
            var templateName = CurrentMode == "clean"
                ? "dochazka_clean.template.db"
                : "dochazka_dev.template.db";

            var candidates = new[]
            {
                templateName,
                System.IO.Path.Combine("backend", templateName),
                System.IO.Path.Combine(AppContext.BaseDirectory, templateName),
                System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), templateName),
                System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "backend", templateName)
            };

            foreach (var template in candidates)
            {
                if (System.IO.File.Exists(template))
                {
                    try
                    {
                        System.IO.File.Copy(template, targetFile, true);
                        break;
                    }
                    catch { }
                }
            }
        }
    }
}
