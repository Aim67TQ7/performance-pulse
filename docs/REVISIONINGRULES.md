# Application Revision & Versioning Rules

## Purpose

This document defines mandatory rules for classifying revisions and assigning version numbers. Its goal is to prevent breaking changes, silent behavior shifts, and erosion of operational trust.

**If judgment conflicts with this file, this file wins.**

---

## Version Format

All releases must follow:

```
MAJOR.MINOR.PATCH
x.y.z
```

---

## Version Visibility (Non-Negotiable UI Rule)

The current application revision (`x.y.z`) **must always be visible**:

- It must appear in small text directly beneath the app title in the navbar
- The revision number **must be clickable**
- Clicking the revision opens a popup or modal that displays:
  - Full revision history
  - Revision type (MAJOR / MINOR / PATCH)
  - Release date
  - Short description of changes

### Rationale

- Prevents ambiguity about what version is running
- Eliminates "what changed?" confusion
- Supports ops audits, AI validation, and incident reviews
- Reinforces trust by making change visible, not buried

**If users cannot see the revision, the release is incomplete.**

---

## Revision Levels

### MAJOR Revision (x.0.0)

A revision is MAJOR if **any** of the following are true:

- Backward-incompatible changes
- Existing functionality fails without user action
- Core workflow or process logic changes
- Data model or schema changes
- Output meaning or interpretation changes
- Security, permissions, or access model changes
- AI logic changes that alter decision-making

**Decision Rule:** Would an existing user need to relearn, reconfigure, or re-validate trust?

If yes → **MAJOR**

### MINOR Revision (0.y.0)

A revision is MINOR when:

- New functionality is added
- Existing behavior remains valid
- No breaking changes
- No required user action

**Examples:**
- New features or endpoints
- Additive dashboards or reports
- Optional AI enhancements
- Performance improvements without output changes

**Decision Rule:** Can a user ignore this release and continue operating normally?

If yes → **MINOR**

### PATCH Revision (0.0.z)

A revision is PATCH when:

- Fixing defects only
- No new features
- No intentional behavior changes

**Examples:**
- Bug fixes
- Performance optimizations
- UI, copy, logging, or monitoring fixes

---

## Bug Severity Classification

### MAJOR Bug
- Data loss or corruption
- Security vulnerabilities
- Core workflow failure
- Financial, safety, or compliance risk

**Version Impact:** PATCH or hotfix (never escalates to MAJOR version)

### MINOR Bug
- Partial feature failure
- Workarounds exist
- Non-core workflows impacted

**Version Impact:** PATCH

### TRIVIAL Bug
- Cosmetic or copy issues
- No functional impact

**Version Impact:** PATCH (batch when possible)

---

## Non-Negotiable Rules

1. Bugs do not justify MAJOR revisions
2. Refactors are not MAJOR unless behavior changes
3. Effort size does not determine version size
4. Silent behavior changes are **always** MAJOR
5. KPI, metric, or output definition changes are MAJOR
6. Hidden or inaccessible version numbers are **not allowed**

---

## Required PR Declaration

Every pull request must include:

```markdown
## Version Impact
- [ ] MAJOR - Breaking changes
- [ ] MINOR - New features, no breaking changes
- [ ] PATCH - Bug fixes only

## Change Description
[Brief description of what changed and why]

## User Impact
[How does this affect end users?]
```

---

## Release Checklist

Before any release:

1. ✅ Version number updated in database
2. ✅ `is_current` flag set correctly (only one per app)
3. ✅ Description written for revision history
4. ✅ Release date recorded
5. ✅ Version badge visible in UI
6. ✅ Changelog accessible via click

---

## Enforcement

- Automated checks should verify version visibility
- PRs missing version declaration should be flagged
- Releases without visible version numbers are incomplete
