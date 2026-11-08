using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace SchoolAdmission.Tests;

/// <summary>Runs the real API in memory against a real PostgreSQL database.</summary>
public sealed class ApiFixture : WebApplicationFactory<Program>;

// One shared collection, so timing-sensitive tests don't compete with each other for connections.
[CollectionDefinition(nameof(ApiCollection))]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>;

public sealed record CreatedClass(string Id, string Name, int TotalSeats);

public sealed record ClassSeats(int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats);

/// <summary>Small wrapper so tests read as what a client does.</summary>
public sealed class AdmissionClient(HttpClient http)
{
    public const string StudentIdHeader = "X-Student-Id";

    public static string StudentId(int number) => number.ToString("D17");

    public async Task<string> CreateClassAsync(int totalSeats)
    {
        var response = await http.PostAsJsonAsync("/classes", new { name = "Test class", totalSeats });
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<CreatedClass>();
        return created!.Id;
    }

    public Task<HttpResponseMessage> ApplyAsync(string classId, string? studentId)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        if (studentId is not null)
        {
            request.Headers.TryAddWithoutValidation(StudentIdHeader, studentId);
        }

        return http.SendAsync(request);
    }

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
}
