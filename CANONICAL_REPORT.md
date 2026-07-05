# Canonicalization report — findings

Repository scanned: project root (this folder).

SQL files found:
- supabase_whatsapp_import_patch_v1.sql
- supabase_patch_after_schema_v1.sql

README-like files:
- README.md
- README_COMMERCIAL_ANALYSIS.md
- WHATSAPP_IMPORTER_README.md (mentioned)

Other findings:
- package-lock.json present in repo root and additional lockfile detected outside repo root earlier (Next.js warning). This may confuse tooling (Turbopack root detection).
- node_modules and .next are present (expected for local dev).
- next.config.ts and package.json were recently adjusted to ensure Windows compatibility (turbopack.root and webpack flags).
- .env.local exists and contains placeholders for NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and several OPENAI_* vars (ensure secrets stored securely).

Possible duplicates / dispersions:
- Multiple README files describing overlapping features; standardize into README.md and separate docs/ for specifics.
- SQL patches live as standalone files; recommend migrating to /db/migrations with ordered filenames.

Risks:
- Turbopack caused build panic on Windows due to path length and adapterFn errors; currently switched to webpack to avoid this. Keep note when upgrading Next.js.
- Long filesystem paths on Windows may break builds and source maps (.next server chunks). Consider moving repo to a shorter path if issues persist.
- Secrets in .env.local must not be committed; ensure .env.example contains only placeholders.
- Multiple lockfiles across parent dirs may cause tooling to detect wrong workspace root.

Next minimal actions performed in this task:
- Declared this repo as canonical in README.md.
- Added checklist to plan.md for the TODO.

Report generated automatically. Review and approve the README wording or request edits before committing upstream.
