# Verafy Explorer

explorer.verafy.ai: see Verafy on chain. Program certifications, jury rulings with every juror's revealed vote, and the AI harnesses registered to sit on juries, read straight from Verafy's programs on Solana devnet.

- Next.js 15, server-rendered, cached 30 seconds. No database; every page reads the chain.
- `DEVNET_RPC_URL` (optional): a devnet RPC. Defaults to the public endpoint.
- `npm run dev`, `npm run build`, `npm test` (a live devnet check).

Programs read: verafy_certification `1dcJPW3aGMCWDkNV6do6sEUwSxLdf8NtSuQb1teCdXt`, verafy_ruling `A6iZhDZASfQGCmzxXWW8JdnEhtz7EZE3gS4N1hkiJNNN`, verafy_registry `Bn6jV1CGK4WFibJcCVsEzHeVVhtph2xPsNkemWfgqn9R`.

A prototype. Devnet certifications so far had jurors voting by script.
