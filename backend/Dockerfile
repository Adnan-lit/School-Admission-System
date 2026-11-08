FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so package downloads are cached between code changes.
COPY SchoolAdmission.Api/SchoolAdmission.Api.csproj SchoolAdmission.Api/
RUN dotnet restore SchoolAdmission.Api/SchoolAdmission.Api.csproj

COPY SchoolAdmission.Api/ SchoolAdmission.Api/
RUN dotnet publish SchoolAdmission.Api/SchoolAdmission.Api.csproj -c Release -o /app --no-restore

# Only built when running the tests: docker compose run --rm --build backend-tests
FROM build AS test
COPY SchoolAdmission.Tests/SchoolAdmission.Tests.csproj SchoolAdmission.Tests/
RUN dotnet restore SchoolAdmission.Tests/SchoolAdmission.Tests.csproj
COPY SchoolAdmission.Tests/ SchoolAdmission.Tests/
RUN dotnet build SchoolAdmission.Tests/SchoolAdmission.Tests.csproj -c Release --no-restore
ENTRYPOINT ["dotnet", "test", "SchoolAdmission.Tests/SchoolAdmission.Tests.csproj", "-c", "Release", "--no-build", "--logger", "console;verbosity=normal"]

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
