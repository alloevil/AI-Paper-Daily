# GitHub Issue Draft — EvoMap/evolver

## Title
solidify validation always fails: `scripts/validate-modules.js` and `scripts/validate-suite.js` excluded from npm package by `.npmignore`

## Body

### Describe the bug

When running `evolver solidify`, the validation step always fails because `scripts/validate-modules.js` and `scripts/validate-suite.js` don't exist in the npm-installed package.

The `.npmignore` file explicitly excludes `/scripts/` and `/test/`:

```
/test/
/scripts/
/docs/
/memory/
```

But `src/gep/assetStore.js` hardcodes validation commands that reference these scripts:

```js
// Line 35
return `node scripts/validate-modules.js ${paths.join(' ')}`;

// Lines 57, 75, 90
'node scripts/validate-suite.js',
```

This means:
- `npm install @evomap/evolver` → scripts missing → solidify **always** fails validation
- `git clone` → scripts present → solidify works

### Steps to reproduce

1. Install via npm: `npm install @evomap/evolver`
2. Run any evolution with solidify: `node index.js --intent=innovate`
3. Observe validation failure: `scripts/validate-modules.js` not found

### Expected behavior

solidify should complete validation successfully after a successful evolution.

### Actual behavior

```
validation_failed: node scripts/validate-modules.js ... => spawn ENOENT
```

### Root cause

`.npmignore` excludes `scripts/` and `test/`, but the code depends on them.

### Suggested fix

**Option A** (recommended): Add a `files` field to `package.json` that explicitly includes the scripts:

```json
{
  "files": [
    "index.js",
    "src/",
    "scripts/",
    "test/"
  ]
}
```

And remove `/scripts/` and `/test/` from `.npmignore`.

**Option B**: Bundle the validation logic into `src/gep/` directly instead of relying on external scripts, so the npm package is self-contained.

**Option C**: Ship a minimal test stub with the package so `validate-suite.js` has at least one test to run.

### Environment

- **Package**: @evomap/evolver@1.69.6
- **Install method**: `npm pack @evomap/evolver` (npm registry)
- **Node**: v25.9.0
- **OS**: Linux 5.10.134

### Additional context

This issue affects anyone who installs via npm (the recommended install method in README). Since solidify is a core feature, this effectively breaks the GEP workflow for all npm users.

Searching GitHub issues, I didn't find any prior reports of this — likely because most users haven't reached the solidify step yet, or they installed via git clone.
