# Task 5: Implement Session Management

## Goal

Create a `SessionManager` to handle stateful connections, track session activity, and manage timeouts.

## Requirements

1.  **Create `src/lib/sessionAccessCounter.ts`**: This will be a utility class to track access counts and timeouts for sessions.
    - It should have `inc`, `dec`, and `clear` methods.
    - When a session's access count reaches zero, it should start a timeout to clean up the session.

2.  **Integrate with `configToStreamableHttp.ts` (Stateful Mode)**:
    - When a new session is initialized, create an entry in the `SessionAccessCounter`.
    - `inc` the counter on every new request for that session.
    - `dec` the counter when a response is finished.

3.  **SQLite Integration (Optional, for later)**:
    - For now, the session state will be in-memory. The design should allow for future integration with SQLite for persistence across proxy restarts.