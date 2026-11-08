using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace SchoolAdmission.Tests;

/// <summary>Runs the real API in memory against a real PostgreSQL database.</summary>
public sealed class ApiFixture : WebApplicationFactory<Program>;

// One shared collection, so timing-sensitive tests don't compete with each other for connections.
[CollectionDefinition(nameof(ApiCollection))]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>;

public sealed record CreatedClass(string Id, string Name, int TotalSeats);

public sealed record CreatedHold(string HoldId);

public sealed record ClassSeats(int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats);

public sealed record MyHold(string HoldId, string ClassId, string ClassName, string Status, string ExpiresAt);

/// <summary>Small wrapper so tests read as what a client does.</summary>
public sealed class AdmissionClient(HttpClient http)
{
    public const string StudentIdHeader = "X-Student-Id";

    public static string StudentId(int number) => number.ToString("D17");

    /// <summary>For tests that list a student's holds, where IDs must not repeat between test runs.</summary>
    public static string NewStudentId() => Random.Shared.NextInt64(10_000_000_000_000_000, 99_999_999_999_999_999).ToString();

    public async Task<string> CreateClassAsync(int totalSeats)
    {
        var response = await http.PostAsJsonAsync("/classes", new { name = "Test class", totalSeats });
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<CreatedClass>();
        return created!.Id;
    }

    public Task<HttpResponseMessage> ApplyAsync(string classId, string? studentId) =>
        SendAsStudentAsync(HttpMethod.Post, $"/classes/{classId}/holds", studentId);

    public async Task<string> ApplyForHoldIdAsync(string classId, string studentId)
    {
        var response = await ApplyAsync(classId, studentId);
        response.EnsureSuccessStatusCode();
        var hold = await response.Content.ReadFromJsonAsync<CreatedHold>();
        return hold!.HoldId;
    }

    public Task<HttpResponseMessage> GetHoldAsync(string holdId) => http.GetAsync($"/holds/{holdId}");

    public Task<HttpResponseMessage> ConfirmAsync(string holdId, string? studentId) =>
        SendAsStudentAsync(HttpMethod.Post, $"/holds/{holdId}/confirm", studentId);

    public Task<HttpResponseMessage> CancelAsync(string holdId, string? studentId) =>
        SendAsStudentAsync(HttpMethod.Delete, $"/holds/{holdId}", studentId);

    public Task<HttpResponseMessage> GetMyHoldsAsync(string? studentId) =>
        SendAsStudentAsync(HttpMethod.Get, "/me/holds", studentId);

    public async Task<ClassSeats> GetSeatsAsync(string classId) =>
        (await http.GetFromJsonAsync<ClassSeats>($"/classes/{classId}"))!;

    /// <summary>Holds every request back until all are ready, so they really do start together.</summary>
    public static async Task<HttpResponseMessage[]> SendAllAtOnceAsync(
        int count,
        Func<int, Task<HttpResponseMessage>> send)
    {
        var startSignal = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        var requests = Enumerable.Range(0, count)
            .Select(async number =>
            {
                await startSignal.Task;
                return await send(number);
            })
            .ToArray();

        startSignal.SetResult();
        return await Task.WhenAll(requests);
    }

    private Task<HttpResponseMessage> SendAsStudentAsync(HttpMethod method, string path, string? studentId)
    {
        var request = new HttpRequestMessage(method, path);
        if (studentId is not null)
        {
            request.Headers.TryAddWithoutValidation(StudentIdHeader, studentId);
        }

        return http.SendAsync(request);
    }
}
