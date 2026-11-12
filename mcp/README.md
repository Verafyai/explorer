# Verafy Explorer MCP server

Reads Verafy's programs on Solana devnet from Claude Code, Cursor, Codex, Gemini CLI or anything else that speaks MCP. Program certifications, jury rulings with every juror's revealed vote, and the AI harnesses registered to sit on juries.

Read only. No keys, no transactions.

```bash
npm install
npx tsx mcp/server.ts        # stdio
```

```json
{
  "mcpServers": {
    "verafy-explorer": {
      "command": "npx",
      "args": ["tsx", "/path/to/explorer/mcp/server.ts"],
      "env": { "DEVNET_RPC_URL": "https://api.devnet.solana.com" }
    }
  }
}
```

`DEVNET_RPC_URL` is optional and defaults to the public endpoint, which rate-limits. Point it at your own RPC for anything beyond occasional use.

## Tools

| Tool | |
|---|---|
| `explorer_status` | Cluster, RPC, current slot, the five program addresses, and counts of certifications, rulings and harnesses. Start here |
| `explorer_certifications` | Certifications, filterable by program and minimum level, newest first |
| `explorer_program` | Everything about one program: current certification, grade, verdict history including superseded records, proven builds |
| `explorer_rulings` | Jury rulings with status, answer, agreement, the bar in parts per million, and every juror seat |
| `explorer_harnesses` | Registered harnesses: family, model, operator, endpoint, price in lamports, active or retired |
| `explorer_account` | Decode any address. Tries certification, ruling and harness layouts and returns whichever matches |
| `explorer_grades` | The grade scale and what each grade means |

## Two labels travel on every payload

```json
{
  "cluster": "devnet",
  "caveat": "Devnet only. Certifications recorded so far had jurors voting by script rather than by model, so a ruling here is not evidence that a model jury works. Every address links to Solana Explorer and can be checked independently."
}
```

This is deliberate and it is in the server rather than the documentation. An agent summarizing these results for a person will compress them, and "this program is certified Hardened" is a far stronger claim than the chain supports. It is certified on devnet, by jurors that voted by script. Putting both facts in front of the numbers on every single response is the only way to make them hard to drop.

The harness registry says the same thing from the other direction: the registered models are literally named `mistral (scripted for this run)`, `llama (scripted for this run)`, `qwen (scripted for this run)`.

Every address comes back with a `link` to Solana Explorer, because a claim about a chain that cannot be checked independently is worth very little, and an agent relaying one to a person should be able to hand them the link.

## It reuses the explorer's own decoders

The server imports `lib/chain.ts`, the same account decoding the explorer pages use, rather than reimplementing the layouts. The page and an agent can therefore never disagree about what an account says. A layout change is made once.

That is also why it runs under `tsx` instead of being compiled standalone: `lib/chain.ts` is Next.js code, with a JSON import and a `next: { revalidate }` cache hint on its fetch. Compiling it outside Next would mean either forking it or editing it for the MCP server's benefit, and a forked decoder is exactly the thing worth avoiding here. The cache hint is ignored by plain Node fetch, which is correct for a process that is not serving pages.

## Reading a ruling

```
status      open | sealed | below bar | empty
answer      the jury's answer
seats       jurors seated
agree       how many agreed with the answer
barPpm      the agreement threshold, in parts per million
metBar      whether agree/seats reached barPpm
jurors[]    each seat: key, revealed answer, state, reasoning hash
```

A sealed ruling whose agreement fell short is recorded as `below bar` rather than discarded. That matters when reading counts: rulings that did not reach consensus are still on chain, and a tally of sealed rulings is not a tally of successful ones.

Juror state runs `seated` then `committed` then `revealed`. A juror stuck at `committed` after a ruling sealed never revealed its vote, which is the case a challenge exists to handle.

## Reading a certification

A certification is bound to **one bytecode hash**. It does not carry over to a new build: recompile the program and it is uncertified until a jury rules again. `explorer_program` says so explicitly rather than leaving it to be inferred, because "is this program certified" has a different answer depending on which build is deployed.

`records` on a certification is how many verdict records that build has. `explorer_program` returns the history with `supersedes` and `supersededBy`, so a revised verdict is visible as a revision rather than silently replacing the earlier one.

## Live, as of 12 November 2026

```
slot            521540149
certifications  104
rulings         129   (129 sealed, 0 below bar)
harnesses       10    (8 active)
```

Run `explorer_status` for the current figures. These are devnet.
