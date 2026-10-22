# Contributing to Warframe.market Docs

Public documentation for Warframe.market APIs, OAuth, WebSockets, data models, and rules.

## Core Principle

**Small, focused changes only.** Every PR should do one thing well. If you have multiple improvements, open multiple PRs. Large PRs are harder to review, more likely to introduce errors, and slower to merge.

## Contribution Types

### Wording-Only Changes

Most contributors do not have access to the private API backend. That is fine for wording-only improvements.

These include:

- Grammar, spelling, and punctuation fixes.
- Clearer prose that does not change documented behavior.
- Formatting and table readability improvements.
- Broken link fixes.
- Typos in headings, labels, or descriptions.

### Contract Changes

These change documented public behavior and require backend source evidence from maintainers:

- HTTP methods, paths, query parameters, headers, request/response fields, status codes, errors, caching, or rate limits.
- Data model fields, types, optionality, enum values, or examples.
- WebSocket routes, payload fields, command responses, event timing, or scopes.
- OAuth scopes, redirect behavior, token lifetimes, or error shapes.

If you do not have backend source evidence, ask a maintainer instead of guessing.

## LLM-Assisted Contributions

LLMs are welcome to help, but you are responsible for what gets submitted.

- **One change per PR.** Do not let an LLM generate a sweeping multi-file rewrite. Scope the task to a single improvement.
- **Review every line.** LLMs make mistakes. Check that fields, routes, status codes, and enum values match the actual API.
- **Never invent contracts.** Do not accept LLM output that adds routes, fields, OAuth behavior, WebSocket events, scopes, rate limits, or rules that are not backed by source evidence.
- **Reject massive PRs.** If your LLM produces a large diff, narrow the prompt and regenerate. PRs that touch many files or change hundreds of lines will be closed.
- **Verify the build.** Run `yarn build` before pushing. An LLM may produce invalid Markdown or broken links.

## PR Rules

- **One topic per PR.** Fix a typo? One PR. Add a new page? One PR. Do not mix unrelated changes.
- **Keep diffs small.** Touch only the files relevant to your change.
- **Run verification.** Run `yarn build` for docs content. Run `yarn typecheck` for TypeScript or Docusaurus config changes.
- **Follow the commit format.** See `.gitmessage` in the repo root. Use `type(scope): description` format with present tense.
- **New pages go in `sidebars.ts`.** Any new doc page must be registered in `sidebars.ts` to appear in navigation.
- **Use `.md` for content.** Use `.mdx` only when the page needs shared components like `ApiEndpoint`, `WsMessage`, `ApiBadge`, or `ApiCallout`.

## Quick Start

```bash
yarn install
yarn start        # dev server on port 3001
yarn build        # production build
yarn typecheck    # TypeScript checks
```

## Review Checklist

Before opening a PR:

- Does this change alter documented public behavior? If yes, is backend source evidence available?
- Is the diff small and focused on one topic?
- Are examples valid JSON or intentionally marked as `ts` shapes?
- Are reusable data models linked instead of duplicated?
- Are headings stable and specific?
- Is `sidebars.ts` updated if a new page was added?
- Did `yarn build` pass?
