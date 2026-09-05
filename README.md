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

G.U.I.A is **host-authoritative**. The GM's machine owns the campaign files and
the rules engine; joined players never touch the filesystem. A player asks the
host to load a sheet or roll a test, the host runs the same Rust code its own
window would run, and every write is announced to the table so open copies stay
in step.

### Directory Structure

```text
guia-ttrpg/
├── src-tauri/                 # ⚙️ Core Backend (Rust)
│   ├── src/
│   │   ├── main.rs            # Bootstrap: logging, SQLite, shared state, IPC surface
│   │   ├── commands.rs        # Tauri IPC adapter (thin; delegates to api)
│   │   ├── api.rs             # Application services: every game operation, once
│   │   ├── state.rs           # Shared runtime state and the broadcast hub
│   │   ├── campaign.rs        # Act discovery and game-instance provisioning
│   │   ├── history.rs         # SQLite session log (chat/rolls) for reconnects
│   │   ├── network/
│   │   │   ├── protocol.rs    # Wire contract (mirrored in TypeScript)
│   │   │   ├── server.rs      # Axum server lifecycle, address discovery
│   │   │   └── session.rs     # Per-connection handling and RPC dispatch
│   │   ├── models.rs          # Data schemas mirroring the YAML contracts
│   │   ├── dice.rs            # Step-dice and criticals
│   │   ├── effects.rs         # Ability/inventory effects and pool resolution
│   │   ├── rules.rs           # Fixed rules: skills, built-in buffs, save DCs
│   │   └── storage.rs         # Markdown/YAML parsing and atomic disk writes
│   └── capabilities/          # IPC permission whitelists
│
├── src/                       # 🎨 Frontend UI (React + TypeScript)
│   ├── features/              # Feature-sliced; each owns its store and components
│   │   ├── home/              # Identity, table list, host/join
│   │   ├── session/           # Session lifecycle and all networking
│   │   │   ├── sessionStore.ts
│   │   │   └── net/
│   │   │       ├── protocol.ts      # Wire types, mirrors protocol.rs
│   │   │       ├── lanConnection.ts # Socket, reconnect, request/response
│   │   │       ├── lanStore.ts      # Presence: roster and offered sheets
│   │   │       └── gameClient.ts    # Local IPC vs. host RPC, decided in one place
│   │   ├── character-sheet/   # Sheet layout, logic and store
│   │   ├── chat/              # Event log and dice rendering
│   │   ├── dice/              # Free-form dice roller
│   │   ├── map/               # React-Konva 2D mapping engine
│   │   └── vtt/               # Main in-session layout orchestrator
│   └── shared/                # Cross-feature types and components
```

### Architectural Flow

1. **Data Layer (Obsidian/YAML):** The source of truth. Character state lives in
   `.md` files inside a game instance, readable and editable in Obsidian.
2. **Rules Engine (`api.rs`):** Parses via `gray_matter`, enforces integrity with
   strict structs, resolves dice natively, and writes atomically. It has no
   knowledge of Tauri or Axum, so it is unit tested directly.
3. **Two Front Doors:** `commands.rs` exposes the engine over Tauri IPC for the
   local window; `network/session.rs` exposes the same functions over WebSocket
   for joined players. Identical rules, identical code.
4. **Transport Choice (`gameClient.ts`):** The only place in the UI that knows
   whether we are the host. Everything else addresses characters by sheet id.
5. **State Management (Zustand):** Lightweight stores cache backend data,
   preventing expensive Konva re-renders when sidebar UI changes.

### Hosting Model

- A LAN server binds only when a GM opens a table, and stops when they leave; a
  player who only ever joins never opens a port.
- Sheets are addressed by file name (`alan.md`) and resolved inside the game
  instance, so a client cannot request an arbitrary path.
- Writes are permission-checked: a player may edit the sheet they claimed, the
  GM may edit anything, and `accessible_sheets` extends that.
- Secret rolls are routed to their author and the GM only, not broadcast.
- Disconnected players keep their claim so an automatic reconnect restores the
  session instead of duplicating it.
