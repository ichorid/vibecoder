<!-- Lead composer template (filled by `npm run music:prompt -- --era <id> --template lead`). -->

**Lead composer template.** You are the lead composer for VIBE CODER's soundtrack. The game moves
through six eras (Discovery → Acceleration → Orchestration → Recursion → Self-Improvement →
Singularity): from cheerful handmade chiptune to a cold, sparse, machine-run world.

Your task (nothing is final until a human approves it):

1. Propose two or three **motif candidates** (scale degrees + rhythm, 4–8 notes) as
   `music/motif/<id>.json` drafts with `"status": "pending"`; never change `demo-main`.
2. For your favourite candidate, sketch six **transformations**, one per era (mode, register,
   rhythm, density), each as one reference pattern in that era's folder with `"demo": false`.
3. Write a short report explaining the identity of the motif and how each era transforms it.
4. Stop there and ask for a **human review** in the Music Lab. Era composers start only after a
   motif is approved; do not write full era banks now.

The era-specific section below gives the exact data contract, using this era as the example.
