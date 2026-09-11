![OP - Fan Content Seal](/Selos Licença Aberta/Ordem Paranormal Selo Branco.png)

# G.U.I.A TTRPG

G.U.I.A is a desktop-first virtual tabletop and campaign manager built with Tauri 2, React, TypeScript, and Rust. It is designed around local campaign files and a host-authoritative LAN session: the GM owns the campaign data and rules engine, while players connect to the GM over LAN or a VPN.

The application currently includes campaign instances, character sheets, dice and test resolution, chat and roll history, handouts, a synchronized map/token board, GM controls, reconnect-aware LAN sessions, and a synchronized music jukebox with per-user volume.

## Stack

- Tauri 2
- React 18
- TypeScript
- Vite
- Zustand
- Tailwind CSS
- React Konva / Konva
- Rust 2021
- Tokio
- Axum WebSockets
- Serde / serde_yaml / gray_matter
- SQLite via rusqlite

## Requirements

Install the platform prerequisites for Tauri 2, then install:

- Node.js
- pnpm
- Rust through rustup

Tauri has additional system packages on Linux. Use the current Tauri prerequisite guide for your distribution rather than copying a fixed package list from this repository.

## Development

Install JavaScript dependencies:

```bash
pnpm install
```

Run the complete desktop application:

```bash
pnpm tauri dev
```

The repository also contains `pnpm tauri:dev`, which starts Tauri with `__NV_DISABLE_EXPLICIT_SYNC=1` for environments that need that NVIDIA/Linux workaround.

Useful commands:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm format
pnpm format:check
pnpm tauri build
```

`pnpm dev` only starts the Vite frontend. Features that depend on Tauri commands require the desktop runtime.

## How sessions work

G.U.I.A uses a host-authoritative model rather than peer-to-peer state ownership.

1. A user creates a local campaign instance from the bundled campaign template.
2. The GM opens that campaign and can use it offline.
3. When the GM enables LAN hosting, the Rust backend starts the session server on port `37373`.
4. Players connect using the GM's LAN or VPN IP address.
5. The GM machine resolves rules, reads and writes campaign files, and broadcasts authoritative state changes.
6. Joined clients never receive direct filesystem access to the GM's campaign directory.

The client automatically adds port `37373` when the entered address does not already include a port.

## Current features

### Campaigns

- Independent game instances created from the bundled Act 1 template
- Markdown files with YAML frontmatter for campaign data
- Persistent local board state
- Bundled maps, handouts, portraits, tokens, and audio assets

### Character sheets and rules

- Character identity and profile data
- HP and DP resource tracking
- Step-based attributes and skills
- Abilities, inventory, active effects, and conditions
- Test previews and resolved rolls
- Death-save handling
- Multi-sheet access controlled by the host

### Multiplayer

- LAN/VPN WebSocket sessions
- Host-authoritative RPC for game operations
- Automatic reconnect behavior
- Character claims and GM identity
- Secret-roll routing
- Shared roster, sheets, maps, tokens, handouts, chat, and tools

### VTT

- React-Konva map rendering
- Shared tokens and token movement
- Select, ping, and ruler tools
- Handout visibility and forced-open controls
- Draggable and optionally resizable desktop-style panels
- GM party tracking

### Jukebox

- GM-controlled synchronized playback
- MP3, WAV, and OGG discovery from the campaign music folder
- Play, pause, resume, stop, seek, and loop controls
- Current-time and duration timeline
- Track switching with crossfade
- Per-user music volume
- Persisted local volume preference that is not broadcast to other players

## Project structure

```text
amip-ttrpg/
├── campaigns/
│   └── act_1/
│       └── templates/                 Bundled campaign source content
│           ├── assets/
│           │   └── music/             Jukebox audio
│           ├── handouts/
│           └── maps/
├── public/
│   └── dice/                          Static dice SVG assets
├── src/
│   ├── app/
│   │   └── App.tsx                    Application composition
│   ├── features/
│   │   ├── character-sheet/           Character state and sheet UI
│   │   ├── chat/                      Chat and roll presentation
│   │   ├── dice/                      Free dice roller
│   │   ├── home/                      Identity, campaigns, host/join entry
│   │   ├── jukebox/
│   │   │   ├── components/            Jukebox UI
│   │   │   ├── hooks/                 Playback progress subscription
│   │   │   ├── lib/                   Audio engine and music catalog
│   │   │   └── jukeboxStore.ts        Jukebox state and LAN commands
│   │   ├── map/                       Map rendering and token motion
│   │   ├── session/
│   │   │   ├── net/                   WebSocket, protocol, RPC client, LAN state
│   │   │   └── sessionStore.ts        Session lifecycle
│   │   └── vtt/                       In-session composition and VTT panels
│   ├── shared/
│   │   ├── components/
│   │   └── types/                     Domain types split by concern
│   └── main.tsx
├── src-tauri/
│   ├── capabilities/
│   ├── src/
│   │   ├── lib.rs                     Tauri application entry point
│   │   ├── main.rs                    Desktop launcher
│   │   ├── logging.rs                 Logging initialization
│   │   ├── api.rs                     Application services
│   │   ├── campaign.rs                Campaign provisioning
│   │   ├── commands.rs                Tauri command surface
│   │   ├── dice.rs                    Dice engine
│   │   ├── effects.rs                 Effects and test resolution
│   │   ├── history.rs                 SQLite history
│   │   ├── models.rs                  Rust data models
│   │   ├── network/
│   │   │   ├── protocol.rs            Rust wire protocol
│   │   │   ├── server.rs              LAN server lifecycle
│   │   │   └── session.rs             Connection and RPC handling
│   │   ├── rules.rs
│   │   ├── state.rs
│   │   └── storage.rs                 Markdown/YAML persistence
│   ├── Cargo.toml
│   └── tauri.conf.json
└── vite.config.ts
```

## Architecture

### Frontend

The frontend is organized by feature. Feature-specific state and UI remain together, while reusable domain types live under `src/shared`. `src/app` is only responsible for choosing the current top-level screen.

The jukebox deliberately separates the HTML audio lifecycle from Zustand. React renders controls, Zustand stores serializable UI state and the local volume preference, and the audio engine owns live `Audio` elements, playback position, seeking, crossfades, and duration updates.

### Backend

The Rust backend is the authority for campaign data and multiplayer operations. Local host actions enter through Tauri commands; joined-player actions enter through the WebSocket/RPC layer. Both paths delegate to the same game logic instead of duplicating rules in the frontend.

The desktop binary launches the Tauri application through `src-tauri/src/lib.rs`, keeping the Rust layout compatible with the standard Tauri 2 project structure.

### Campaign data

Campaign templates stay under `campaigns/` because `tauri.conf.json` packages them as application resources. Creating a campaign produces an independent game instance in the application's local data area. This keeps template content separate from browser-only static assets in `public/`.

## Network protocol

The TypeScript wire definitions live in:

```text
src/features/session/net/protocol.ts
```

The Rust equivalents live in:

```text
src-tauri/src/network/protocol.rs
```

Changes to LAN message shapes should be made on both sides in the same change.

## Adding music

Add supported audio files to:

```text
campaigns/act_1/templates/assets/music/
```

Supported extensions are:

- `.mp3`
- `.wav`
- `.ogg`

The frontend discovers those files at build time and uses the filename without its extension as the display name.

## Building

Create a production desktop build with:

```bash
pnpm tauri build
```

The Tauri configuration runs the frontend production build before packaging the desktop application and includes the campaign template resources in the bundle.
