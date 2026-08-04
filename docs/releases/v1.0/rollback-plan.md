# Foundry Release 1.0 — Rollback Plan

Fast, reversible recovery paths for every irreversible-looking step in the release.

## 1. Production deployment rollback (Vercel)

Before deploying, the **previous production deployment ID** is recorded (see `production-smoke-test.md`).

To roll back instantly (re-points the production alias to the last-known-good build; no rebuild):

```powershell
# List recent production deployments
vercel ls --prod

# Promote a specific previous deployment back to production
vercel promote <previous-deployment-url-or-id>
```

Alternatively, in the Vercel dashboard: Project → Deployments → the previous production deployment → **Promote to Production**.

The Vercel rollback is atomic at the alias level and does not touch source, environment variables, or the database.

## 2. Repository rename rollback (GitHub)

The rename `amit1858/ventureos` → `amit1858/foundry-venture-os` is fully reversible. GitHub keeps redirects from the old slug, and the same applies in reverse.

```powershell
# Reverse the rename if required
gh repo rename ventureos --repo amit1858/foundry-venture-os

# Restore the local origin remote
git remote set-url origin https://github.com/amit1858/ventureos.git
```

Existing clones continue to work via GitHub's redirect either direction.

## 3. Release-commit rollback (git)

Release commits are additive on the feature branch `amit1858-fictional-succotash`; history is preserved.

```powershell
# Inspect the release commits
git log --oneline main..HEAD

# Revert a specific commit without rewriting history (preferred)
git revert <commit-sha>

# Or move the branch back to a known-good commit (feature branch only)
git reset --hard <known-good-sha>
```

## 4. Tag / GitHub Release rollback

```powershell
# Delete a local + remote tag if it was pushed prematurely
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Delete a published GitHub Release (keeps or removes the tag as chosen)
gh release delete v1.0.0 --yes
```

## 5. Database (Supabase)

No destructive schema migration is part of Release 1.0. If test data was created during validation, it is deleted per the two-user isolation test plan. RLS remains enabled at all times; rollback of application code does not alter row-level policies.

## Rollback decision guidance

| Symptom | Action |
|---|---|
| Production route/branding regression after deploy | Vercel `promote` previous deployment (§1) |
| Dead in-app links after rename | Confirm redirect; if unresolved, reverse rename (§2) |
| Bad release commit discovered | `git revert` the commit (§3) |
| Tag/Release published too early | Delete tag + release (§4) |
