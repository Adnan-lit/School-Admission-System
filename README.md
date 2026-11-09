# School Admission System

Online admission for a school where seats are first come, first served. Applying holds a seat for a limited time, paying the admission fee confirms it, and an unpaid hold gives its seat back automatically.

Built with ASP.NET Core (.NET 10), PostgreSQL, React and TypeScript.

## Run the app

Docker is the only requirement. Ports 3000 and 8080 must be free.

```bash
docker compose up
```

The first run builds the images, which takes a few minutes.

| | URL |
|---|---|
| User panel, for guardians | http://localhost:3000 |
| Admin panel, for the school | http://localhost:3000/admin |
| API | http://localhost:8080 |

Create a class in the admin panel. Then, in the user panel, enter a 17-digit birth registration number in the box at the top of the page and apply.

To stop the app, run `docker compose down`. Your data is kept. To erase it as well, run `docker compose down -v`.

## Settings

Set these in the shell when starting the app.

| Variable | Default | What it does |
|---|---|---|
| `HOLD_DURATION_SECONDS` | `600` | How long an application holds a seat |
| `DB_CONNECTION_STRING` | The bundled PostgreSQL | The database the backend connects to |
| `API_BASE_URL` | `http://localhost:8080` | The backend address used by the browser. It applies when the container starts, with no rebuild |

For example, to try expiry quickly:

```bash
HOLD_DURATION_SECONDS=30 docker compose up
```

## Run the tests

These need only Docker. Run them from this folder.

**Backend tests**, including the concurrency tests, against a real PostgreSQL. They use their own database, so the app's data is not touched:

```bash
docker compose run --rm --build backend-tests
```

**Frontend tests:**

```bash
docker compose run --rm --build frontend-tests
```

**Load test across two backend processes.** It starts a second backend on port 8081, sends 2,000 applicants for 100 seats split across both backends, and fails if a class is oversold:

```bash
docker compose run --rm load-test
```

The load test adds a class named "Load test" each time it runs, and leaves the second backend running. To remove the second backend:

```bash
docker compose --profile two-backends rm -sf backend-2
```

## Project layout

| Path | Contents |
|---|---|
| `backend/SchoolAdmission.Api` | The API and database migrations |
| `backend/SchoolAdmission.Tests` | API tests |
| `frontend/src/user` | The user panel |
| `frontend/src/admin` | The admin panel |
| `scripts/load-test.mjs` | The two-backend load test |

Decisions on points the brief leaves open are in [ASSUMPTIONS.md](ASSUMPTIONS.md). How AI was used is in [AI_USAGE.md](AI_USAGE.md).
