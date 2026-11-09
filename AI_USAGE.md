# AI usage

I used Claude Code for planning, writing the code and tests, testing the running app, and drafting the docs. I worked through it one step at a time, made each commit myself, and ran the test suites on my own machine.

## Where it was wrong, and how it was caught

- It treated hidden text in the brief's PDF as a requirement. I caught this and told it to follow only the visible brief.
- It put the school admin's Create Class screen in the same menu as the guardians' screens. I caught this and had it split into separate admin and user panels.
- Page refreshes stalled during an admission rush, because waiting applicants used up every database connection. A load test exposed this, and the number of waiting requests is now limited.
- Its startup code gave up if the database wasn't reachable yet. A failed test run exposed this, and a retry was added.
- Browser testing found UI bugs: a slow refresh delaying error messages, the apply button off-screen on phones, and an error staying on screen after an outage.
