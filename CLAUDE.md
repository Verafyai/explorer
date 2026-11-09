# Verafy Explorer

explorer.verafy.ai. Reads Verafy's programs on Solana devnet; never writes.

## Rules

- Read only. No keys, no transactions.
- Never claim more than is real: label devnet certifications as devnet only, and say when jurors were scripted.
- Every address links to Solana Explorer so it can be checked independently.
- No secrets in git. Copy: no em or en dashes.

## Checks

```
npm run typecheck && npm run build && npm test
```
