using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SchoolAdmission.Api.Data;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("The ConnectionStrings__Default environment variable is not set.");

builder.Services.AddDbContext<AppDbContext>(options => options
    .UseNpgsql(connectionString)
    // On a brand-new database EF logs an expected failure while looking for its history table.
    // Real SQL errors still reach the code as exceptions, so nothing is hidden by lowering this.
    .ConfigureWarnings(warnings => warnings.Log((RelationalEventId.CommandError, LogLevel.Debug))));

var app = builder.Build();

// Reviewers only run "docker compose up", so the schema has to create itself.
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
