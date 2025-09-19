# Omnichannel (monorepo)

This repository contains two projects:
----- Stand at root folder
- `be` — backend (Express / Node) - pnpm start:be
- `fe` — frontend (React) - pnpm start:fe

This repo is set up as a pnpm workspace. The preferred package manager is pnpm.

## Quick start (recommended: pnpm)

1. Install pnpm if you don't have it:

```powershell
npm install -g pnpm
```

2. Install dependencies for the workspace (run from repository root):

```powershell
pnpm install --workspace-root
```

3. Run both dev servers in parallel (preferred):

```powershell
# run the backend dev script and frontend start in parallel
pnpm -w --parallel --dir be run dev --dir fe run start
```


## If you don't use pnpm

You can run the package scripts directly with npm:

```powershell
# backend
cd be
npm install
npm run dev

# frontend
cd ../fe
npm install
npm start
```


```powershell
npm install -g concurrently
```

## Windows notes

- The Makefile uses some POSIX-style conditionals and is intended to be executed with GNU Make (Git Bash, WSL, or a Make for Windows installation). Running `make` in plain PowerShell without GNU Make will not work.
- The `pnpm -w --parallel` commands work from PowerShell and CMD as-is when pnpm is installed.

## Where to go next

- Add a root `dev` script to `package.json` if you'd like `npm run dev` or `pnpm run dev` at the root to start both services.
- Add a small `scripts/start-all.ps1` PowerShell script if you want PowerShell-native dev orchestration without GNU Make.

If you'd like one of those added, tell me which and I will add it.