# Fair play and live workflow

## Solo attempts

Opening a published eligible quiz creates or resumes the user’s single active attempt. The server copies the question version and its keys into a private snapshot, records the first deadline, and returns only the current sanitized question. Answers must match the current question ID and arrive before its deadline. The server compares answers and advances once. The client supplies no score.

The background scheduler advances expired questions even when every browser is closed. Expired deadlines advance from the previous server deadline, so a disconnected client cannot extend a round. Finishing persists counts, score, accuracy, and elapsed time. Explanations and keys are returned only for that user’s completed attempt.

Single choice, multiple choice, true/false, HTTPS image plus single choice, and text questions are supported. Multiple choice needs the exact unique set. Text uses NFKC normalization, whitespace collapse, trim, and case-insensitive matching against an explicit accepted-answer list. No fuzzy grading is claimed.

## Rooms

1. An authorized organizer chooses a published available quiz, capacity, visibility, and optional scheduled timestamp.
2. The server freezes its questions and generates a six-character code.
3. Participants sign in, enter the code, and receive persisted membership. A room-specific lock and unique membership index serialize capacity and duplicate joins.
4. The host starts the room. The server sets an absolute question deadline.
5. The current question is broadcast to authenticated, authorized subscribers. REST polling provides synchronization when sockets are interrupted.
6. Responses are uniquely keyed by room, user, and question. The server validates the user, current state, and deadline. Correctness and elapsed time are server-derived.
7. The scheduler advances the shared question schedule. It can catch up after downtime using persisted absolute deadlines.
8. Completion rebuilds each participant’s score from response rows and saves final state. Repeated finalization does not add points.

Implemented states: SCHEDULED, LOBBY, LIVE, PAUSED, COMPLETED, CANCELLED. Quiz publication has its own draft/published/archived state. Scheduled times are displayed and used for tournament validation; hosts explicitly start rooms. There is no unattended automatic event start.

## Scoring and ties

- Correct: 100 points. Incorrect or unanswered: zero. There is no speed bonus.
- Network time is not compensated; the server’s observed receipt timestamp is authoritative. The UI displays time using a server/client clock offset. No perfect latency fairness is promised.
- Room ties: score descending, correct count descending, eligible elapsed time ascending, then stable user ID. At finalization, unanswered played questions use their full timer as eligible elapsed time.
- Public solo rankings count the best completed result per user and quiz in the selected window, then aggregate. Ties use points, correct count, completion time, and stable ID. Emails remain private; private profiles are excluded.
- Tournament standings sum verified scores from completed rounds for registered members, then apply correct count, elapsed time, and stable ID.

Pause stops accepting responses and saves the remaining question time. Resume sets a new deadline from that remaining time. Ending early counts submitted responses and scores remaining answers zero. Cancellation is explicit. Host controls and disqualifications are audited; there is no API to secretly rewrite scores.

## Reconnection and restart

Sockets validate the session cookie and Origin, authorize room membership, and use Socket.IO connection recovery with authentication rechecked. Every reconnect subscribes and requests the current server state. Sequence numbers protect the UI from older round transitions. A three-second REST refresh recovers current state independently.

State and deadlines live in MongoDB, not a host browser. The supported configuration is one server process. Horizontal scaling requires coordinated distributed locks, a shared Socket.IO adapter, and one authoritative durable scheduler. These have not been implemented or load-tested. A database outage or failure during multi-document finalization still requires operational recovery; the response ledger allows score reconciliation.
