using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Scalar.AspNetCore;
using Dochazka.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// 1. Add services
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddOpenApi();

builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<DevDatabaseManager>();

// 2. Database configuration (PostgreSQL with SQLite local fallback for instant dev mode)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var usePostgres = builder.Configuration.GetValue<bool>("UsePostgres", false);

builder.Services.AddDbContext<DochazkaDbContext>((serviceProvider, options) =>
{
    if (usePostgres && !string.IsNullOrEmpty(connectionString))
    {
        options.UseNpgsql(connectionString);
    }
});

// 3. CORS configuration (allows frontend on custom dev port 5200 and any local dev origin)
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCorsPolicy", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
              {
                  if (string.IsNullOrEmpty(origin)) return false;
                  try
                  {
                      var uri = new Uri(origin);
                      return uri.Host == "localhost" || uri.Host == "127.0.0.1" || uri.Host == "::1";
                  }
                  catch
                  {
                      return false;
                  }
              })
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// 4. Initialize Database & Seed
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<DochazkaDbContext>();
    await context.Database.EnsureCreatedAsync();
    await DbInitializer.SeedAsync(context);
}

// 5. Middleware Pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // Interactive documentation at /scalar/v1
}

app.UseCors("DevCorsPolicy");

// 5b. Universal Audit & Error Logging Middleware -> table 'logs'
app.Use(async (httpContext, next) =>
{
    var path = httpContext.Request.Path.Value ?? "";
    if (!path.StartsWith("/api", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/api/logs", StringComparison.OrdinalIgnoreCase))
    {
        await next();
        return;
    }

    var method = httpContext.Request.Method;
    var userId = "0";

    if (httpContext.Request.Headers.TryGetValue("Authorization", out var authHeader) &&
        authHeader.ToString().StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    {
        var token = authHeader.ToString().Substring("Bearer ".Length).Trim();
        try
        {
            var decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(token));
            var parts = decoded.Split(':');
            if (parts.Length > 0 && Guid.TryParse(parts[0], out var guidFromToken))
            {
                userId = guidFromToken.ToString();
            }
        }
        catch { }
    }

    if (userId == "0" && httpContext.Request.Headers.TryGetValue("X-User-Id", out var xUserId))
    {
        var val = xUserId.ToString().Trim();
        if (!string.IsNullOrEmpty(val) && !val.Equals("anonymous", StringComparison.OrdinalIgnoreCase))
        {
            userId = val;
        }
    }

    if (userId == "0" && httpContext.Request.Query.TryGetValue("userId", out var qUserId))
    {
        var val = qUserId.ToString().Trim();
        if (!string.IsNullOrEmpty(val) && !val.Equals("anonymous", StringComparison.OrdinalIgnoreCase))
        {
            userId = val;
        }
    }

    var logType = Dochazka.Api.Models.LogType.api;
    if (path.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase))
        logType = Dochazka.Api.Models.LogType.auth;
    else if (path.Contains("nfc", StringComparison.OrdinalIgnoreCase))
        logType = Dochazka.Api.Models.LogType.nfc;
    else if (path.StartsWith("/api/dev", StringComparison.OrdinalIgnoreCase))
        logType = Dochazka.Api.Models.LogType.system;

    var originalBodyStream = httpContext.Response.Body;
    await using var responseBody = new System.IO.MemoryStream();
    httpContext.Response.Body = responseBody;

    int statusCode = 200;
    string extraDetail = "";

    try
    {
        await next();
        statusCode = httpContext.Response.StatusCode;

        responseBody.Seek(0, System.IO.SeekOrigin.Begin);
        var responseText = await new System.IO.StreamReader(responseBody).ReadToEndAsync();
        responseBody.Seek(0, System.IO.SeekOrigin.Begin);
        await responseBody.CopyToAsync(originalBodyStream);

        if (!string.IsNullOrWhiteSpace(responseText) && responseText.TrimStart().StartsWith("{"))
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(responseText);
                var root = doc.RootElement;

                if (userId == "0" &&
                    root.TryGetProperty("data", out var dataEl) &&
                    dataEl.ValueKind == System.Text.Json.JsonValueKind.Object)
                {
                    if (dataEl.TryGetProperty("user", out var userEl) &&
                        userEl.ValueKind == System.Text.Json.JsonValueKind.Object &&
                        userEl.TryGetProperty("id", out var idEl) &&
                        idEl.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        userId = idEl.GetString() ?? "0";
                    }
                    else if (dataEl.TryGetProperty("userId", out var uIdEl) &&
                             uIdEl.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        userId = uIdEl.GetString() ?? "0";
                    }
                }

                if (root.TryGetProperty("error", out var errEl) &&
                    errEl.ValueKind == System.Text.Json.JsonValueKind.Object)
                {
                    var code = errEl.TryGetProperty("code", out var cEl) ? cEl.GetString() : "ERR";
                    var msg = errEl.TryGetProperty("message", out var mEl) ? mEl.GetString() : "";
                    extraDetail = !string.IsNullOrEmpty(msg) ? $" [{code}: {msg}]" : $" [{code}]";
                }
            }
            catch { }
        }
    }
    catch (Exception ex)
    {
        statusCode = 500;
        extraDetail = $" [EXCEPTION: {ex.Message}]";
        throw;
    }
    finally
    {
        httpContext.Response.Body = originalBodyStream;
        try
        {
            using var logScope = app.Services.CreateScope();
            var db = logScope.ServiceProvider.GetRequiredService<DochazkaDbContext>();
            var statusStr = $"{statusCode} {method} {path}{extraDetail}";
            if (statusStr.Length > 500) statusStr = statusStr.Substring(0, 500);

            db.Logs.Add(new Dochazka.Api.Models.SystemLog
            {
                Id = Guid.NewGuid(),
                UserId = string.IsNullOrWhiteSpace(userId) ? "0" : userId,
                Type = logType,
                Status = statusStr,
                DateTime = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }
        catch { }
    }
});

app.UseAuthorization();

app.MapControllers();

app.Run();
