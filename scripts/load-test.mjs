// Sends a burst of applicants, split evenly across the backend processes, at one new class.
// It passes only if exactly the available seats are taken and no request fails with a server error.
// Run with: docker compose run --rm load-test
// Each run leaves one class named "Load test" in the database.

const backends = (process.env.BACKEND_URLS ?? 'http://localhost:8080,http://localhost:8081').split(',')
const seats = Number(process.env.SEATS ?? 100)
const applicants = Number(process.env.APPLICANTS ?? 2000)

async function waitUntilReady(baseUrl) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok) {
        return
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`${baseUrl} did not become ready.`)
}

// For the setup and final check only. Docker's internal network can stall briefly right after a build.
async function fetchJson(url, options) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, options)
      return await response.json()
    } catch (error) {
      if (attempt === 3) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}

async function apply(baseUrl, classId, studentNumber) {
  try {
    const response = await fetch(`${baseUrl}/classes/${classId}/holds`, {
      method: 'POST',
      headers: { 'X-Student-Id': String(studentNumber).padStart(17, '0') },
    })
    await response.arrayBuffer()
    return String(response.status)
  } catch (error) {
    return `network error: ${error.cause?.code ?? error.message}`
  }
}

await Promise.all(backends.map(waitUntilReady))

const created = await fetchJson(`${backends[0]}/classes`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Load test', totalSeats: seats }),
})

const startedAt = performance.now()
const statuses = await Promise.all(
  Array.from({ length: applicants }, (_, number) => apply(backends[number % backends.length], created.id, number)),
)
const seconds = ((performance.now() - startedAt) / 1000).toFixed(1)

const counts = {}
for (const status of statuses) {
  counts[status] = (counts[status] ?? 0) + 1
}

const views = await Promise.all(backends.map((baseUrl) => fetchJson(`${baseUrl}/classes/${created.id}`)))

console.log(`Backends:   ${backends.join(', ')}`)
console.log(`Applicants: ${applicants} for ${seats} seats, finished in ${seconds}s`)
console.log(`Responses:  ${JSON.stringify(counts)}`)
for (const [index, view] of views.entries()) {
  console.log(`Backend ${index + 1} sees: held ${view.heldSeats}, confirmed ${view.confirmedSeats}, available ${view.availableSeats}`)
}

const passed =
  counts['201'] === seats &&
  counts['409'] === applicants - seats &&
  views.every((view) => view.heldSeats + view.confirmedSeats === seats && view.availableSeats === 0)

console.log(passed ? 'PASS: no class was oversold.' : 'FAIL: seat counts or responses are wrong.')
process.exit(passed ? 0 : 1)
