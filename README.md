# BuatLega

macOS disk analyzer & cleaner — menemukan file besar, cache developer, dan sampah di disk lu.

![Platform](https://img.shields.io/badge/platform-macOS-blue)
![License](https://img.shields.io/badge/license-MIT-blue)

**BuatLega** scan directory, tampilin visual treemap, dan hapusin file yang ga kepake. Dibuat untuk developer yang mau bebasin space dari `node_modules`, Xcode DerivedData, Docker, dan sejenisnya.

---

## Features

**Dashboard**
- Info disk: total/used/available space
- Breakdown chart per kategori (documents, media, code, cache, etc.)

**Scanner**
- Scan recursive dengan progress real-time
- Traffic light safety rating:
  - 🟢 Safe — bisa dihapus langsung
  - 🟡 Review — cek dulu sebelum hapus
  - 🔴 Caution — berpotensi break app
- Filter & sort by size, category, safety, name

**Treemap**
- Visualisasi interaktif (Nivo treemap)
- Click untuk drill-down ke subdirectory
- Color-coded per kategori

**Developer Junk Scanner**
- `node_modules`
- Xcode DerivedData / Archives / DeviceSupport / iOS Simulators
- CocoaPods / SPM cache
- Gradle cache
- Docker images & volumes
- Homebrew cache
- Git objects

**Large Files Finder**
- Cari file > threshold (50MB / 100MB / 500MB / 1GB)
- Sort by size
- Highlight file yang ga dibuka > 6 bulan
- Quick action: Open in Finder, Move to Trash

**Cleanup**
- Multi-select items
- "Select all safe" untuk cleanup satu-klik
- Confirmation dialog dengan估算 freed space
- 🔴 Caution items minta ketik "DELETE" buat konfirmasi
- Pindah ke Trash (bukan permanent delete)

**Full Disk Access (FDA)**
- Onboarding flow pas pertama buka
- Tombol langsung ke System Settings → Privacy & Security
- Persistent banner kalau FDA belum granted

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Tauri v2 |
| Frontend | React 19 + TypeScript + Vite |
| Backend | Rust (native speed scanning) |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Charts | Nivo (@nivo/treemap) |
| Icons | Phosphor Icons |
| Animations | Framer Motion + GSAP |

### Kenapa Tauri?

- Bundle < 10MB (Electron = 100-150MB)
- RAM idle 30-50MB (Electron = 150-300MB)
- Startup < 1 detik
- Rust backend = scan jutaan file bisa cepat

---

## Prerequisites

- **macOS** (app ini buat macOS)
- **Node.js** ≥ 18
- **pnpm** (package manager)
- **Rust** & `cargo` (via `rustup`)

Cek install:

```bash
node --version
pnpm --version
rustc --version
```

---

## Setup

```bash
# 1. Clone repo
git clone https://github.com/rfkokt/BuatLega
cd BuatLega

# 2. Install dependencies
pnpm install

# 3. Setup Rust env (jika belum ada)
# Install rustup kalo belom:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 4. Generate Tauri icons (wajib, dari repo baru)
pnpm tauri icon
```

---

## Development

```bash
# Start dev server + Tauri window
pnpm tauri dev
```

App bakal open di window baru. Hot reload frontend aktif.

---

## Build for Release

```bash
# Build production .app bundle
pnpm tauri build
```

Output: `src-tauri/target/release/bundle/macos/BuatLega.app`

---

## Project Structure

```
BuatLega/
├── src/                      # React frontend
│   ├── components/           # UI components
│   │   ├── ui/               # Base: Button, Card, Dialog, etc.
│   │   ├── layout/           # Sidebar, Header, Shell
│   │   ├── scanner/          # FileList, FilterBar
│   │   ├── visualizer/        # Treemap, Breadcrumbs
│   │   └── cleanup/          # ConfirmDialog, CleanupSummary
│   ├── hooks/                # use-scanner, use-disk-info, use-cleanup
│   ├── pages/                # Dashboard, Scanner, Visualizer, DevTools, Settings
│   ├── stores/               # Zustand (scan-store, app-store)
│   ├── types/                # TypeScript interfaces
│   └── services/             # Tauri IPC wrapper
├── src-tauri/                 # Rust backend
│   └── src/
│       ├── commands/          # Tauri IPC handlers
│       ├── scanner/           # Parallel dir walker, categorizer
│       └── models/            # FileNode, ScanResult types
├── package.json
└── vite.config.ts
```

---

## Roadmap

- [x] Disk info dashboard (P0)
- [x] File system scanner (P0)
- [x] Scan results list view (P0)
- [x] Basic cleanup (move to trash) (P0)
- [x] App shell & navigation (P0)
- [x] FDA onboarding (P0)
- [x] Treemap visualization (P1)
- [x] Developer junk scanner (P1)
- [x] Large files finder (P1)
- [x] Category breakdown chart (P1)
- [ ] Duplicate file finder (P2)
- [ ] App uninstaller (P2)
- [ ] Menu bar widget (P2)
- [ ] Scheduled cleanup (P2)
- [ ] Real-time storage monitor (P3 — proposed)
- [ ] Cloud storage analysis (P3 — proposed)
- [ ] Smart recommendations (P3 — proposed)

Lihat [FEATURES.md](./FEATURES.md) untuk detail lengkap.

---

## License

MIT
