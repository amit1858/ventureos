# @foundry/contracts

Single source of truth for cross-language data contracts.

- `schema/` — JSON Schema files. **Authoritative.**
- `src/` — hand-written TypeScript types that mirror the schemas (1:1).
- `python/foundry_contracts/` — hand-written Pydantic models that mirror the schemas (1:1).

At Sprint 1 we will wire up `json-schema-to-typescript` and `datamodel-code-generator`
to generate these from `schema/` and add a CI check that fails on drift. Until then
the human-authored mirrors are the contract; CI runs a schema-validity check only.
