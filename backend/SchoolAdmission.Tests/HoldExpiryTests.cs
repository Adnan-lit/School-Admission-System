using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Options;

namespace SchoolAdmission.Tests;

/// <summary>
/// Holds last about two seconds, and the cleanup job effectively never runs,
/// so these tests prove that seats come back because of the clock and not because of the job.
/// </summary>
public sealed class ShortHoldFixture : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.ConfigureServices(services => services.PostConfigure<HoldOptions>(options =>
        {
            options.DurationSeconds = 2;
            options.CleanupInterval = TimeSpan.FromHours(1);
        }));
}

[CollectionDefinition(nameof(ShortHoldCollection))]
public sealed class ShortHoldCollection : ICollectionFixture<ShortHoldFixture>;

[Collection(nameof(ShortHoldCollection))]
public class HoldExpiryTests(ShortHoldFixture fixture)
{
    private static readonly string Owner = AdmissionClient.StudentId(1);
    private static readonly string OtherStudent = AdmissionClient.StudentId(2);

    private readonly AdmissionClient api = new(fixture.CreateClient());

    [Fact]
    public async Task An_expired_hold_releases_its_seat_with_no_api_call_and_no_cleanup_job()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var hold = await api.ApplyForHoldAsync(classId, Owner);
        Assert.Equal(1, (await api.GetSeatsAsync(classId)).HeldSeats);

        await WaitUntilPastAsync(hold.ExpiresAt);

        var seats = await api.GetSeatsAsync(classId);
        Assert.Equal(0, seats.HeldSeats);
        Assert.Equal(1, seats.AvailableSeats);
    }

    [Fact]
    public async Task An_expired_hold_reports_EXPIRED_even_before_the_cleanup_job_has_run()
    {
        var student = AdmissionClient.NewStudentId();
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var hold = await api.ApplyForHoldAsync(classId, student);

        await WaitUntilPastAsync(hold.ExpiresAt);

        using var body = JsonDocument.Parse(await (await api.GetHoldAsync(hold.HoldId)).Content.ReadAsStringAsync());
        Assert.Equal("EXPIRED", body.RootElement.GetProperty("status").GetString());

        var myHolds = await (await api.GetMyHoldsAsync(student)).Content.ReadFromJsonAsync<MyHold[]>();
        Assert.Equal("EXPIRED", Assert.Single(myHolds!).Status);

        // The table itself still says HELD, which proves the answer above came from the clock.
        Assert.Equal("HELD", await ReadStoredStatusAsync(fixture, hold.HoldId));
    }

    [Fact]
    public async Task Confirming_an_expired_hold_returns_409_and_takes_no_seat()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var hold = await api.ApplyForHoldAsync(classId, Owner);

        await WaitUntilPastAsync(hold.ExpiresAt);
        var response = await api.ConfirmAsync(hold.HoldId, Owner);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("HOLD_EXPIRED", await response.Content.ReadAsStringAsync());

        var seats = await api.GetSeatsAsync(classId);
        Assert.Equal(0, seats.ConfirmedSeats);
        Assert.Equal(1, seats.AvailableSeats);
    }

    [Fact]
    public async Task Cancelling_an_expired_hold_returns_409()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var hold = await api.ApplyForHoldAsync(classId, Owner);

        await WaitUntilPastAsync(hold.ExpiresAt);
        var response = await api.CancelAsync(hold.HoldId, Owner);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("HOLD_EXPIRED", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Another_student_can_take_a_seat_once_its_hold_expires()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var hold = await api.ApplyForHoldAsync(classId, Owner);
        Assert.Equal(HttpStatusCode.Conflict, (await api.ApplyAsync(classId, OtherStudent)).StatusCode);

        await WaitUntilPastAsync(hold.ExpiresAt);

        Assert.Equal(HttpStatusCode.Created, (await api.ApplyAsync(classId, OtherStudent)).StatusCode);
    }

    [Fact]
    public async Task The_same_student_can_apply_again_after_expiry_even_before_cleanup()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var hold = await api.ApplyForHoldAsync(classId, Owner);

        await WaitUntilPastAsync(hold.ExpiresAt);

        Assert.Equal(HttpStatusCode.Created, (await api.ApplyAsync(classId, Owner)).StatusCode);
    }

    [Fact]
    public async Task A_confirmed_admission_does_not_expire()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        var hold = await api.ApplyForHoldAsync(classId, Owner);
        Assert.Equal(HttpStatusCode.OK, (await api.ConfirmAsync(hold.HoldId, Owner)).StatusCode);

        await WaitUntilPastAsync(hold.ExpiresAt);

        var seats = await api.GetSeatsAsync(classId);
        Assert.Equal(1, seats.ConfirmedSeats);
        Assert.Equal(0, seats.AvailableSeats);

        using var body = JsonDocument.Parse(await (await api.GetHoldAsync(hold.HoldId)).Content.ReadAsStringAsync());
        Assert.Equal("CONFIRMED", body.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Seats_freed_by_expiry_are_not_oversold_in_a_burst()
    {
        const int seats = 5;
        const int applicants = 100;
        var classId = await api.CreateClassAsync(seats);

        CreatedHold? lastHold = null;
        for (var number = 0; number < seats; number++)
        {
            lastHold = await api.ApplyForHoldAsync(classId, AdmissionClient.StudentId(number));
        }

        await WaitUntilPastAsync(lastHold!.ExpiresAt);

        var responses = await AdmissionClient.SendAllAtOnceAsync(
            applicants,
            number => api.ApplyAsync(classId, AdmissionClient.StudentId(1000 + number)));

        Assert.Equal(seats, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(applicants - seats, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task The_cleanup_job_records_EXPIRED_in_the_table()
    {
        await using var withCleanup = fixture.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services => services.PostConfigure<HoldOptions>(options =>
                options.CleanupInterval = TimeSpan.FromMilliseconds(200))));

        var client = new AdmissionClient(withCleanup.CreateClient());
        var classId = await client.CreateClassAsync(totalSeats: 1);
        var hold = await client.ApplyForHoldAsync(classId, Owner);

        await WaitUntilPastAsync(hold.ExpiresAt);

        var deadline = DateTime.UtcNow.AddSeconds(5);
        var stored = await ReadStoredStatusAsync(withCleanup, hold.HoldId);
        while (stored != "EXPIRED" && DateTime.UtcNow < deadline)
        {
            await Task.Delay(100);
            stored = await ReadStoredStatusAsync(withCleanup, hold.HoldId);
        }

        Assert.Equal("EXPIRED", stored);
    }

    private static async Task WaitUntilPastAsync(DateTime expiresAt)
    {
        var wait = expiresAt.ToUniversalTime() - DateTime.UtcNow + TimeSpan.FromMilliseconds(200);
        if (wait > TimeSpan.Zero)
        {
            await Task.Delay(wait);
        }
    }

    private static async Task<string> ReadStoredStatusAsync(WebApplicationFactory<Program> factory, string holdId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var id = Guid.Parse(holdId);
        return await db.Holds.AsNoTracking().Where(hold => hold.Id == id).Select(hold => hold.Status).SingleAsync();
    }
}
