# Comfy Node Designer

A desktop GUI for designing and generating [ComfyUI](https://github.com/comfyanonymous/ComfyUI) custom nodes — without writing boilerplate.

You can visually configure your node's inputs, outputs, category, and flags. The app generates all the required Python code programmatically.

<img width="1308" height="388" alt="image" src="https://github.com/user-attachments/assets/7ad53d06-11d6-4c70-9570-a13d9281e6e3" />


An integrated LLM assistant writes the actual node logic (`execute()` body) based on your description, with full multi-turn conversation history so you can iterate and see what was added when.

<img width="1309" height="1129" alt="image" src="https://github.com/user-attachments/assets/1e1dac53-c911-4fb5-b5e7-de8eff30ae28" />

Preview your node visually to see something like what it will look like in ComfyUI.

<img width="708" height="448" alt="image" src="https://github.com/user-attachments/assets/8c6291e7-63ab-40e1-88e1-f4bf21c71415" />

View the code for the node.

<img width="964" height="833" alt="image" src="https://github.com/user-attachments/assets/80db9587-d842-4567-8fd7-74458679e07f" />



---

## Features

### Node Editor

| Tab | What it does |
|---|---|
| **Node Settings** | Internal name (snake_case), display name, category, pack folder toggle |
| **Inputs** | Add/edit/reorder input sockets and widgets with full type and config |
| **Outputs** | Add/edit/reorder output sockets |
| **Advanced** | OUTPUT_NODE, INPUT_NODE, VALIDATE_INPUTS, IS_CHANGED flags |
| **Preview** | Read-only Monaco Editor showing the full generated Python in real time |
| **AI Assistant** | Multi-turn LLM chat for generating or rewriting node logic |



### Node pack management

- All nodes in a project export together as a single ComfyUI custom node pack
- Configure **Pack Name** (used as folder name — `ComfyUI_` prefix recommended) and **Project Display Name** separately
- **Export preview** shows the output file tree before you export
- Set a persistent **Export Location** (your `ComfyUI/custom_nodes/` folder) for one-click export from the toolbar or Pack tab
- Exported structure: `PackName/__init__.py` + `PackName/nodes/<node>.py` + `PackName/README.md`

<img width="1302" height="1042" alt="image" src="https://github.com/user-attachments/assets/cbca49c6-8e19-4cb7-8621-9a7cac9980f1" />


### Exporting to node pack
- **Single button press** — Export your nodes to a custom node pack.

<img width="1137" height="714" alt="image" src="https://github.com/user-attachments/assets/0cb2909d-49c7-4d8f-a284-1637ce920d3c" />

### Importing node packs
- **Import existing node packs** — If a node pack uses the same layout/structure, it can be imported into the tool.
  
<img width="617" height="489" alt="image" src="https://github.com/user-attachments/assets/6176885e-5708-4253-82bc-31693340958f" />


### Widget configuration

- **INT / FLOAT** — min, max, step, default, round
- **STRING** — single-line or multiline textarea
- **COMBO** — dropdown with a configurable list of options
- **forceInput** toggle — expose any widget type as a connector instead of an inline control

### Advanced flags

| Flag | Effect |
|---|---|
| `OUTPUT_NODE` | Node always executes; use for save/preview/side-effect nodes |
| `INPUT_NODE` | Marks node as an external data source |
| `VALIDATE_INPUTS` | Generates a `validate_inputs()` stub called before `execute()` |
| `IS_CHANGED: none` | Default ComfyUI caching — re-runs only when inputs change |
| `IS_CHANGED: always` | Forces re-execution every run (randomness, timestamps, live data) |
| `IS_CHANGED: hash` | Generates an MD5 hash of inputs; re-runs only when hash changes |

### AI assistant

- **Functionality Edit** mode — LLM writes only the `execute()` body; safe with weaker local models
- **Full Node** mode — LLM rewrites the entire class structure (inputs, outputs, execute body)
- **Multi-turn chat** — full conversation history per node, per mode, persisted across sessions
- **Configurable context window** — control how many past messages are sent to the LLM
- **Abort / cancel** — stop generation mid-stream
- **Proposal preview** — proposed changes are shown as a diff in the Inputs/Outputs tabs before you accept
- **Custom AI instructions** — extra guidance appended to the system prompt, scoped to global / provider / model

### LLM providers

OpenAI, Anthropic (Claude), Google Gemini, Groq, xAI (Grok), OpenRouter, Ollama (local)

- API keys encrypted and stored locally via Electron `safeStorage` — never sent anywhere except the provider's own API
- Test connection button per provider
- Fetch available models from Ollama or Groq with one click
- Add custom model names for any provider

### Import existing node packs

- **Import from file** — parse a single `.py` file
- **Import from folder** — recursively scans a ComfyUI pack folder, handles:
  - Multi-file packs where classes are split across individual `.py` files
  - Cross-file class lookup (classes defined in separate files, imported via `__init__.py`)
  - Utility inlining — relative imports (e.g. `from .utils import helper`) are detected and their source is inlined into the imported execute body
  - Emoji and Unicode node names

### Project files

- Save and load `.cnd` project files — design nodes across multiple sessions
- **Recent projects** list (configurable count, can be disabled)
- Unsaved-changes guard on close, new, and open

### Other

- **Resizable sidebar** — drag the edge to adjust the node list width
- **Drag-to-reorder nodes** in the sidebar
- **Duplicate / delete** nodes with confirmation
- **Per-type color overrides** — customize the connection wire colors for any ComfyUI type
- **Native OS dialogs** for confirmations (not browser alerts)
- **Keyboard shortcuts**: `Ctrl+S` save, `Ctrl+O` open, `Ctrl+N` new project

---

## Requirements

- **Node.js** 18 or newer — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node.js)
- **Git** — [git-scm.com](https://git-scm.com)

You do **not** need Python, ComfyUI, or any other tools installed to run the designer itself.

---

## Getting started

### 1. Install Node.js

Download and install Node.js from [nodejs.org](https://nodejs.org). Choose the **LTS** version.

Verify the install:

```
node --version
npm --version
```

### 2. Clone the repository

```bash
git clone https://github.com/MNeMoNiCuZ/ComfyNodeDesigner.git
cd ComfyNodeDesigner
```

### 3. Install dependencies

```bash
npm install
```

This downloads all required packages into `node_modules/`. Only needed once (or after pulling new changes).

### 4. Run in development mode

```bash
npm run dev
```

The app opens automatically. Source code changes hot-reload.

---

## Building a distributable app

```bash
npm run package
```

Output goes to `dist/`:

- **Windows** → `.exe` installer (NSIS, with directory choice)
- **macOS** → `.dmg`
- **Linux** → `.AppImage`

> To build for a different platform you must run on that platform (or use CI).

---

## Using the app

### Creating a node

1. Click **Add Node** in the left sidebar (or the `+` button at the top)
2. Fill in the **Identity** tab: internal name (snake_case), display name, category
3. Go to **Inputs** → **Add Input** to add each input socket or widget
4. Go to **Outputs** → **Add Output** to add each output socket
5. Optionally configure **Advanced** flags
6. Open **Preview** to see the generated Python

### Generating logic with an LLM

1. Open the **Settings** tab (gear icon, top right) and enter your API key for a provider
2. Select the **AI Assistant** tab for your node
3. Choose your provider and model
4. Type a description of what the node should do
5. Hit **Send** — the LLM writes the `execute()` body (or full class in Full Node mode)
6. Review the proposal — a diff preview appears in the Inputs/Outputs tabs
7. Click **Accept** to apply the changes, or keep chatting to refine

### Exporting

Point the **Export Location** (Pack tab or Settings) at your `ComfyUI/custom_nodes/` folder, then:

- Click **Export** in the toolbar for one-click export to that path
- Or use **Export Now** in the Pack tab

The pack folder is created (or overwritten) automatically. Then restart ComfyUI.

### Importing an existing node pack

- Click **Import** in the toolbar
- Choose **From File** (single `.py`) or **From Folder** (full pack directory)
- Detected nodes are added to the current project

### Saving your work

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save project (prompts for path if new) |
| `Ctrl+O` | Open `.cnd` project file |
| `Ctrl+N` | New project |

---

## LLM Provider Setup

API keys are encrypted and stored locally using Electron's `safeStorage`. They are never sent anywhere except to the provider's own API endpoint.

| Provider | Where to get an API key |
|---|---|
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) |
| Google Gemini | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| Groq | [console.groq.com/keys](https://console.groq.com/keys) |
| xAI (Grok) | [console.x.ai](https://console.x.ai) |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Ollama (local) | No key needed — install [Ollama](https://ollama.com) and pull a model |

### Using Ollama (free, local, no API key)

1. Install Ollama from [ollama.com](https://ollama.com)
2. Pull a model: `ollama pull llama3.3` (or any code model, e.g. `qwen2.5-coder`)
3. In the app, open **Settings → Ollama**
4. Click **Fetch Models** to load your installed models
5. Select a model and start chatting — no key required

---

## Project structure

```
ComfyNodeDesigner/
├── src/
│   ├── main/                    # Electron main process (Node.js)
│   │   ├── index.ts             # Window creation and IPC registration
│   │   ├── ipc/
│   │   │   ├── fileHandlers.ts  # Save/load/export/import — uses Electron dialogs + fs
│   │   │   └── llmHandlers.ts   # All 7 LLM provider adapters with abort support
│   │   └── generators/
│   │       ├── codeGenerator.ts # Python code generation logic
│   │       └── nodeImporter.ts  # Python node pack parser (folder + file import)
│   ├── preload/
│   │   └── index.ts             # contextBridge — secure API surface for renderer
│   └── renderer/src/            # React UI
│       ├── App.tsx
│       ├── components/
│       │   ├── layout/          # TitleBar, NodePanel, NodeEditor
│       │   ├── tabs/            # Identity, Inputs, Outputs, Advanced, Preview, AI, Pack, Settings
│       │   ├── modals/          # InputEditModal, OutputEditModal, ExportModal, ImportModal
│       │   ├── shared/          # TypeBadge, TypeSelector, ExportToast, etc.
│       │   └── ui/              # shadcn/Radix UI primitives
│       ├── store/               # Zustand state (projectStore, settingsStore)
│       ├── types/               # TypeScript interfaces
│       └── lib/                 # Utilities, ComfyUI type registry, node operations
```

---

## Tech stack

- **Electron 34** — desktop shell
- **React 18 + TypeScript** — UI
- **electron-vite** — build tooling
- **TailwindCSS v3** — styling
- **shadcn/ui** (Radix UI) — component library
- **Monaco Editor** — code preview
- **Zustand** — state management

---

## Key commands

```bash
npm run dev        # Start in development mode
npm run build      # Production build (outputs to out/)
npm test           # Run vitest tests
npm run package    # Package as platform installer (dist/)
```

---

## Contributing

Pull requests welcome. For major changes, open an issue first to discuss the direction.

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-thing`
3. Make your changes
4. Run a build to confirm nothing is broken: `npm run build`
5. Open a pull request

---

## License

MIT — see [LICENSE](LICENSE)
