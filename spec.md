# Railway Contracts

## Current State
Full-stack contract management app with Motoko backend and React frontend. Contracts have name, status, contractValue, and an `alreadyExpended` value — but `alreadyExpended` is currently stored only in the browser's `localStorage`, meaning it is lost when the browser is cleared and does not sync across devices.

## Requested Changes (Diff)

### Add
- `alreadyExpended : ?Nat` field to the Motoko `Contract` and `ContractResponse` types
- New parameter `alreadyExpended : ?Nat` to `createContract` and `updateContract` backend functions

### Modify
- `createContract`: accept and persist `alreadyExpended`
- `updateContract`: accept and persist `alreadyExpended`
- `getAllContracts`, `getContract`: return `alreadyExpended` in the response
- `ContractsPage.tsx`: replace all `localStorage.getItem/setItem('rc_expended_...')` reads/writes with the backend field
- `ContractDetailPage.tsx`: replace localStorage read with `contract.alreadyExpended` from backend response

### Remove
- All `localStorage` usage related to `rc_expended_*` keys

## Implementation Plan
1. Update Motoko `Contract` and `ContractResponse` types to include `alreadyExpended : ?Nat`
2. Update `createContract(name, status, contractValue, alreadyExpended)` signature
3. Update `updateContract(id, name, status, contractValue, alreadyExpended)` signature
4. Update `createContractInternal` helper
5. Update `getAllContracts` and `getContract` query responses to include `alreadyExpended`
6. Regenerate `backend.d.ts` to expose the updated interface
7. Update `ContractsPage.tsx` to pass `alreadyExpended` to backend calls and read it from contract responses
8. Update `ContractDetailPage.tsx` to read `contract.alreadyExpended` instead of localStorage
