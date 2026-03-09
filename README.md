# ComfyNode Designer

A modern desktop GUI for designing and generating [ComfyUI](https://github.com/comfyanonymous/ComfyUI) custom nodes — without writing boilerplate.

You visually configure your node's inputs, outputs, category, and flags. The app generates all the required Python code programmatically. An integrated LLM assistant writes the actual node logic (`execute()` body) based on your description.

---

## What it does

| Feature | Details |
|---|---|
| **Visual node editor** | Configure inputs, outputs, category, flags — no Python required for the structure |
| **All ComfyUI types** | IMAGE, LATENT, MODEL, VAE, CLIP, MASK, CONDITIONING, CONTROL_NET, INT, FLOAT, STRING, BOOLEAN, COMBO, and more |
| **Widget config** | INT/FLOAT with min/max/step/round, STRING multiline, COMBO option lists, forceInput toggle |
| **Advanced flags** | OUTPUT_NODE, INPUT_NODE, VALIDATE_INPUTS, IS_CHANGED (none / always / hash) |
| **LLM code generation** | Describe what the node does → LLM writes the `execute()` body |
| **7 LLM providers** | OpenAI, Anthropic (Claude), Google Gemini, Groq, xAI (Grok), OpenRouter, Ollama (local) |
| **Live code preview** | Monaco Editor shows generated Python in real time |
| **Export options** | Single `.py` file or full package (`__init__.py` + `nodes.py` + `requirements.txt` + `README.md`) |
| **Save / load projects** | `.cnd` project files — design nodes over multiple sessions |

---

## Screenshots

> *(Coming soon)*

---

## Requirements

- **Node.js** 18 or newer — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node.js)
- **Git** — [git-scm.com](https://git-scm.com)

That's it. You do **not** need Python, ComfyUI, or any other tools installed to run the designer itself.

---

## Getting started (beginner-friendly)

### 1. Install Node.js

Download and install Node.js from [nodejs.org](https://nodejs.org). Choose the **LTS** version.

To verify the install worked, open a terminal and run:

```
node --version
npm --version
```

Both commands should print a version number.

### 2. Clone the repository

```bash
git clone https://github.com/MNeMoNiCuZ/ComfyNodeDesigner.git
cd ComfyNodeDesigner
```

### 3. Install dependencies

```bash
npm install
```

This downloads all the required packages into a `node_modules/` folder. It only needs to be done once (or after pulling new changes).

### 4. Run in development mode

```bash
npm run dev
```

The app will open. Any changes you make to the source code will hot-reload automatically.

---

## Building a distributable app

To build a standalone installer/executable for your platform:

```bash
npm run package
```

This outputs to the `dist/` folder:
- **Windows** → `.exe` installer (NSIS)
- **macOS** → `.dmg`
- **Linux** → `.AppImage`

> **Note:** To build for a different platform you need to run the build on that platform (or use CI).

---

## Using the app

### Creating a node

1. Click **Add Node** in the left sidebar
2. Fill in the **Identity** tab: internal name (snake_case), display name, category
3. Go to **Inputs** → click **Add Input** to add each input socket/widget
4. Go to **Outputs** → click **Add Output** to add each output socket
5. Optionally configure **Advanced** flags (OUTPUT_NODE, IS_CHANGED, etc.)
6. Open **Preview** to see the generated Python code

### Generating logic with an LLM

1. Click **⚙ Settings** (top right) and enter your API key for a provider
2. Select the **LLM Logic** tab for your node
3. Choose your provider and model
4. Describe what the node should do in plain English
5. Click **Generate** — the LLM writes the `execute()` body
6. Edit the code in the Monaco editor if needed
7. Click **Apply to Node**

### Exporting

- Click **Export** in the toolbar (top right) or the **Preview** tab
- Choose **Single .py file** (drop it straight into `ComfyUI/custom_nodes/`)
  or **Full package** (creates a proper folder with `__init__.py`, `nodes.py`, etc.)

### Saving your work

- **Ctrl+S** — Save project as a `.cnd` file
- **Ctrl+O** — Open an existing `.cnd` project
- **Ctrl+N** — New project

---

## LLM Provider Setup

API keys are encrypted and stored locally on your machine using Electron's `safeStorage`. They are never sent anywhere except to the provider's own API.

| Provider | Where to get an API key |
|---|---|
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) |
| Google Gemini | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| Groq | [console.groq.com/keys](https://console.groq.com/keys) |
| xAI (Grok) | [console.x.ai](https://console.x.ai) |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Ollama (local) | No key needed — install [Ollama](https://ollama.com) and run a model locally |

### Using Ollama (free, local, no API key)

1. Install Ollama from [ollama.com](https://ollama.com)
2. Pull a model: `ollama pull llama3.3` (or any code model, e.g. `codellama`)
3. In the app, open **Settings → Ollama**
4. Click **Fetch Models** to load your installed models
5. Select a model and use it — no key required

---

## Supported ComfyUI Types

| Type | Category |
|---|---|
| `IMAGE`, `MASK` | Tensor |
| `LATENT` | Tensor |
| `CONDITIONING` | Tensor |
| `MODEL`, `VAE`, `CLIP` | Model |
| `CONTROL_NET`, `STYLE_MODEL` | Model |
| `CLIP_VISION`, `CLIP_VISION_OUTPUT` | Model / Tensor |
| `UPSCALE_MODEL` | Model |
| `SAMPLER`, `SIGMAS`, `GUIDER`, `NOISE` | Sampling |
| `GLIGEN` | Model |
| `AUDIO` | Other |
| `INT`, `FLOAT`, `STRING`, `BOOLEAN`, `COMBO` | Primitive (widget) |
| `*` | Any / Wildcard |

---

## Project structure

```
ComfyNodeDesigner/
├── src/
│   ├── main/                    # Electron main process (Node.js)
│   │   ├── index.ts             # Window creation and IPC registration
│   │   ├── ipc/
│   │   │   ├── fileHandlers.ts  # Save/load/export — uses Electron dialogs + fs
│   │   │   └── llmHandlers.ts   # All LLM provider adapters
│   │   └── generators/
│   │       └── codeGenerator.ts # Python code generation logic
│   ├── preload/
│   │   └── index.ts             # contextBridge — secure API surface for renderer
│   └── renderer/src/            # React UI
│       ├── App.tsx
│       ├── components/
│       │   ├── layout/          # TitleBar, NodePanel, NodeEditor
│       │   ├── tabs/            # Identity, Inputs, Outputs, Advanced, LLM, Preview
│       │   ├── modals/          # InputEditModal, SettingsModal, ExportModal
│       │   ├── shared/          # TypeSelector, TooltipWrapper, CodeBadge
│       │   └── ui/              # shadcn/Radix UI primitives
│       ├── store/               # Zustand state (project + settings)
│       ├── types/               # TypeScript interfaces
│       └── lib/                 # Utilities, ComfyUI type registry
```

---

## Tech stack

- **Electron 34** — desktop shell
- **React 18 + TypeScript** — UI
- **electron-vite** — build tooling
- **TailwindCSS v3** — styling
- **shadcn/ui** (Radix UI) — component library
- **Monaco Editor** — code preview and editing
- **Zustand** — state management
- **react-hook-form + zod** — form validation

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
