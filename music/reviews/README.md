# Exported reviews

Put review files exported from the Music Lab (**Import / export → Export reviews**) here, e.g.
`2026-10-16-alice.json`. `npm run music:pack -- --mode approved` reads every `*.json` file in this
folder, re-hashes the music and publishes only exact, current approvals. Conflicting decisions
for the same exact version in two files fail the build — resolve them in the Lab and export
again. Never edit the `status` of a pattern file to "approve" it.
