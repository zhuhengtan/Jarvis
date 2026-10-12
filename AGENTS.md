# Jarvis Integration

This workspace implements Jarvis Cognitive Memory Architecture.

Jarvis Runtime is the memory owner. MCP, CLI, HTTP clients, models, and AI IDEs are adapters.

For meaningful client work:

1. Open a Jarvis session for the absolute workspace path.
2. Build context before making architectural decisions.
3. When the user explicitly states preferences/habits, makes key choices, or corrects the assistant, record the user's actual words/choice via `jarvis_event_record(type='observation')` as evidence for user profile learning.
4. Submit events/experiences and close the session with factual results.

Clients must never write semantic memory directly. Durable memory and user profiles are refined and promoted by Jarvis from reviewed candidates and source-backed session results.
