# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities to the EasyTechLabs team via
[GitHub Issues](https://github.com/EasyTechLabs/esytol/issues) or by opening a private
security advisory on the repository.

---

## Known Unresolved Vulnerabilities

### [GHSA-qx2v-qp2m-jg93] PostCSS XSS via unescaped `</style>` in CSS stringify output

| Field                   | Detail                                                                     |
| ----------------------- | -------------------------------------------------------------------------- |
| **Advisory**            | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)   |
| **Severity**            | Moderate                                                                   |
| **Affected package**    | `postcss` <8.5.10                                                          |
| **Location in project** | `node_modules/next/node_modules/postcss` (transitive, internal to Next.js) |
| **Installed version**   | `postcss@8.4.31` (bundled by `next@15.5.20`)                               |
| **Our direct postcss**  | `postcss@^8.5.10` (correct, not affected)                                  |

#### Why it cannot currently be fixed

Next.js 15.5.20 ships its own vendored copy of `postcss@8.4.31` inside
`node_modules/next/node_modules/postcss`. This is a transitive dependency that
**we do not control** — it is pinned by the Next.js package itself.

The only npm-suggested remedy is `npm audit fix --force`, which would downgrade
`next` to `9.3.3`. That action would:

- Remove the App Router (introduced in Next.js 13)
- Remove React Server Components support
- Reintroduce the 3 critical and 1 high CVEs that were present in Next.js ≤15.3.4

Downgrading is therefore not a viable option. The correct fix is for the Next.js team
to update their internal `postcss` dependency.

#### Attack surface assessment

This vulnerability affects PostCSS's **CSS-stringify output** when user-controlled input
is passed directly into a PostCSS pipeline without sanitisation. In Esytol's case:

- PostCSS runs **only at build time** (Tailwind CSS compilation).
- No user input is ever passed into a PostCSS pipeline at runtime.
- The vulnerability is not exploitable in this application's threat model.

The effective risk to Esytol is **negligible**.

#### Mitigation

- Monitor Next.js releases for an internal postcss upgrade.
- Pin to the latest Next.js 15.x patch release (currently `^15.5.20`).
- CI runs `npm audit --omit=dev` on every push; any new production vulnerability
  will fail the pipeline.

#### Monitoring plan

1. Subscribe to [Next.js security advisories](https://github.com/vercel/next.js/security/advisories).
2. The `npm audit` step in `.github/workflows/ci.yml` catches new vulnerabilities automatically.
3. Re-evaluate on each Next.js minor/major release: run `npm audit` after every upgrade.
4. If a fixed Next.js version becomes available, upgrade immediately and close this record.

---

## Dependency Upgrade Policy

- All direct dependencies must pass `npm audit --omit=dev` with zero critical or high findings.
- Moderate findings from **transitive** dependencies that cannot be fixed without breaking
  compatibility are documented here and reviewed on each release cycle.
- `npm audit fix --force` is **prohibited** without explicit CTO approval, because it can
  introduce breaking changes or reintroduce more severe vulnerabilities.
