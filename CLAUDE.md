# Claude Code Instructions — ComfyNode Designer

## Branch & PR workflow

- **Always develop on branch:** `claude/comfyui-node-generator-1FLyt`
- **After every push**, immediately attempt to open a pull request targeting `main`
- Use `gh pr create` if the `gh` CLI is available
- If `gh` is not installed, try the GitHub API:
  ```bash
  curl -s -X POST "https://api.github.com/repos/MNeMoNiCuZ/ComfyNodeDesigner/pulls" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"...\",\"head\":\"claude/comfyui-node-generator-1FLyt\",\"base\":\"main\",\"body\":\"...\"}"
  ```
- If `GITHUB_TOKEN` is not set, **tell the user explicitly** that a PR could not be
  created automatically, show them the direct GitHub URL to do it themselves:
  `https://github.com/MNeMoNiCuZ/ComfyNodeDesigner/compare/claude/comfyui-node-generator-1FLyt`
- **Never silently skip PR creation.** Always attempt it and report the result.

## Tech stack

- Electron 34 + React 18 + TypeScript via electron-vite
- TailwindCSS v3 + shadcn/ui (Radix UI)
- Zustand state management
- Monaco Editor for code preview
- vitest for tests

## Key commands

```bash
npm run dev        # Start in development mode
npm run build      # Production build (outputs to out/)
npm test           # Run vitest tests (27 tests in codeGenerator.test.ts)
npm run package    # Package as installer (dist/)
```

## Project layout

```
src/main/generators/codeGenerator.ts   # Python code generation — pure TS, no Electron deps
src/main/ipc/llmHandlers.ts            # All 7 LLM provider adapters
src/main/ipc/fileHandlers.ts           # File save/load/export via Electron dialog
src/preload/index.ts                   # contextBridge API surface
src/renderer/src/store/               # Zustand stores (project + settings)
src/renderer/src/types/               # TypeScript interfaces
src/renderer/src/lib/comfyTypes.ts    # ComfyUI type registry with metadata
```

## Code generation rules

- All Python boilerplate is generated **programmatically** in `codeGenerator.ts`
- The LLM only writes the `execute()` method **body** — never the class structure
- Required inputs → `"required"` dict in `INPUT_TYPES`
- Optional inputs → `"optional"` dict in `INPUT_TYPES`
- Widget types (INT/FLOAT/STRING/BOOLEAN/COMBO) that have `forceInput=false` render as inline UI controls

## Adding a new ComfyUI type

1. Add to the `ComfyType` union in `src/renderer/src/types/node.types.ts`
2. Add an entry to `COMFY_TYPE_INFO` in `src/renderer/src/lib/comfyTypes.ts`
3. Handle in `codeGenerator.ts` if special serialization is needed
4. Add test case in `codeGenerator.test.ts`
