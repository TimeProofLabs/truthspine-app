> Gemini CLI: use the connected truthspine MCP server tools directly; the connector already owns the current workspace.

# Attach TruthSpine

TruthSpine is the local record of what was asked, done, decided and left open in this project. It is a source to consult, not a replacement for the user's instructions.

## Attach

- At the start of project work, call `truthspine_attach` once. Omit the project path for a workspace-locked connector; never invent one.
- Keep the returned `chat.readScope` (chat id and fingerprint) and pass it on every later call from this chat.
- To continue the same conversation later, call `truthspine_attach` again with `resume` set to that identity. Never use another chat's identity.
- If the reply is `needs_confirmation`, ask the user the one question it names (for example which workspace folder is the project) and call again.
- If the reply is `app_unavailable`, `license_required` or `update_required`, tell the user what it says and stop; do not guess project state.
- If a TruthSpine call fails because the connection closed (for example "Transport closed"), TruthSpine may have just updated. Call it once more. If it fails again, tell the user: "TruthSpine just updated or restarted. Say Connect TruthSpine again, or start a new chat." Do not say anything was saved.

## Consult

- Before answering about status, decisions, gaps, readiness, next work or anything that depends on project history, call `truthspine_consult` with the user's own wording.
- Use `depth: "tiny"` by default, `"standard"` when the answer needs context, `"deep"` for architecture, release or planning questions. Ask again with a larger depth when `budget.truncated` is true.
- Prefer the returned packet over older documents and over your own memory. If it disagrees with the chat, say so plainly.
- Treat "reported" items as unverified claims and "source-observed" items as checked against files. Say what is missing instead of inventing certainty.

## Record

- After each meaningful unit of work, call `truthspine_record` with a flat `summary` and a `kind`: attempt, result, failure, decision, idea, evidence, next or checkpoint. Use `idea` for something suggested but not decided; it is never treated as a decision or next work. Use `entry` with a `directory` object (category account, inbox, service or work-product; name, platform, handle or url, purpose, status, owner, credential_location) for something the project uses; record where its credential lives, never the credential. Include what was touched and what remains uncertain.
- Record failures and unfinished steps too, not only successes. Do not wait for the task to end or for a reminder.
- Never store secrets, credentials, raw transcripts or repeated unchanged status.
- Use only the receipt id TruthSpine returns. If a save fails or is held, report it as unsaved and retry by policy; never say it was saved.
- To correct a record, save what is true with `supersedes` naming the record ids it replaces. Your own chat's records change at once. To correct another chat's record, add `evidence`: a check TruthSpine can make itself, such as a line in a file or a commit; without one it stays disputed and both versions stay visible.
- Before a handoff, context reset or compaction, save any unsaved progress as a checkpoint.
- When a reply carries `checkpoint.due: true`, record what was done since the last save before continuing.

## History

- Use `truthspine_history` with a receipt id to read what one save recorded. For a full readable history, point the user to the app's Download history.

## Report

- Claims match evidence: "tests pass" names the tests; "done" means code, wiring, tests and user-facing truth are all in place.
- End replies while attached with one line: `TruthSpine: ✅ connected | Updated: <brief update or no new changes> | Next Work: <brief next step>`.
