using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Dochazka.Api.Models;

namespace Dochazka.Api.Data;

public static class RealisticDevDataSeeder
{
    public static async Task<object> SeedRealisticDevDataAsync(DochazkaDbContext context)
    {
        var nowUtc = DateTimeOffset.UtcNow;
        var localTz = TimeZoneInfo.Local;

        DateTimeOffset LocalToUtc(int year, int month, int day, int hour, int minute)
        {
            var dt = new DateTime(year, month, day, hour, minute, 0, DateTimeKind.Unspecified);
            var offset = localTz.GetUtcOffset(dt);
            return new DateTimeOffset(dt, offset).ToUniversalTime();
        }

        DateTimeOffset UtcDate(int year, int month, int day, int hour = 0, int minute = 0)
        {
            return new DateTimeOffset(year, month, day, hour, minute, 0, TimeSpan.Zero);
        }

        // 1. Workplaces
        var prahaId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var brnoId = Guid.Parse("22222222-2222-2222-2222-222222222222");

        // 2. Personas IDs
        var janId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");     // Admin
        var davidId = Guid.Parse("77777777-7777-7777-7777-777777777777");   // Manager
        var martinaId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"); // Office Manager
        var janaId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");    // Team Lead (Vedoucí)
        var tomasId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");   // Colleague (0.5 HPP)
        var martinId = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");  // Colleague (0.25 HPP)
        var lukasId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");   // Colleague (OSVČ)
        var eliskaId = Guid.Parse("88888888-8888-8888-8888-888888888888");  // Colleague (1.0 HPP)

        var userSpecs = new[]
        {
            new
            {
                Id = janId,
                Email = "admin@firma.cz",
                FirstName = "Jan",
                LastName = "Novotný",
                DisplayName = "Jan Novotný",
                Phone = "+420 777 123 456",
                Role = UserRole.admin,
                Kind = ContractKind.employee,
                Type = ContractType.full_time,
                Comp = CompensationType.fixed_rate,
                Hourly = (decimal?)null,
                Fixed = (decimal?)95000m,
                WeeklyBudget = 40.00m,
                ManagerId = (Guid?)null,
                ParentPersonId = (Guid?)null
            },
            new
            {
                Id = davidId,
                Email = "david.sykora@firma.cz",
                FirstName = "David",
                LastName = "Sýkora",
                DisplayName = "David Sýkora",
                Phone = "+420 777 789 012",
                Role = UserRole.manager,
                Kind = ContractKind.employee,
                Type = ContractType.full_time,
                Comp = CompensationType.fixed_rate,
                Hourly = (decimal?)null,
                Fixed = (decimal?)88000m,
                WeeklyBudget = 40.00m,
                ManagerId = (Guid?)null,
                ParentPersonId = (Guid?)null
            },
            new
            {
                Id = martinaId,
                Email = "martina.svobodova@firma.cz",
                FirstName = "Martina",
                LastName = "Svobodová",
                DisplayName = "Martina Svobodová",
                Phone = "+420 777 345 678",
                Role = UserRole.office_manager,
                Kind = ContractKind.employee,
                Type = ContractType.full_time,
                Comp = CompensationType.fixed_rate,
                Hourly = (decimal?)null,
                Fixed = (decimal?)62000m,
                WeeklyBudget = 40.00m,
                ManagerId = (Guid?)davidId,
                ParentPersonId = (Guid?)null
            },
            new
            {
                Id = janaId,
                Email = "jana.novakova@firma.cz",
                FirstName = "Jana",
                LastName = "Nováková",
                DisplayName = "Jana Nováková",
                Phone = "+420 777 234 567",
                Role = UserRole.team_lead,
                Kind = ContractKind.employee,
                Type = ContractType.full_time,
                Comp = CompensationType.fixed_rate,
                Hourly = (decimal?)null,
                Fixed = (decimal?)74000m,
                WeeklyBudget = 40.00m,
                ManagerId = (Guid?)davidId,
                ParentPersonId = (Guid?)null
            },
            new
            {
                Id = tomasId,
                Email = "tomas.dvorak@firma.cz",
                FirstName = "Tomáš",
                LastName = "Dvořák",
                DisplayName = "Tomáš Dvořák",
                Phone = "+420 777 456 789",
                Role = UserRole.colleague,
                Kind = ContractKind.employee,
                Type = ContractType.half_time,
                Comp = CompensationType.hourly,
                Hourly = (decimal?)420m,
                Fixed = (decimal?)null,
                WeeklyBudget = 20.00m,
                ManagerId = (Guid?)davidId,
                ParentPersonId = (Guid?)janaId
            },
            new
            {
                Id = martinId,
                Email = "martin.kovar@firma.cz",
                FirstName = "Martin",
                LastName = "Kovář",
                DisplayName = "Martin Kovář",
                Phone = "+420 777 678 901",
                Role = UserRole.colleague,
                Kind = ContractKind.employee,
                Type = ContractType.part_time,
                Comp = CompensationType.hourly,
                Hourly = (decimal?)380m,
                Fixed = (decimal?)null,
                WeeklyBudget = 10.00m,
                ManagerId = (Guid?)davidId,
                ParentPersonId = (Guid?)janaId
            },
            new
            {
                Id = lukasId,
                Email = "lukas.cerny@firma.cz",
                FirstName = "Lukáš",
                LastName = "Černý",
                DisplayName = "Lukáš Černý",
                Phone = "+420 777 567 890",
                Role = UserRole.colleague,
                Kind = ContractKind.osvc,
                Type = ContractType.full_time,
                Comp = CompensationType.hourly,
                Hourly = (decimal?)650m,
                Fixed = (decimal?)null,
                WeeklyBudget = 40.00m,
                ManagerId = (Guid?)davidId,
                ParentPersonId = (Guid?)janaId
            },
            new
            {
                Id = eliskaId,
                Email = "eliska.kralova@firma.cz",
                FirstName = "Eliška",
                LastName = "Králová",
                DisplayName = "Eliška Králová",
                Phone = "+420 777 890 123",
                Role = UserRole.colleague,
                Kind = ContractKind.employee,
                Type = ContractType.full_time,
                Comp = CompensationType.fixed_rate,
                Hourly = (decimal?)null,
                Fixed = (decimal?)68000m,
                WeeklyBudget = 40.00m,
                ManagerId = (Guid?)davidId,
                ParentPersonId = (Guid?)null
            }
        };

        var existingUsers = await context.Users.ToListAsync();
        foreach (var spec in userSpecs)
        {
            var user = existingUsers.FirstOrDefault(u => u.Id == spec.Id);
            if (user == null)
            {
                user = new User
                {
                    Id = spec.Id,
                    CreatedAt = UtcDate(2025, 1, 15, 8, 0)
                };
                context.Users.Add(user);
            }

            user.Email = spec.Email;
            user.FirstName = spec.FirstName;
            user.LastName = spec.LastName;
            user.DisplayName = spec.DisplayName;
            user.PhoneNumber = spec.Phone;
            user.Role = spec.Role;
            user.ContractKind = spec.Kind;
            user.ContractType = spec.Type;
            user.CompensationType = spec.Comp;
            user.HourlyRate = spec.Hourly;
            user.FixedMonthlyRate = spec.Fixed;
            user.WeeklyHoursBudget = spec.WeeklyBudget;
            user.IsActive = true;
            user.IsApproved = true;
            user.ApprovedAt = UtcDate(2025, 1, 15, 9, 0);
            user.ApprovedBy = janId;
            user.ManagerId = spec.ManagerId;
            user.ParentPersonId = spec.ParentPersonId;
            user.ExpectedReturnAt = null;
            user.UpdatedAt = nowUtc;
        }
        await context.SaveChangesAsync();

        // Sync user_managers table
        var oldManagers = await context.UserManagers.ToListAsync();
        context.UserManagers.RemoveRange(oldManagers);
        await context.SaveChangesAsync();

        foreach (var spec in userSpecs.Where(s => s.ManagerId.HasValue))
        {
            context.UserManagers.Add(new UserManager
            {
                Id = Guid.NewGuid(),
                UserId = spec.Id,
                ManagerId = spec.ManagerId!.Value,
                ParentPersonId = spec.ParentPersonId,
                CreatedAt = UtcDate(2025, 1, 15, 9, 0)
            });
        }
        await context.SaveChangesAsync();

        // 3. Absence Types
        var absenceTypes = await context.AbsenceTypes.ToDictionaryAsync(t => t.Code, t => t);
        var vacType = absenceTypes["vacation"];
        var docType = absenceTypes["doctor"];
        var sickType = absenceTypes["sick_day"];
        var hoType = absenceTypes["home_office"];
        var unpaidType = absenceTypes["unpaid_leave"];
        var illnessType = absenceTypes["illness"];

        // 4. User Absence Settings (2026 balances)
        var oldSettings = await context.UserAbsenceSettings.ToListAsync();
        context.UserAbsenceSettings.RemoveRange(oldSettings);
        await context.SaveChangesAsync();

        var balanceConfigs = new[]
        {
            new { UserId = janId, VacBase = 25m, VacCarry = 3m, Sick = 4m, Ho = 3m },
            new { UserId = davidId, VacBase = 25m, VacCarry = 4m, Sick = 4m, Ho = 3m },
            new { UserId = martinaId, VacBase = 20m, VacCarry = 2m, Sick = 3m, Ho = 2m },
            new { UserId = janaId, VacBase = 22m, VacCarry = 3m, Sick = 3m, Ho = 2m },
            new { UserId = tomasId, VacBase = 20m, VacCarry = 2m, Sick = 3m, Ho = 2m },
            new { UserId = martinId, VacBase = 20m, VacCarry = 1m, Sick = 3m, Ho = 1m },
            new { UserId = lukasId, VacBase = 15m, VacCarry = 0m, Sick = 2m, Ho = 3m },
            new { UserId = eliskaId, VacBase = 20m, VacCarry = 3m, Sick = 3m, Ho = 2m }
        };

        foreach (var cfg in balanceConfigs)
        {
            context.UserAbsenceSettings.AddRange(
                new UserAbsenceSetting
                {
                    Id = Guid.NewGuid(),
                    UserId = cfg.UserId,
                    AbsenceTypeId = vacType.Id,
                    Year = 2026,
                    BudgetPeriod = BudgetPeriod.yearly,
                    AllocatedCapacity = cfg.VacBase,
                    CarriedOverDays = cfg.VacCarry,
                    IsPaid = cfg.UserId != lukasId
                },
                new UserAbsenceSetting
                {
                    Id = Guid.NewGuid(),
                    UserId = cfg.UserId,
                    AbsenceTypeId = sickType.Id,
                    Year = 2026,
                    BudgetPeriod = BudgetPeriod.yearly,
                    AllocatedCapacity = cfg.Sick,
                    CarriedOverDays = 0m,
                    IsPaid = cfg.UserId != lukasId
                },
                new UserAbsenceSetting
                {
                    Id = Guid.NewGuid(),
                    UserId = cfg.UserId,
                    AbsenceTypeId = hoType.Id,
                    Year = 2026,
                    BudgetPeriod = BudgetPeriod.weekly,
                    AllocatedCapacity = cfg.Ho,
                    CarriedOverDays = 0m,
                    IsPaid = true
                }
            );
        }
        await context.SaveChangesAsync();

        // 5. Absence Requests (September 2026, October 2026, November 2026 - completed, pending, rejected)
        var oldRequests = await context.AbsenceRequests.ToListAsync();
        context.AbsenceRequests.RemoveRange(oldRequests);
        await context.SaveChangesAsync();

        var requestsToAdd = new List<AbsenceRequest>
        {
            // --- ZÁŘÍ 2026 (Předchozí měsíc) ---
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = janId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 7),
                PlannedEnd = UtcDate(2026, 9, 9),
                ApprovedBy = janId,
                ApprovedAt = UtcDate(2026, 9, 1, 10, 0),
                Note = "Prodloužený víkend v Alpách"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = janId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 17, 8, 30),
                PlannedEnd = UtcDate(2026, 9, 17, 10, 30),
                ApprovedBy = janId,
                ApprovedAt = UtcDate(2026, 9, 15, 9, 0),
                Note = "Preventivní prohlídka (Ordinace: Poliklinika Národní – MUDr. Kříž)"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = davidId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 14),
                PlannedEnd = UtcDate(2026, 9, 16),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 5, 11, 0),
                Note = "Rodinná dovolená na Šumavě"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = davidId,
                AbsenceTypeId = sickType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 25),
                PlannedEnd = UtcDate(2026, 9, 25),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 25, 7, 15),
                Note = "Nachlazení a silná migréna"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = martinaId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 3),
                PlannedEnd = UtcDate(2026, 9, 4),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 8, 28, 14, 0),
                Note = "Soukromé záležitosti a stěhování kancelářského vybavení"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = martinaId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 22, 9, 0),
                PlannedEnd = UtcDate(2026, 9, 22, 11, 30),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 18, 10, 0),
                Note = "Dentální hygiena a kontrola (Ordinace: Zubní klinika Anděl)"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = janaId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 10),
                PlannedEnd = UtcDate(2026, 9, 11),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 2, 15, 30),
                Note = "Podzimní prodloužený víkend na jižní Moravě"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = janaId,
                AbsenceTypeId = sickType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 23),
                PlannedEnd = UtcDate(2026, 9, 23),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 23, 7, 30),
                Note = "Viróza – klidový režim doma"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = janaId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 29, 13, 30),
                PlannedEnd = UtcDate(2026, 9, 29, 15, 30),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 26, 12, 0),
                Note = "Kontrola zraku (Ordinace: Oční klinika Gemini Brno)"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = tomasId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 18),
                PlannedEnd = UtcDate(2026, 9, 18),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 12, 9, 0),
                Note = "Vyřizování osobních dokladů na úřadě"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = tomasId,
                AbsenceTypeId = unpaidType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 29),
                PlannedEnd = UtcDate(2026, 9, 29),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 20, 16, 0),
                Note = "Zápis do semestru a studijní povinnosti na VŠ"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = martinId,
                AbsenceTypeId = sickType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 15),
                PlannedEnd = UtcDate(2026, 9, 15),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 15, 7, 45),
                Note = "Bolest v krku a zvýšená teplota"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = martinId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.rejected,
                PlannedStart = UtcDate(2026, 9, 24),
                PlannedEnd = UtcDate(2026, 9, 25),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 19, 11, 20),
                Note = "Výlet s přáteli do Krkonoš",
                RejectionReason = "Termín koliduje s uzávěrkou sprintu a nasazením verze 2.3."
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = lukasId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 21),
                PlannedEnd = UtcDate(2026, 9, 22),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 10, 14, 0),
                Note = "Konference WebExpo + navazující osobní volno"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = eliskaId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 1),
                PlannedEnd = UtcDate(2026, 9, 2),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 8, 20, 10, 0),
                Note = "Návrat z letní dovolené v Itálii"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = eliskaId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 9, 16, 8, 0),
                PlannedEnd = UtcDate(2026, 9, 16, 10, 30),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 14, 15, 0),
                Note = "Odběry krve a interní vyšetření (Ordinace: Poliklinika Kartouzská)"
            },

            // --- ŘÍJEN 2026 (Aktuální měsíc: dřívější dny 1.–16. 10.) ---
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = janId,
                AbsenceTypeId = sickType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 5),
                PlannedEnd = UtcDate(2026, 10, 5),
                ApprovedBy = janId,
                ApprovedAt = UtcDate(2026, 10, 5, 7, 10),
                Note = "Jednodenní zdravotní indispozice"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = janId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 12, 14, 0),
                PlannedEnd = UtcDate(2026, 10, 12, 16, 0),
                ApprovedBy = janId,
                ApprovedAt = UtcDate(2026, 10, 9, 10, 0),
                Note = "Fyzioterapie krční páteře (Ordinace: Centrum pohybové medicíny Chodov)"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = davidId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 8, 8, 0),
                PlannedEnd = UtcDate(2026, 10, 8, 10, 0),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 5, 12, 0),
                Note = "Preventivní ergonomická a kardio kontrola (Ordinace: Klinika Canadian Medical)"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = martinaId,
                AbsenceTypeId = sickType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 9),
                PlannedEnd = UtcDate(2026, 10, 9),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 9, 7, 20),
                Note = "Nachlazení a odpočinek"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = martinaId,
                AbsenceTypeId = hoType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 14),
                PlannedEnd = UtcDate(2026, 10, 14),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 12, 16, 0),
                Note = "Práce z domova – příprava měsíčních podkladů pro účetní"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = janaId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 1),
                PlannedEnd = UtcDate(2026, 10, 2),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 9, 25, 10, 0),
                Note = "Rodinná oslava v Olomouci"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = janaId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 13, 8, 30),
                PlannedEnd = UtcDate(2026, 10, 13, 11, 0),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 10, 14, 0),
                Note = "Ortopedické vyšetření kolene (Ordinace: FN u sv. Anny Brno)"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = tomasId,
                AbsenceTypeId = sickType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 6),
                PlannedEnd = UtcDate(2026, 10, 6),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 6, 7, 30),
                Note = "Silná bolest hlavy a teplota"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = martinId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 7, 9, 0),
                PlannedEnd = UtcDate(2026, 10, 7, 11, 0),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 5, 15, 0),
                Note = "Kontrola u praktického lékaře (Ordinace: EUC Klinika Praha)"
            },

            // --- DNEŠNÍ AKTIVNÍ ABSENCE (17. 10. 2026) PRO ŽIVÝ RADAR "KDO JE KDE" ---
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = tomasId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 17, 9, 0),
                PlannedEnd = UtcDate(2026, 10, 17, 11, 30),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 15, 11, 0),
                Note = "Kontrolní vyšetření alergologie (Ordinace: Poliklinika Budějovická – MUDr. Veselý)"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = martinId,
                AbsenceTypeId = sickType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 17),
                PlannedEnd = UtcDate(2026, 10, 17),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 17, 7, 15),
                Note = "Silné nachlazení, potřebuji den klidu na vyležení"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = lukasId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 16),
                PlannedEnd = UtcDate(2026, 10, 19),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 10, 13, 0),
                Note = "Podzimní přechod Krkonoš – čerpání volna"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = eliskaId,
                AbsenceTypeId = illnessType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 14),
                PlannedEnd = UtcDate(2026, 10, 20),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 14, 9, 30),
                Note = "Pracovní neschopnost – chřipka (eNeschopenka č. 849201)"
            },

            // --- NADCHÁZEJÍCÍ SCHVÁLENÉ V ŘÍJNU 2026 ---
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = janaId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 26),
                PlannedEnd = UtcDate(2026, 10, 27),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 12, 10, 0),
                Note = "Podzimní prázdniny s dětmi před státním svátkem 28. října"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = martinaId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.completed,
                PlannedStart = UtcDate(2026, 10, 29),
                PlannedEnd = UtcDate(2026, 10, 30),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 14, 15, 0),
                Note = "Dovolená po státním svátku – spojení s víkendem"
            },

            // --- ČEKAJÍCÍ NA SCHVÁLENÍ (PENDING) ---
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = tomasId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.pending,
                PlannedStart = UtcDate(2026, 10, 26),
                PlannedEnd = UtcDate(2026, 10, 27),
                Note = "Prodloužené volno před státním svátkem 28. října"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = tomasId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.pending,
                PlannedStart = UtcDate(2026, 10, 22, 8, 30),
                PlannedEnd = UtcDate(2026, 10, 22, 11, 0),
                Note = "Kontrolní odběry na alergologii (Ordinace: Poliklinika Budějovická – MUDr. Veselý)"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = martinId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.pending,
                PlannedStart = UtcDate(2026, 10, 29),
                PlannedEnd = UtcDate(2026, 10, 30),
                Note = "Studijní soustředění mimo Prahu"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = martinId,
                AbsenceTypeId = unpaidType.Id,
                Status = AbsenceStatus.pending,
                PlannedStart = UtcDate(2026, 11, 5),
                PlannedEnd = UtcDate(2026, 11, 6),
                Note = "Příprava na státní závěrečné zkoušky"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = lukasId,
                AbsenceTypeId = hoType.Id,
                Status = AbsenceStatus.pending,
                PlannedStart = UtcDate(2026, 10, 21),
                PlannedEnd = UtcDate(2026, 10, 23),
                Note = "Práce ze vzdálené kanceláře v Ostravě"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = lukasId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.pending,
                PlannedStart = UtcDate(2026, 10, 27, 13, 0),
                PlannedEnd = UtcDate(2026, 10, 27, 15, 30),
                Note = "Stomatologický zákrok (Ordinace: Klinika Schill Dental)"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = eliskaId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.pending,
                PlannedStart = UtcDate(2026, 10, 29),
                PlannedEnd = UtcDate(2026, 10, 30),
                Note = "Podzimní odpočinek po rekonvalescenci"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = eliskaId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.pending,
                PlannedStart = UtcDate(2026, 10, 21, 8, 30),
                PlannedEnd = UtcDate(2026, 10, 21, 10, 30),
                Note = "Výstupní kontrola u praktického lékaře po nemoci (Ordinace: Poliklinika Kartouzská)"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = janaId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.pending,
                PlannedStart = UtcDate(2026, 11, 16),
                PlannedEnd = UtcDate(2026, 11, 16),
                Note = "Volné pondělí před státním svátkem 17. listopadu"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = janaId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.pending,
                PlannedStart = UtcDate(2026, 10, 23, 8, 0),
                PlannedEnd = UtcDate(2026, 10, 23, 10, 0),
                Note = "Kontrola na rehabilitaci (Ordinace: Poliklinika Zahradníkova Brno)"
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = martinaId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.pending,
                PlannedStart = UtcDate(2026, 10, 22, 14, 0),
                PlannedEnd = UtcDate(2026, 10, 22, 16, 0),
                Note = "Preventivní vyšetření dermatologie (Ordinace: Dermaklinika Praha)"
            },

            // --- ZAMÍTNUTÉ ŽÁDOSTI (REJECTED) V ŘÍJNU 2026 ---
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = tomasId,
                AbsenceTypeId = hoType.Id,
                Status = AbsenceStatus.rejected,
                PlannedStart = UtcDate(2026, 10, 19),
                PlannedEnd = UtcDate(2026, 10, 21),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 15, 16, 20),
                Note = "Práce z domova na příští týden",
                RejectionReason = "V pondělí a úterý probíhá osobní workshop týmu v pražské kanceláři, prosím o účast na místě."
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = eliskaId,
                AbsenceTypeId = vacType.Id,
                Status = AbsenceStatus.rejected,
                PlannedStart = UtcDate(2026, 10, 26),
                PlannedEnd = UtcDate(2026, 10, 27),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 13, 11, 45),
                Note = "Dovolená před státním svátkem",
                RejectionReason = "V tomto termínu již čerpá schválenou dovolenou vedoucí týmu Jana Nováková, prosím o přesun na 29.–30. 10."
            },
            new AbsenceRequest
            {
                Id = Guid.NewGuid(),
                UserId = lukasId,
                AbsenceTypeId = docType.Id,
                Status = AbsenceStatus.rejected,
                PlannedStart = UtcDate(2026, 10, 9, 10, 0),
                PlannedEnd = UtcDate(2026, 10, 9, 14, 0),
                ApprovedBy = davidId,
                ApprovedAt = UtcDate(2026, 10, 8, 17, 0),
                Note = "Fyzioterapie a sportovní regenerace (Ordinace: Rehab Clinic)",
                RejectionReason = "U spolupráce na IČO (OSVČ) není komerční regenerace hrazenou překážkou v práci."
            }
        };

        context.AbsenceRequests.AddRange(requestsToAdd);
        await context.SaveChangesAsync();

        // 6. Worklogs (TimeEntries) for September 2026 & October 2026 (up to Oct 17, 2026)
        var oldEntries = await context.TimeEntries.ToListAsync();
        context.TimeEntries.RemoveRange(oldEntries);
        await context.SaveChangesAsync();

        var fullDayAbsenceTypeIds = new HashSet<Guid>
        {
            vacType.Id,
            sickType.Id,
            illnessType.Id,
            unpaidType.Id
        };

        bool HasApprovedFullDayAbsence(Guid userId, int year, int month, int day)
        {
            var dt = new DateTime(year, month, day);
            return requestsToAdd.Any(r =>
                r.UserId == userId &&
                r.Status == AbsenceStatus.completed &&
                fullDayAbsenceTypeIds.Contains(r.AbsenceTypeId) &&
                r.PlannedStart.Date <= dt &&
                r.PlannedEnd.Date >= dt);
        }

        AbsenceRequest? GetApprovedDoctorVisit(Guid userId, int year, int month, int day)
        {
            var dt = new DateTime(year, month, day);
            return requestsToAdd.FirstOrDefault(r =>
                r.UserId == userId &&
                r.Status == AbsenceStatus.completed &&
                r.AbsenceTypeId == docType.Id &&
                r.PlannedStart.Date == dt);
        }

        bool HasApprovedHomeOfficeRequest(Guid userId, int year, int month, int day)
        {
            var dt = new DateTime(year, month, day);
            return requestsToAdd.Any(r =>
                r.UserId == userId &&
                r.Status == AbsenceStatus.completed &&
                r.AbsenceTypeId == hoType.Id &&
                r.PlannedStart.Date <= dt &&
                r.PlannedEnd.Date >= dt);
        }

        var entriesToAdd = new List<TimeEntry>();

        void GenerateHistoricalDayEntries(int year, int month, int day)
        {
            var dt = new DateTime(year, month, day);
            if (dt.DayOfWeek == DayOfWeek.Saturday || dt.DayOfWeek == DayOfWeek.Sunday)
                return;

            // Czech holidays in Sep/Oct: Sep 28, Oct 28
            if ((month == 9 && day == 28) || (month == 10 && day == 28))
                return;

            for (int uIdx = 0; uIdx < userSpecs.Length; uIdx++)
            {
                var spec = userSpecs[uIdx];
                if (HasApprovedFullDayAbsence(spec.Id, year, month, day))
                    continue;

                var docVisit = GetApprovedDoctorVisit(spec.Id, year, month, day);
                var forcedHo = HasApprovedHomeOfficeRequest(spec.Id, year, month, day);

                // Deterministic pseudo-random variation per user & day
                int seed = (year * 372 + month * 31 + day) * 17 + uIdx * 13;
                int minOffsetIn = (seed % 5) * 5 - 10;   // -10, -5, 0, +5, +10 min
                int minOffsetOut = ((seed / 3) % 6) * 5; // 0 .. +25 min

                // Location type selection:
                // - forcedHo or ~28% of days (e.g. Wed/Fri depending on persona) -> Home Office
                // - ~12% of days -> Office without NFC verification (WorkplaceId = null, zapomenutá karta)
                // - otherwise -> Office verified by NFC card (Brno for Jana, Praha for others; occasionally Jana visits Praha)
                LocationType locType;
                Guid? workplaceId;
                bool isManual = false;
                string? editReason = null;

                if (forcedHo || ((day + uIdx) % 4 == 0 && docVisit == null))
                {
                    locType = LocationType.home_office;
                    workplaceId = null;
                }
                else if ((day * 3 + uIdx) % 9 == 0)
                {
                    // Kancelář (bez ověření) - příchod bez NFC čipu
                    locType = LocationType.office;
                    workplaceId = null;
                    isManual = true;
                    editReason = "Příchod bez NFC čipu (zapomenutá karta)";
                }
                else
                {
                    locType = LocationType.office;
                    if (spec.Id == janaId)
                    {
                        workplaceId = (day % 7 == 0) ? prahaId : brnoId;
                    }
                    else
                    {
                        workplaceId = prahaId;
                    }
                }

                if (docVisit != null)
                {
                    // Partial day work shift alongside doctor visit
                    if (docVisit.PlannedStart.Hour < 12)
                    {
                        // Doctor in the morning (e.g., 08:30-11:00) -> work shift after doctor
                        int startH = docVisit.PlannedEnd.Hour;
                        int startM = docVisit.PlannedEnd.Minute + 30;
                        if (startM >= 60) { startH++; startM -= 60; }

                        int targetWorkHours = spec.Type == ContractType.half_time ? 2 : spec.Type == ContractType.part_time ? 1 : 6;
                        int endH = Math.Min(19, startH + targetWorkHours);

                        entriesToAdd.Add(new TimeEntry
                        {
                            Id = Guid.NewGuid(),
                            UserId = spec.Id,
                            WorkplaceId = workplaceId,
                            LocationType = locType,
                            StartTime = LocalToUtc(year, month, day, startH, startM),
                            EndTime = LocalToUtc(year, month, day, endH, startM),
                            IsManual = isManual,
                            EditReason = editReason
                        });
                    }
                    else
                    {
                        // Doctor in the afternoon (e.g., 13:30-15:30) -> work shift in the morning
                        entriesToAdd.Add(new TimeEntry
                        {
                            Id = Guid.NewGuid(),
                            UserId = spec.Id,
                            WorkplaceId = workplaceId,
                            LocationType = locType,
                            StartTime = LocalToUtc(year, month, day, 7, 45),
                            EndTime = LocalToUtc(year, month, day, docVisit.PlannedStart.Hour, Math.Max(0, docVisit.PlannedStart.Minute - 15)),
                            IsManual = isManual,
                            EditReason = editReason
                        });
                    }
                    continue;
                }

                if (spec.Type == ContractType.half_time)
                {
                    // Tomáš Dvořák (4h/den)
                    int inMin = 30 + minOffsetIn;
                    int outMin = 30 + minOffsetOut;
                    entriesToAdd.Add(new TimeEntry
                    {
                        Id = Guid.NewGuid(),
                        UserId = spec.Id,
                        WorkplaceId = workplaceId,
                        LocationType = locType,
                        StartTime = LocalToUtc(year, month, day, 8, Math.Clamp(inMin, 5, 50)),
                        EndTime = LocalToUtc(year, month, day, 12, Math.Clamp(outMin, 25, 55)),
                        IsManual = isManual,
                        EditReason = editReason
                    });
                }
                else if (spec.Type == ContractType.part_time)
                {
                    // Martin Kovář (2h/den)
                    int inMin = 15 + minOffsetIn;
                    int outMin = 15 + minOffsetOut;
                    entriesToAdd.Add(new TimeEntry
                    {
                        Id = Guid.NewGuid(),
                        UserId = spec.Id,
                        WorkplaceId = workplaceId,
                        LocationType = locType,
                        StartTime = LocalToUtc(year, month, day, 9, Math.Clamp(inMin, 0, 40)),
                        EndTime = LocalToUtc(year, month, day, 11, Math.Clamp(outMin, 10, 50)),
                        IsManual = isManual,
                        EditReason = editReason
                    });
                }
                else
                {
                    // Plný úvazek (8h/den): někdy 2 bloky s obědovou pauzou, jindy 1 souvislý blok
                    bool splitForLunch = (day + uIdx) % 2 == 0;
                    int startMinute = Math.Clamp(15 + minOffsetIn, 0, 45);
                    int endMinute = Math.Clamp(15 + minOffsetOut, 5, 55);

                    if (splitForLunch)
                    {
                        entriesToAdd.Add(new TimeEntry
                        {
                            Id = Guid.NewGuid(),
                            UserId = spec.Id,
                            WorkplaceId = workplaceId,
                            LocationType = locType,
                            StartTime = LocalToUtc(year, month, day, 8, startMinute),
                            EndTime = LocalToUtc(year, month, day, 11, 45),
                            IsManual = isManual,
                            EditReason = editReason
                        });
                        entriesToAdd.Add(new TimeEntry
                        {
                            Id = Guid.NewGuid(),
                            UserId = spec.Id,
                            WorkplaceId = workplaceId,
                            LocationType = locType,
                            StartTime = LocalToUtc(year, month, day, 12, 25),
                            EndTime = LocalToUtc(year, month, day, 16, Math.Max(40, endMinute)),
                            IsManual = isManual,
                            EditReason = editReason
                        });
                    }
                    else
                    {
                        entriesToAdd.Add(new TimeEntry
                        {
                            Id = Guid.NewGuid(),
                            UserId = spec.Id,
                            WorkplaceId = workplaceId,
                            LocationType = locType,
                            StartTime = LocalToUtc(year, month, day, 8, startMinute),
                            EndTime = LocalToUtc(year, month, day, 16, endMinute),
                            IsManual = isManual,
                            EditReason = editReason
                        });
                    }
                }
            }
        }

        // Generate all workdays for September 2026 (1..30)
        for (int d = 1; d <= 30; d++)
        {
            GenerateHistoricalDayEntries(2026, 9, d);
        }

        // Generate workdays for October 2026 up to yesterday (1..16)
        for (int d = 1; d <= 16; d++)
        {
            GenerateHistoricalDayEntries(2026, 10, d);
        }

        // 7. TODAY'S LIVE SHIFTS (2026-10-17) for rich live statuses & DayTimeline
        // Jan Novotný (admin): V kanceláři ověřeno kartou (Pobočka Praha 1 - Palmovka) - dopolední blok + aktivní odpolední blok
        entriesToAdd.Add(new TimeEntry
        {
            Id = Guid.NewGuid(),
            UserId = janId,
            WorkplaceId = prahaId,
            LocationType = LocationType.office,
            StartTime = LocalToUtc(2026, 10, 17, 7, 55),
            EndTime = LocalToUtc(2026, 10, 17, 11, 30),
            IsManual = false
        });
        entriesToAdd.Add(new TimeEntry
        {
            Id = Guid.NewGuid(),
            UserId = janId,
            WorkplaceId = prahaId,
            LocationType = LocationType.office,
            StartTime = LocalToUtc(2026, 10, 17, 12, 5),
            EndTime = null, // Právě v kanceláři (ověřeno NFC Praha 1)
            IsManual = false
        });

        // David Sýkora (manager): Home Office - dopolední blok + aktivní odpolední blok
        entriesToAdd.Add(new TimeEntry
        {
            Id = Guid.NewGuid(),
            UserId = davidId,
            WorkplaceId = null,
            LocationType = LocationType.home_office,
            StartTime = LocalToUtc(2026, 10, 17, 8, 10),
            EndTime = LocalToUtc(2026, 10, 17, 11, 40),
            IsManual = false
        });
        entriesToAdd.Add(new TimeEntry
        {
            Id = Guid.NewGuid(),
            UserId = davidId,
            WorkplaceId = null,
            LocationType = LocationType.home_office,
            StartTime = LocalToUtc(2026, 10, 17, 12, 15),
            EndTime = null, // Právě na Home Office
            IsManual = false
        });

        // Martina Svobodová (office_manager): V kanceláři (bez ověření) - aktivní směna bez WorkplaceId
        entriesToAdd.Add(new TimeEntry
        {
            Id = Guid.NewGuid(),
            UserId = martinaId,
            WorkplaceId = null,
            LocationType = LocationType.office,
            StartTime = LocalToUtc(2026, 10, 17, 8, 25),
            EndTime = null, // Právě v kanceláři (bez ověření)
            IsManual = true,
            EditReason = "Příchod bez NFC čipu (zapomenutá karta)"
        });

        // Jana Nováková (team_lead): V kanceláři ověřeno kartou (Pobočka Brno - Spielberk) - dopolední blok + aktivní odpolední blok
        entriesToAdd.Add(new TimeEntry
        {
            Id = Guid.NewGuid(),
            UserId = janaId,
            WorkplaceId = brnoId,
            LocationType = LocationType.office,
            StartTime = LocalToUtc(2026, 10, 17, 7, 45),
            EndTime = LocalToUtc(2026, 10, 17, 11, 30),
            IsManual = false
        });
        entriesToAdd.Add(new TimeEntry
        {
            Id = Guid.NewGuid(),
            UserId = janaId,
            WorkplaceId = brnoId,
            LocationType = LocationType.office,
            StartTime = LocalToUtc(2026, 10, 17, 12, 0),
            EndTime = null, // Právě v kanceláři (ověřeno NFC Brno)
            IsManual = false
        });

        // Tomáš Dvořák (colleague): Ranní odpracovaný blok 07:30–08:45 v kanceláři Praha před odchodem k lékaři (09:00–11:30)
        entriesToAdd.Add(new TimeEntry
        {
            Id = Guid.NewGuid(),
            UserId = tomasId,
            WorkplaceId = prahaId,
            LocationType = LocationType.office,
            StartTime = LocalToUtc(2026, 10, 17, 7, 30),
            EndTime = LocalToUtc(2026, 10, 17, 8, 45),
            IsManual = false
        });

        context.TimeEntries.AddRange(entriesToAdd);
        await context.SaveChangesAsync();

        return new
        {
            usersUpdated = userSpecs.Length,
            absenceSettingsCreated = balanceConfigs.Length * 3,
            absenceRequestsCreated = requestsToAdd.Count,
            timeEntriesCreated = entriesToAdd.Count
        };
    }
}
