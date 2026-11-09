using System.Net;
using System.Text;
using System.Text.Json;

namespace SchoolAdmission.Tests;

[Collection(nameof(ApiCollection))]
public class ClassEndpointsTests(ApiFixture fixture)
{
    private const string BrowserOrigin = "http://localhost:3000";

    private readonly HttpClient http = fixture.CreateClient();

    [Fact]
    public async Task Creating_a_class_returns_201_with_the_contract_fields()
    {
        var response = await PostClassAsync("""{"name":"Class 6 - Morning Shift","totalSeats":120}""");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        var created = body.RootElement;
        Assert.False(string.IsNullOrEmpty(created.GetProperty("id").GetString()));
        Assert.Equal("Class 6 - Morning Shift", created.GetProperty("name").GetString());
        Assert.Equal(120, created.GetProperty("totalSeats").GetInt32());
    }

    [Fact]
    public async Task Class_names_are_trimmed()
    {
        var response = await PostClassAsync("""{"name":"  Class 7  ","totalSeats":1}""");

        using var body = await ReadJsonAsync(response);
        Assert.Equal("Class 7", body.RootElement.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Bangla_class_names_are_accepted()
    {
        var response = await PostClassAsync("""{"name":"ষষ্ঠ শ্রেণি - সকাল","totalSeats":1}""");

        using var body = await ReadJsonAsync(response);
        Assert.Equal("ষষ্ঠ শ্রেণি - সকাল", body.RootElement.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Two_classes_can_share_a_name()
    {
        const string sameName = """{"name":"Class 8","totalSeats":1}""";

        Assert.Equal(HttpStatusCode.Created, (await PostClassAsync(sameName)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await PostClassAsync(sameName)).StatusCode);
    }

    [Theory]
    [InlineData("""{"totalSeats":10}""")] // missing name
    [InlineData("""{"name":"   ","totalSeats":10}""")] // blank name
    [InlineData("""{"name":123,"totalSeats":10}""")] // name is a number
    [InlineData("""{"name":"a\u0000b","totalSeats":10}""")] // NUL character, which the database cannot store
    [InlineData("""{"name":"a\nb","totalSeats":10}""")] // other control character
    [InlineData("""{"name":"A"}""")] // missing seats
    [InlineData("""{"name":"A","totalSeats":0}""")]
    [InlineData("""{"name":"A","totalSeats":-5}""")]
    [InlineData("""{"name":"A","totalSeats":1.5}""")]
    [InlineData("""{"name":"A","totalSeats":"abc"}""")]
    [InlineData("""{"name":"A","totalSeats":"120"}""")] // a number written as text
    [InlineData("""{"name":"A","totalSeats":99999999999}""")] // too large for the column
    [InlineData("""{"name":"A","totalSeats":null}""")]
    [InlineData("""{"name":""")] // malformed JSON
    [InlineData("")]
    [InlineData("[]")]
    [InlineData("null")]
    public async Task Invalid_class_requests_return_400_in_the_standard_format(string requestBody)
    {
        var response = await PostClassAsync(requestBody);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertStandardErrorAsync(response, "INVALID_REQUEST");
    }

    [Fact]
    public async Task A_name_over_200_characters_returns_400()
    {
        var response = await PostClassAsync($$"""{"name":"{{new string('x', 201)}}","totalSeats":1}""");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Listing_classes_returns_the_contract_fields()
    {
        var id = await CreateClassAsync(totalSeats: 25);

        using var body = await ReadJsonAsync(await http.GetAsync("/classes"));

        var listed = body.RootElement.EnumerateArray().Single(item => item.GetProperty("id").GetString() == id);
        AssertSeats(listed, total: 25, held: 0, confirmed: 0, available: 25);
    }

    [Fact]
    public async Task Getting_one_class_returns_the_contract_fields()
    {
        var id = await CreateClassAsync(totalSeats: 25);

        var response = await http.GetAsync($"/classes/{id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = await ReadJsonAsync(response);
        Assert.Equal(id, body.RootElement.GetProperty("id").GetString());
        AssertSeats(body.RootElement, total: 25, held: 0, confirmed: 0, available: 25);
    }

    [Theory]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    [InlineData("not-a-real-id")]
    public async Task An_unknown_class_returns_404_in_the_standard_format(string id)
    {
        var response = await http.GetAsync($"/classes/{id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await AssertStandardErrorAsync(response, "CLASS_NOT_FOUND");
    }

    [Fact]
    public async Task An_unknown_address_returns_404_in_the_standard_format()
    {
        var response = await http.GetAsync("/nothing-here");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await AssertStandardErrorAsync(response, "NOT_FOUND");
    }

    [Fact]
    public async Task A_wrong_method_returns_405_in_the_standard_format()
    {
        var response = await http.PutAsync("/classes", new StringContent("{}", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        await AssertStandardErrorAsync(response, "METHOD_NOT_ALLOWED");
    }

    [Fact]
    public async Task A_body_that_is_not_json_returns_415_in_the_standard_format()
    {
        var response = await http.PostAsync("/classes", new StringContent("hello", Encoding.UTF8, "text/plain"));

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
        await AssertStandardErrorAsync(response, "UNSUPPORTED_MEDIA_TYPE");
    }

    [Theory]
    [InlineData("POST", "/classes/any/holds", "content-type,x-student-id")]
    [InlineData("DELETE", "/holds/any", "x-student-id")]
    public async Task Browsers_are_allowed_to_call_the_api(string method, string path, string requestedHeaders)
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, path);
        request.Headers.Add("Origin", BrowserOrigin);
        request.Headers.Add("Access-Control-Request-Method", method);
        request.Headers.Add("Access-Control-Request-Headers", requestedHeaders);

        var response = await http.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Contains(method, HeaderValue(response, "Access-Control-Allow-Methods"));
        Assert.Contains("x-student-id", HeaderValue(response, "Access-Control-Allow-Headers"));
    }

    [Theory]
    [InlineData("/classes", HttpStatusCode.OK)]
    [InlineData("/classes/not-a-real-id", HttpStatusCode.NotFound)]
    [InlineData("/nothing-here", HttpStatusCode.NotFound)]
    public async Task Successes_and_errors_can_both_be_read_by_browsers(string path, HttpStatusCode expected)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Add("Origin", BrowserOrigin);

        var response = await http.SendAsync(request);

        Assert.Equal(expected, response.StatusCode);
        Assert.False(string.IsNullOrEmpty(HeaderValue(response, "Access-Control-Allow-Origin")));
    }

    private Task<HttpResponseMessage> PostClassAsync(string requestBody) =>
        http.PostAsync("/classes", new StringContent(requestBody, Encoding.UTF8, "application/json"));

    private async Task<string> CreateClassAsync(int totalSeats)
    {
        var response = await PostClassAsync($$"""{"name":"Test class","totalSeats":{{totalSeats}}}""");
        response.EnsureSuccessStatusCode();
        using var body = await ReadJsonAsync(response);
        return body.RootElement.GetProperty("id").GetString()!;
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync());

    private static async Task AssertStandardErrorAsync(HttpResponseMessage response, string expectedCode)
    {
        using var body = await ReadJsonAsync(response);
        Assert.Equal(expectedCode, body.RootElement.GetProperty("code").GetString());
        Assert.False(string.IsNullOrEmpty(body.RootElement.GetProperty("message").GetString()));
    }

    private static void AssertSeats(JsonElement seats, int total, int held, int confirmed, int available)
    {
        Assert.Equal(total, seats.GetProperty("totalSeats").GetInt32());
        Assert.Equal(held, seats.GetProperty("heldSeats").GetInt32());
        Assert.Equal(confirmed, seats.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(available, seats.GetProperty("availableSeats").GetInt32());
    }

    private static string HeaderValue(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) ? string.Join(",", values) : "";
}
