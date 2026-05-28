# BuatLega — Feature Backlog & Roadmap

> **Purpose**: This is the single source of truth for all features — planned, in-progress, and completed.
> Any AI or developer adding a new feature MUST check this document first to:
> 1. Verify the feature is approved (listed here)
> 2. Understand its scope and acceptance criteria
> 3. Know which modules it touches
> 4. Check dependencies on other features
>
> **If a feature is NOT listed here, do NOT implement it.** Add it to the "Proposed" section first and wait for approval.

---

## How to Read This Document

Each feature has:
- **ID**: Unique identifier (F-XXX)
- **Status**: `planned` | `in-progress` | `done` | `proposed`
- **Priority**: `P0` (MVP, must have) | `P1` (important) | `P2` (nice to have) | `P3` (future)
- **Phase**: Which development phase it belongs to
- **Touches**: Which files/modules will be created or modified
- **Depends On**: Other feature IDs that must be done first
- **Acceptance Criteria**: Concrete checklist — feature is "done" when all items are checked

---

## Phase 1: Foundation (MVP Core)

### F-001: Disk Info Dashboard
- **Status**: `done`
- **Priority**: `P0`
- **Description**: Show total/used/available disk space on the main dashboard with a visual progress bar and percentage.
- **Touches**:
  - Rust: `commands/disk_info.rs`
  - Frontend: `pages/Dashboard.tsx`, `hooks/use-disk-info.ts`, `stores/app-store.ts`
- **Depends On**: None
- **Acceptance Criteria**:
  - [x] Shows total, used, and available space in human-readable format (e.g., "256 GB / 512 GB")
  - [x] Visual bar with color gradient (green → yellow → red based on usage %)
  - [x] Updates on app launch and after cleanup operations
  - [x] Handles errors gracefully if disk info unavailable

### F-002: File System Scanner
- **Status**: `done`
- **Priority**: `P0`
- **Description**: Scan a given directory recursively, build a tree of FileNodes with sizes, categories, and safety levels. Stream progress to frontend.
- **Touches**:
  - Rust: `commands/scan.rs`, `scanner/walker.rs`, `scanner/categorizer.rs`, `scanner/rules.rs`, `models/file_node.rs`
  - Frontend: `hooks/use-scanner.ts`, `stores/scan-store.ts`, `pages/Scanner.tsx`
- **Depends On**: F-001
- **Acceptance Criteria**:
  - [x] Scans home directory in < 30 seconds (Phase 1: shallow, Phase 2: deep)
  - [x] Streams progress events (`scan://progress`) every ~100 files
  - [x] Categorizes files into FileCategory enum
  - [x] Assigns SafetyLevel to each file/directory
  - [x] Handles permission-denied by skipping (not crashing)
  - [x] Returns complete ScanResult with category breakdown

### F-003: Scan Results List View
- **Status**: `done`
- **Priority**: `P0`
- **Description**: Display scan results as a sortable, filterable list. Users can sort by size, name, date. Filter by category and safety level.
- **Touches**:
  - Frontend: `pages/Scanner.tsx`, `components/scanner/FileList.tsx`, `components/scanner/FilterBar.tsx`
- **Depends On**: F-002
- **Acceptance Criteria**:
  - [x] Table/list showing: name, size, category, safety level, last modified
  - [x] Sort by any column (default: size descending)
  - [x] Filter by FileCategory (multi-select)
  - [x] Filter by SafetyLevel (show only 🟢, only 🟡, etc.)
  - [x] Click row to expand and see children (if directory)
  - [x] Breadcrumb navigation for drill-down

### F-004: Basic Cleanup (Move to Trash)
- **Status**: `done`
- **Priority**: `P0`
- **Description**: Select files/folders from scan results and move them to macOS Trash. Show confirmation dialog with total size before deletion.
- **Touches**:
  - Rust: `commands/cleanup.rs`
  - Frontend: `hooks/use-cleanup.ts`, `components/cleanup/ConfirmDialog.tsx`, `components/cleanup/CleanupSummary.tsx`
- **Depends On**: F-003
- **Acceptance Criteria**:
  - [x] Multi-select items via checkboxes
  - [x] "Select all safe (🟢)" quick action
  - [x] Preflight cleanup preview validates protected paths, missing paths, and nested selections before execution
  - [x] Confirmation dialog showing: item count, total size to free
  - [x] 🔴 items require typing "DELETE" to confirm (extra safety)
  - [x] Uses `trash` crate (never permanent delete)
  - [x] Progress bar during cleanup
  - [x] Success toast: "Freed X.X GB!"
  - [x] Scan results update after cleanup

### F-005: App Shell & Navigation
- **Status**: `done`
- **Priority**: `P0`
- **Description**: Main app layout with sidebar navigation, header, and content area. Dark theme with glassmorphism.
- **Touches**:
  - Frontend: `App.tsx`, `components/layout/Sidebar.tsx`, `components/layout/Shell.tsx`, `components/layout/Header.tsx`, `index.css`
- **Depends On**: None
- **Acceptance Criteria**:
  - [x] Sidebar with nav items and icons (Dashboard, Scanner, Visualizer, Dev Tools, Settings)
  - [x] Active page highlighted in sidebar
  - [x] Smooth page transitions (framer-motion)
  - [ ] Responsive: sidebar collapses on small windows
  - [x] Native macOS title bar with traffic light buttons
  - [x] Dark theme applied globally

### F-006: FDA (Full Disk Access) Onboarding
- **Status**: `done`
- **Priority**: `P0`
- **Description**: On first launch, check if app has Full Disk Access. If not, show a friendly onboarding modal explaining why it's needed and a button to open System Settings.
- **Touches**:
  - Rust: `commands/disk_info.rs` (add `check_fda_status` command)
  - Frontend: `components/ui/FDAModal.tsx`, `stores/app-store.ts`
- **Depends On**: F-005
- **Acceptance Criteria**:
  - [x] Detects FDA status on app launch
  - [x] If not granted: modal with explanation + "Open System Settings" button
  - [x] "Open System Settings" opens Privacy & Security → Full Disk Access
  - [x] User can dismiss modal but sees a persistent banner
  - [ ] Re-checks FDA status when app regains focus (user might have granted it)

---

## Phase 2: Visualization & Developer Tools

### F-007: Treemap Visualization
- **Status**: `done`
- **Priority**: `P1`
- **Description**: Interactive treemap (using Nivo) showing disk usage. Rectangles sized by file/folder size, colored by category. Click to drill down into directories.
- **Touches**:
  - Frontend: `pages/Visualizer.tsx`, `components/visualizer/Treemap.tsx`, `components/visualizer/TreemapTooltip.tsx`, `components/visualizer/Breadcrumbs.tsx`
- **Depends On**: F-002
- **Acceptance Criteria**:
  - [x] Treemap renders from ScanResult data
  - [x] Each rectangle colored by FileCategory
  - [x] Hover shows tooltip: name, size, category
  - [x] Click on directory to drill-down (zoom in)
  - [x] Breadcrumb trail for navigation back
  - [x] Smooth animation on drill-down/out
  - [ ] Right-click context menu: "Open in Finder", "Delete", "Details"

### F-008: Developer Junk Scanner
- **Status**: `done`
- **Priority**: `P1`
- **Description**: Dedicated scanner that finds developer-specific junk: node_modules, Xcode DerivedData, Docker volumes, .gradle, Homebrew cache, etc.
- **Touches**:
  - Rust: `commands/dev_tools.rs`
  - Frontend: `pages/DevTools.tsx`, `components/cleanup/DevJunkList.tsx`, `hooks/use-dev-tools.ts`
- **Depends On**: F-002, F-004
- **Acceptance Criteria**:
  - [x] Scans all known dev junk paths (see TECHNICAL.md §9)
  - [x] Includes Mole-inspired high-impact caches: npm, pnpm, Yarn, Bun, Corepack, uv, pip, conda, Maven, Go, Cargo, Gradle, Homebrew
  - [x] Detects project build artifacts: node_modules, .next, .turbo, __pycache__, .dart_tool, target, build, dist
  - [x] Includes safe generated app data inspired by Mole: browser caches, editor caches, chat app caches, AI app caches, logs, diagnostics, and saved app states
  - [x] Broad user cache entries are surfaced as review items until whitelist/protection rules are stronger
  - [x] Groups results by DevJunkType
  - [x] Shows per-group totals (e.g., "node_modules: 15.3 GB across 42 projects")
  - [x] Shows project name for each item (parsed from parent directory)
  - [x] Shows last modified date (stale projects highlighted)
  - [x] Batch select/delete per group
  - [x] "Clean All Safe" button for one-click cleanup

### F-009: Large Files Finder
- **Status**: `done`
- **Priority**: `P1`
- **Description**: Find and list all files larger than a configurable threshold (default 100MB), sorted by size. Show last access date to identify forgotten files.
- **Touches**:
  - Rust: `commands/scan.rs` (add `find_large_files` command)
  - Frontend: `pages/LargeFiles.tsx`, `components/scanner/LargeFileList.tsx`
- **Depends On**: F-002
- **Acceptance Criteria**:
  - [x] Configurable size threshold (50MB, 100MB, 500MB, 1GB)
  - [x] List sorted by size descending
  - [x] Shows: filename, path, size, last accessed, file type
  - [x] Highlights files not accessed in 6+ months
  - [x] Quick actions: Open in Finder, Move to Trash
  - [ ] "Ignore" list persisted (don't show ignored files again)

### F-010: Category Breakdown Chart
- **Status**: `done`
- **Priority**: `P1`
- **Description**: Donut/pie chart on dashboard showing storage breakdown by FileCategory with legend and sizes.
- **Touches**:
  - Frontend: `components/scanner/CategoryChart.tsx` (on Dashboard page)
- **Depends On**: F-002
- **Acceptance Criteria**:
  - [x] Donut chart with category colors from design system
  - [x] Legend showing category name, size, percentage
  - [x] Click category to navigate to filtered Scanner view
  - [x] Smooth animation on data load

---

## Phase 3: Advanced Features

### F-011: Duplicate File Finder
- **Status**: `planned`
- **Priority**: `P2`
- **Description**: Find duplicate files using a 2-pass approach: (1) group by file size, (2) hash matches with xxHash3. Show groups with "keep one, delete rest" option.
- **Touches**:
  - Rust: `commands/duplicates.rs`
  - Frontend: `pages/Duplicates.tsx`, `components/cleanup/DuplicateGroup.tsx`, `hooks/use-duplicates.ts`
- **Depends On**: F-002, F-004
- **Acceptance Criteria**:
  - [ ] 2-pass detection: size match → hash match (for performance)
  - [ ] Groups displayed with all duplicates shown
  - [ ] Auto-suggest which to keep (oldest or most recently modified)
  - [ ] "Keep one, delete rest" per group
  - [ ] "Auto-clean all duplicates" with confirmation
  - [ ] Progress streaming during hash computation
  - [ ] Exclude system files from duplicate search

### F-012: App Uninstaller
- **Status**: `in-progress`
- **Priority**: `P2`
- **Description**: List all installed apps with their "true" size (app + support files + caches + preferences). Deep uninstall removes all related files.
- **Touches**:
  - Rust: `commands/apps.rs` (new)
  - Frontend: `pages/Apps.tsx` (new), `components/cleanup/AppCard.tsx`
- **Depends On**: F-004
- **Acceptance Criteria**:
  - [x] Lists all apps from /Applications
  - [x] Shows "true" size (bundle + ~/Library/Application Support/X + ~/Library/Caches/X + ~/Library/Preferences/X.plist)
  - [x] Sort by total size
  - [x] Uninstall button with confirmation showing all files to be removed
  - [x] Move all related files to Trash (not just the .app)
  - [ ] Broaden leftover detection with LaunchAgents, privileged helpers, cookies, crash reports, and vendor-specific rules

### F-013: Menu Bar Widget
- **Status**: `planned`
- **Priority**: `P2`
- **Description**: System tray / menu bar icon showing current disk usage percentage. Click to see quick summary, option to open main window.
- **Touches**:
  - Rust: `lib.rs` (tray setup), `commands/disk_info.rs`
  - Frontend: N/A (tray is Rust-native)
- **Depends On**: F-001
- **Acceptance Criteria**:
  - [ ] Tray icon shows disk usage % as text or color indicator
   - [ ] Click opens dropdown: used/free space, "Open BuatLega" button
  - [ ] Updates periodically (every 5 minutes)
  - [ ] Warning icon when usage > 90%

### F-014: Scheduled Cleanup
- **Status**: `planned`
- **Priority**: `P2`
- **Description**: Allow users to set up automatic cleanup schedules with configurable rules (e.g., "delete DerivedData older than 30 days every Sunday").
- **Touches**:
  - Rust: `commands/scheduler.rs` (new), persistent storage for rules
  - Frontend: `pages/Settings.tsx` (schedule section), `components/settings/ScheduleEditor.tsx`
- **Depends On**: F-004, F-008
- **Acceptance Criteria**:
  - [ ] Create rules: target (category/path) + condition (age) + frequency
  - [ ] Preset rules: "Weekly dev cache cleanup", "Monthly large file review"
  - [ ] Preview: show what would be deleted before enabling
  - [ ] History log of automated cleanups
  - [ ] Notification when auto-cleanup runs

---

## Phase 4: Future / Proposed

### F-015: Real-time Storage Monitor
- **Status**: `proposed`
- **Priority**: `P3`
- **Description**: Background service using FSEvents to monitor file system changes. Alert user when large files are created or disk usage crosses thresholds.
- **Touches**: TBD
- **Depends On**: F-001, F-013
- **Acceptance Criteria**: TBD — needs design review

### F-016: Cloud Storage Analysis
- **Status**: `proposed`
- **Priority**: `P3`
- **Description**: Detect and analyze iCloud Drive, Dropbox, Google Drive local storage. Show what can be offloaded to cloud-only.
- **Touches**: TBD
- **Depends On**: F-002
- **Acceptance Criteria**: TBD

### F-017: Smart Recommendations (AI-powered)
- **Status**: `proposed`
- **Priority**: `P3`
- **Description**: Analyze usage patterns and suggest files to archive/delete. "You haven't opened this 15GB project in 6 months."
- **Touches**: TBD
- **Depends On**: F-002, F-009
- **Acceptance Criteria**: TBD

### F-018: System Optimize
- **Status**: `done`
- **Priority**: `P1`
- **Description**: Mole-inspired safe maintenance actions that refresh macOS caches, services, and UI state without sudo.
- **Touches**:
  - Rust: `commands/optimize.rs`
  - Frontend: `pages/Optimize.tsx`, `services/tauri.ts`, `components/layout/Sidebar.tsx`
- **Depends On**: F-005
- **Acceptance Criteria**:
  - [x] Lists available optimization actions with descriptions
  - [x] Runs selected actions only after explicit user selection
  - [x] Supports Quick Look cache reset, Launch Services rebuild, DNS cache flush, Finder restart, Dock restart, and SystemUIServer restart
  - [x] Shows per-action success/failure results
  - [x] Avoids sudo/elevated commands in the initial version

### F-019: System Status
- **Status**: `done`
- **Priority**: `P1`
- **Description**: Mole-inspired live system status dashboard for health, load, memory, disk, battery, uptime, and top processes.
- **Touches**:
  - Rust: `commands/status.rs`
  - Frontend: `pages/Status.tsx`, `services/tauri.ts`, `components/layout/Sidebar.tsx`
- **Depends On**: F-005
- **Acceptance Criteria**:
  - [x] Shows health score and health label
  - [x] Shows CPU load average and uptime
  - [x] Shows memory usage and disk usage
  - [x] Shows battery status when available
  - [x] Lists top processes by CPU
  - [x] Refreshes automatically and manually

---

## Status Tracking

### Phase 1 Progress
| ID | Feature | Status | Priority |
|----|---------|--------|----------|
| F-001 | Disk Info Dashboard | `done` | P0 |
| F-002 | File System Scanner | `done` | P0 |
| F-003 | Scan Results List View | `done` | P0 |
| F-004 | Basic Cleanup | `done` | P0 |
| F-005 | App Shell & Navigation | `done` | P0 |
| F-006 | FDA Onboarding | `done` | P0 |

### Phase 2 Progress
| ID | Feature | Status | Priority |
|----|---------|--------|----------|
| F-007 | Treemap Visualization | `done` | P1 |
| F-008 | Developer Junk Scanner | `done` | P1 |
| F-009 | Large Files Finder | `done` | P1 |
| F-010 | Category Breakdown Chart | `done` | P1 |

### Phase 3 Progress
| ID | Feature | Status | Priority |
|----|---------|--------|----------|
| F-011 | Duplicate File Finder | `planned` | P2 |
| F-012 | App Uninstaller | `planned` | P2 |
| F-013 | Menu Bar Widget | `planned` | P2 |
| F-014 | Scheduled Cleanup | `planned` | P2 |

### Phase 4 (Proposed)
| ID | Feature | Status | Priority |
|----|---------|--------|----------|
| F-015 | Real-time Monitor | `proposed` | P3 |
| F-016 | Cloud Storage Analysis | `proposed` | P3 |
| F-017 | Smart Recommendations | `proposed` | P3 |

---

## Rules for AI Contributors

1. **Before implementing**: Check this document. Is the feature listed? What's its status?
2. **If feature is `planned`**: Proceed. Follow the acceptance criteria as your checklist.
3. **If feature is `proposed`**: Do NOT implement. It needs design review first.
4. **If feature is NOT listed**: Add it to "Proposed" section with a description. Do not implement.
5. **When starting work**: Change status to `in-progress`.
6. **When done**: Change status to `done`. Check off all acceptance criteria.
7. **Dependencies**: Never start a feature if its dependencies are not `done`.
8. **Implementation guide**: See TECHNICAL.md §20 for the step-by-step process.
