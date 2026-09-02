# G.U.I.A TTRPG Desktop Application

An open-source, desktop-first Virtual Tabletop (VTT) and campaign manager
engineered for a custom tabletop RPG system based on _Ordem Paranormal_.

This architecture prioritizes a highly optimized, lightweight, local-first
experience running over LAN multiplayer, removing dependencies on externally
hosted web services. A core architectural pillar is native interoperability with
Obsidian, utilizing Markdown and YAML file storage for seamless data management.

## Tech Stack

- **Frontend:** React 18+, TypeScript, Vite, Konva.js (Canvas Engine), Tailwind
  CSS
- **Backend:** Rust, Tokio (Async Runtime), Axum (LAN Server/WebSockets), Serde,
  gray_matter (Markdown Parsing)
- **Application Shell:** Tauri 2

## Prerequisites

To build and run this project, you need the following installed on your system:

1. **Node.js** and **pnpm**
2. **Rust** (via `rustup`)
3. **OS-Specific Dependencies** (Linux/Arch Linux):
   ```bash
   sudo pacman -S --needed base-devel curl wget file openssl appmenu-gtk-module gtk3 libvips libayatana-appindicator webkit2gtk-4.1
   ```

## Getting Started

1. **Install dependencies:**

```bash
pnpm install
```

2. **Run the development server:**

```bash
pnpm tauri:dev
```

_Note for Linux/Wayland users: The `tauri:dev` script automatically passes
`WEBKIT_DISABLE_DMABUF_RENDERER=1` to prevent hardware acceleration conflicts._

## Core Features (v1.0)

- **LAN Multiplayer:** Transparent peer-to-peer syncing without port forwarding.
- **Obsidian Integration:** Bidirectional syncing with local `.md` files
  containing YAML frontmatter.
- **Custom Character Sheets:** Automated step-dice calculations (d4 to d12) and
  resource tracking (PV/PD) for the Ordem Paranormal system.

## 🏗️ Project Architecture & Organization

G.U.I.A utilizes a desktop-web hybrid architecture, maintaining a strict separation of concerns between the OS-level file system and the reactive user interface. 

### Directory Structure

```text
guia-ttrpg/
├── src-tauri/                 # ⚙️ Core Backend (Rust)
│   ├── src/
│   │   ├── main.rs            # Application shell, rolling app.log, async server initialization
│   │   ├── commands.rs        # Tauri IPC handlers (the bridge to React)
│   │   ├── models.rs          # Strict data schemas mirroring the YAML contracts
│   │   ├── dice.rs            # Mathematical engine for step-dice and criticals
│   │   ├── effects.rs         # Ability/inventory effects and roll-pool resolution
│   │   ├── rules.rs           # Fixed system rules: skill catalog, built-in buffs, save DCs
│   │   └── storage.rs         # Markdown/YAML parsing and atomic disk writes
│   └── capabilities/          # Strict security whitelists for IPC bridge access
│
├── src/                       # 🎨 Frontend UI (React + TypeScript)
│   ├── components/            # Feature-based atomic components
│   │   ├── canvas/            # React-Konva 2D mapping engine
│   │   ├── character/         # Character sheet layout and logic
│   │   └── chat/              # Event log and dice result rendering
│   ├── store/                 # Zustand global state (characterStore, chatStore)
│   ├── lib/                   # Static system rules and Typescript interfaces
│   └── App.tsx                # Main layout orchestrator
```

### Architectural Flow
1. **Data Layer (Obsidian/YAML):** The source of truth. All data is persisted locally in `.md` files to ensure player ownership and offline resilience.
2. **Backend Engine (Rust):** Parses local files via `gray_matter`, enforces data integrity through strict structs, calculates dice logic natively for maximum performance, and handles atomic disk writes.
3. **IPC Bridge (Tauri):** Securely passes serialized data between the OS and the webview.
4. **State Management (Zustand):** Caches the backend data in lightweight frontend stores, preventing expensive re-renders of the Konva canvas when sidebar UI changes.
5. **Presentation (React/Tailwind):** Renders the UI based on state changes. Components are feature-isolated to prevent layout coupling.
