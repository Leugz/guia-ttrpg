# G.U.I.A TTRPG Desktop Application
An open-source, desktop-first Virtual Tabletop (VTT) and campaign manager engineered for a custom tabletop RPG system based on *Ordem Paranormal*[cite: 1]. 

This architecture prioritizes a highly optimized, lightweight, local-first experience running over LAN multiplayer, removing dependencies on externally hosted web services[cite: 1]. A core architectural pillar is native interoperability with Obsidian, utilizing Markdown and YAML file storage for seamless data management[cite: 1].

## Tech Stack
* **Frontend:** React 18+, TypeScript, Vite, Konva.js (Canvas Engine), Tailwind CSS[cite: 1]
* **Backend:** Rust, Tokio (Async Runtime), Axum (LAN Server/WebSockets), Serde, gray_matter (Markdown Parsing)[cite: 1]
* **Application Shell:** Tauri 2[cite: 1]

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

*Note for Linux/Wayland users: The `tauri:dev` script automatically passes `WEBKIT_DISABLE_DMABUF_RENDERER=1` to prevent hardware acceleration conflicts.*

## Core Features (v1.0)
* **LAN Multiplayer:** Transparent peer-to-peer syncing without port forwarding.
* **Obsidian Integration:** Bidirectional syncing with local `.md` files containing YAML frontmatter.
* **Custom Character Sheets:** Automated step-dice calculations (d4 to d12) and resource tracking (PV/PD) for the Ordem Paranormal system.
