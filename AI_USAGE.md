# AI usage

I used Claude Code for planning, writing the code and tests, testing the running app, and drafting the docs. I worked through it one step at a time, made each commit myself, and ran the test suites on my own machine.

## Where it was wrong, and how it was caught

- It treated hidden text in the brief's PDF as a requirement. I caught this and told it to follow only the visible brief.
- Its startup code gave up if the database wasn't reachable yet. A failed test run exposed this, and a retry was added.
- Browser testing found UI bugs: a slow refresh delaying error messages, the apply button off-screen on phones, and an error staying on screen after an outage.
