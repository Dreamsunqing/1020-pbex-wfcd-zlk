# Warframe.market Docs

Public documentation for the Warframe.market API, OAuth, WebSockets, and marketplace rules.

View the live site at [docs.warframe.market](https://docs.warframe.market).

Built with [Docusaurus](https://docusaurus.io/), React, TypeScript, and Yarn 4.

## Repository Overview

| Path                   | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `docs/`                | Documentation pages. Most content changes happen here.   |
| `docs/api/`            | HTTP API documentation.                                  |
| `docs/websockets/`     | WebSocket command, event, and payload documentation.     |
| `docs/oauth/`          | OAuth 2.0 documentation.                                 |
| `docs/contributing/`   | Contributor guides and documentation style rules.        |
| `src/`                 | Docusaurus pages, React components, and custom CSS.      |
| `static/`              | Static assets copied into the final site.                |
| `sidebars.ts`          | Sidebar navigation order. Update when adding docs pages. |
| `docusaurus.config.ts` | Docusaurus site configuration.                           |

## Requirements

- Node.js 20 or newer.
- Yarn 4.14 or newer (use `corepack enable` if needed).

## Quick Start

```bash
yarn install
yarn start
```

This starts the dev server on `localhost:3000` and opens it in your browser.

Build the production site:

```bash
yarn build
```

Output is written to `build/`.

## Commands

| Command                  | Description                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `yarn start`             | Start the dev server on `localhost:3000` and open browser.                                    |
| `yarn start:wfm`         | Start on `0.0.0.0:3001` with health check and open `docs.warframe.test` (internal devs only). |
| `yarn start:wfm:no-open` | Same as `start:wfm` without opening the browser.                                              |
| `yarn build`             | Build the static production site.                                                             |
| `yarn serve`             | Serve the built `build/` output locally.                                                      |
| `yarn typecheck`         | Run TypeScript checks.                                                                        |
| `yarn clear`             | Clear Docusaurus caches.                                                                      |

## Contributing

Start with the [Documentation Style Guide](docs/contributing/documentation-style.md).

**What you can contribute:**

- Grammar, clarity, formatting, and typo fixes.
- New translated content (see Translations below).
- Broken link fixes and improved explanations.

**What requires maintainer input:**

Changes that alter documented public behavior need backend source evidence. This includes request/response shapes, fields, enum values, auth requirements, scopes, status codes, validation rules, WebSocket routes, OAuth behavior, and examples that imply contract changes.

**Before submitting a PR:**

1. Keep changes small and focused.
2. Read nearby docs to match existing terminology and format.
3. Add new pages to `sidebars.ts`.
4. Run `yarn build` for docs, sidebar, link, or MDX changes.
5. Run `yarn typecheck` for TypeScript or config changes.

Find issues and submit pull requests on [GitHub](https://github.com/42bytes-team/wfm-docs).

## Translations

Docusaurus i18n is enabled with English as the default locale. Translated docs live at:

```
i18n/<locale>/docusaurus-plugin-content-docs/current/<doc-path>.md
```

Dev server for a specific locale:

```bash
yarn start --locale <lang>
```

Generate translation message files:

```bash
yarn write-translations --locale <lang>
```

Translation guidance:

- Keep `docs/` as the canonical English source.
- Translate only verified public behavior.
- Do not translate route paths, JSON field names, headers, scopes, or enum values.
- Run `yarn build` after adding or moving translated docs.
