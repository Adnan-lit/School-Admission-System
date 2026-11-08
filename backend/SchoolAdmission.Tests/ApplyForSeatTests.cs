using System.Net;
using System.Text.Json;

namespace SchoolAdmission.Tests;

[Collection(nameof(ApiCollection))]
public class ApplyForSeatTests(ApiFixture fixture)
{
    private readonly AdmissionClient api = new(fixture.CreateClient());

    [Fact]
    public async Task Applying_returns_201_with_every_field_in_the_contract()
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);
        var studentId = AdmissionClient.StudentId(1);

        var response = await api.ApplyAsync(classId, studentId);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var hold = body.RootElement;
        Assert.False(string.IsNullOrEmpty(hold.GetProperty("holdId").GetString()));
        Assert.Equal(classId, hold.GetProperty("classId").GetString());
        Assert.Equal(studentId, hold.GetProperty("studentId").GetString());
        Assert.Equal("HELD", hold.GetProperty("status").GetString());

        var expiresAt = hold.GetProperty("expiresAt").GetString()!;
        Assert.Matches(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$", expiresAt);

        var secondsLeft = (DateTime.Parse(expiresAt).ToUniversalTime() - DateTime.UtcNow).TotalSeconds;
        Assert.InRange(secondsLeft, 598, 602);
    }

    [Fact]
    public async Task Two_hundred_students_applying_at_once_for_ten_seats_fill_exactly_ten_seats()
    {
        const int seats = 10;
        const int applicants = 200;
        var classId = await api.CreateClassAsync(seats);

        var responses = await AdmissionClient.SendAllAtOnceAsync(
            applicants,
            number => api.ApplyAsync(classId, AdmissionClient.StudentId(number)));

        Assert.Equal(seats, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(applicants - seats, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));

        var classSeats = await api.GetSeatsAsync(classId);
        Assert.Equal(seats, classSeats.HeldSeats);
        Assert.Equal(0, classSeats.AvailableSeats);
    }

    [Fact]
    public async Task One_student_applying_twenty_times_at_once_gets_exactly_one_hold()
    {
        var classId = await api.CreateClassAsync(totalSeats: 50);
        var studentId = AdmissionClient.StudentId(1);

        var responses = await AdmissionClient.SendAllAtOnceAsync(
            20,
            _ => api.ApplyAsync(classId, studentId));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(19, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(1, (await api.GetSeatsAsync(classId)).HeldSeats);
    }

    [Fact]
    public async Task Applying_to_a_full_class_returns_409()
    {
        var classId = await api.CreateClassAsync(totalSeats: 1);
        await api.ApplyAsync(classId, AdmissionClient.StudentId(1));

        var response = await api.ApplyAsync(classId, AdmissionClient.StudentId(2));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("NO_SEATS_AVAILABLE", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Applying_twice_to_the_same_class_returns_409_and_takes_one_seat()
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);
        var studentId = AdmissionClient.StudentId(1);
        await api.ApplyAsync(classId, studentId);

        var response = await api.ApplyAsync(classId, studentId);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("ALREADY_APPLIED", await response.Content.ReadAsStringAsync());
        Assert.Equal(1, (await api.GetSeatsAsync(classId)).HeldSeats);
    }

    [Fact]
    public async Task A_student_can_apply_to_different_classes_at_the_same_time()
    {
        var morningShift = await api.CreateClassAsync(totalSeats: 5);
        var dayShift = await api.CreateClassAsync(totalSeats: 5);
        var studentId = AdmissionClient.StudentId(1);

        var first = await api.ApplyAsync(morningShift, studentId);
        var second = await api.ApplyAsync(dayShift, studentId);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("2015269123456789")] // 16 digits
    [InlineData("201526912345678901")] // 18 digits
    [InlineData("2015269123456789a")] // contains a letter
    [InlineData("২০১৫২৬৯১২৩৪৫৬৭৮৯০")] // Bangla digits
    public async Task A_missing_or_invalid_student_id_returns_400_and_takes_no_seat(string? studentId)
    {
        var classId = await api.CreateClassAsync(totalSeats: 5);

        var response = await api.ApplyAsync(classId, studentId);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, (await api.GetSeatsAsync(classId)).HeldSeats);
    }

    [Theory]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    [InlineData("not-a-real-id")]
    public async Task Applying_to_an_unknown_class_returns_404(string classId)
    {
        var response = await api.ApplyAsync(classId, AdmissionClient.StudentId(1));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
