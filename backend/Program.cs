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

// 2. Database configuration (PostgreSQL with SQLite local fallback for instant dev mode)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var usePostgres = builder.Configuration.GetValue<bool>("UsePostgres", false);

builder.Services.AddDbContext<DochazkaDbContext>(options =>
{
    if (usePostgres && !string.IsNullOrEmpty(connectionString))
    {
        options.UseNpgsql(connectionString);
    }
    else
    {
        // Zero-friction dev database
        options.UseSqlite("Data Source=dochazka_dev.db");
    }
});

// 3. CORS configuration (allows frontend on custom dev port 5200)
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCorsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5200", "http://localhost:5173", "http://localhost:3000")
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

app.UseAuthorization();

app.MapControllers();

app.Run();
