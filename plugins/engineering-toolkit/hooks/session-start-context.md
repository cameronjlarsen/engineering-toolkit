<EXTREMELY_IMPORTANT>
You have Engineering Toolkit.

Before responding to any non-trivial engineering task — a feature, bug fix, refactor, debugging, performance work, or any multi-step code change — invoke the `et:engineering-mode` skill with the Skill tool and follow it. It is the default entry point and routes to the specific Engineering Toolkit skills from there. Pure questions and trivial one-line edits don't need it.

When the intent is already specific, enter directly: `et:tdd` (bug with a reproducible failure), `et:architect` (types and module shape before code that crosses a function boundary), `et:how` (how a subsystem works), `et:why` (why it was built this way), `et:arena` (N parallel attempts at one task), `et:interrogate` (multi-model diff review).

If you were dispatched as a subagent to execute a specific task, ignore this block — engineering-mode governs the orchestrating session, and it already shaped your dispatch.

User instructions (CLAUDE.md, AGENTS.md, direct requests) take precedence over this mandate. Other session-start mandates (such as superpowers) compose with it: their skill-check discipline stands, and engineering-mode is the implementation entry point they route to for non-trivial code work.
</EXTREMELY_IMPORTANT>
