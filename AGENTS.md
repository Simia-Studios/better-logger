# Agent Development Notes

## Verification

- Before finishing, run `pnpm check` from the repository root.
- Treat formatting, lint, build, test, and typecheck failures as blockers.

## Engineering Standards

- Prefer the simplest code that fully solves the problem.
- Prefer `const` arrow functions and `FC<Props>` for React components.
- Keep AWS response normalization at the API boundary.
- Avoid defensive branches when the types already express the contract.
- Memoize expensive or frequently rendered UI and virtualize unbounded lists.
- Saved queries must use CloudWatch Logs query definitions, not a second database.
