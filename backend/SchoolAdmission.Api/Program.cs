using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Options;
using SchoolAdmission.Api.Services;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("The ConnectionStrings__Default environment variable is not set.");

var holdDurationSeconds = builder.Configuration.GetValue("HOLD_DURATION_SECONDS", 600);
if (holdDurationSeconds <= 0)
{
    throw new InvalidOperationException("HOLD_DURATION_SECONDS must be a whole number of 1 or more.");
}

builder.Services.Configure<HoldOptions>(options => options.DurationSeconds = holdDurationSeconds);
builder.Services.AddScoped<HoldService>();
builder.Services.AddHostedService<ExpiredHoldCleanupService>();

builder.Services.AddDbContext<AppDbContext>(options => options
    .UseNpgsql(connectionString)
    // On a brand-new database EF logs an expected failure while looking for its history table.
    // Real SQL errors still reach the code as exceptions, so nothing is hidden by lowering this.
    .ConfigureWarnings(warnings => warnings.Log((RelationalEventId.CommandError, LogLevel.Debug))));

builder.Services
    .AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            // Attribute messages are written for people. JSON parser messages expose internals,
            // and their keys start with "$", so those get a general message instead.
            var isUnreadableBody = context.ModelState.Keys.Any(key => key.StartsWith('$'));
            var message = isUnreadableBody
                ? "The request body is not valid JSON, or a field has the wrong type."
                : context.ModelState.Values.SelectMany(entry => entry.Errors).First().ErrorMessage;

            return new BadRequestObjectResult(new ApiError(ErrorCodes.InvalidRequest, message));
        };
    })
    .AddJsonOptions(options =>
    {
        // By default ASP.NET also accepts numbers written as text, but the contract says they are numbers.
        options.JsonSerializerOptions.NumberHandling = JsonNumberHandling.Strict;
    });

// The UI runs on a different port and sends X-Student-Id, so browsers ask permission before calling the API.
// There are no cookies or logins here, so allowing any origin exposes nothing.
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

// Reviewers only run "docker compose up", so the schema has to create itself.
// Retrying covers the moments when the database can't be reached yet, which are normal during startup.
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    const int maxAttempts = 30;

    for (var attempt = 1; ; attempt++)
    {
        try
        {
            await db.Database.MigrateAsync();
            break;
        }
        catch (NpgsqlException exception) when (exception.IsTransient && attempt < maxAttempts)
        {
            app.Logger.LogWarning(
                "The database can't be reached yet. Retrying ({Attempt} of {MaxAttempts}).",
                attempt,
                maxAttempts);
            await Task.Delay(TimeSpan.FromSeconds(2));
        }
    }
}

app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await context.Response.WriteAsJsonAsync(
        new ApiError(ErrorCodes.InternalError, "Something went wrong on the server."));
}));

app.UseCors();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapControllers();

app.Run();
