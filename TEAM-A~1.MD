# AI-Assisted Demo Building Playbook

A short set of practices for anyone on the team using AI (Claude Code, Cursor, etc.) to build demos. Based on lessons from 500+ hours of AI-assisted coding (source: The Coding Sloth, "I Have Spent 500+ Hours Programming With AI").

**Core principle:** AI amplifies your existing habits. Good engineering habits produce better AI output. Sloppy habits produce sloppy code, just faster. Treat AI as a multiplier of your skill, not a replacement for understanding what the code does.

## 1. Be specific
Vague prompts get vague, often-wrong code. Say exactly what you want, what inputs/outputs look like, and what "done" means. "Add a login form" is weak. "Add a login form with email + password fields, client-side validation, and a submit handler that POSTs to /api/login" is strong.

## 2. Break tasks into small pieces
Don't ask for a whole feature in one shot. Ask for one function, one component, one endpoint at a time, and review each before moving to the next. Small steps are easier to verify and easier to roll back.

## 3. Give context up front
Point the AI at relevant docs, existing code patterns, and constraints before asking it to write something new. It should match your project's conventions, not invent its own.

## 4. Say what NOT to do
Explicitly call out what's off-limits: "don't touch the auth logic," "don't change the database schema," "don't add new dependencies." This prevents the AI from "helpfully" breaking things outside scope.

## 5. Keep a guidelines file per project
A `CLAUDE.md` (or `AGENTS.md`) at the project root with stack, conventions, and constraints means every session starts with the right context automatically, instead of re-explaining it each time.

## 6. Use tools to extend capability
MCP tools, docs lookups, browser access, etc. let the AI act on real information instead of guessing. Prefer giving it a way to check something over letting it assume.

## 7. Always verify
Read the diff. Run it. Test it. Never merge or ship AI output you haven't personally checked. AI can be confidently wrong.

## 8. Commit in checkpoints
Commit working code frequently so a bad AI change is a one-step revert, not a scramble.

---
*Living document — update as the team learns more.*
