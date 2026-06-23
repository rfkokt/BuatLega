use crate::models::{DevJunkItem, DevJunkType, SafetyLevel};
use std::collections::HashSet;
use std::path::Path;

#[tauri::command]
pub async fn scan_dev_junk() -> Result<Vec<DevJunkItem>, String> {
    // Run in blocking thread with I/O throttling
    tokio::task::spawn_blocking(|| {
        // Apply macOS background I/O priority
        extern "C" {
            fn setiopolicy_np(iotype: i32, scope: i32, policy: i32) -> i32;
        }
        unsafe {
            setiopolicy_np(0, 1, 3); // IOPOL_TYPE_DISK, IOPOL_SCOPE_THREAD, IOPOL_THROTTLE
            libc::nice(10);
        }
        scan_dev_junk_inner()
    })
    .await
    .map_err(|e| format!("Dev junk scan failed: {}", e))?
}

fn scan_dev_junk_inner() -> Result<Vec<DevJunkItem>, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let mut items: Vec<DevJunkItem> = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();

    // ── Fixed-path junk (known locations) ──
    let fixed_paths: Vec<(&str, DevJunkType, SafetyLevel)> = vec![
        (
            "Library/Developer/Xcode/DerivedData",
            DevJunkType::XcodeDerivedData,
            SafetyLevel::Safe,
        ),
        (
            "Library/Developer/Xcode/Archives",
            DevJunkType::XcodeArchives,
            SafetyLevel::Review,
        ),
        (
            "Library/Developer/Xcode/iOS DeviceSupport",
            DevJunkType::XcodeDeviceSupport,
            SafetyLevel::Safe,
        ),
        (
            "Library/Developer/CoreSimulator/Devices",
            DevJunkType::IOSSimulators,
            SafetyLevel::Review,
        ),
        (
            "Library/Caches/CocoaPods",
            DevJunkType::CocoaPodsCache,
            SafetyLevel::Safe,
        ),
        (
            "Library/Caches/org.swift.swiftpm",
            DevJunkType::SPMCache,
            SafetyLevel::Safe,
        ),
        (
            ".gradle/caches",
            DevJunkType::GradleCache,
            SafetyLevel::Safe,
        ),
        (
            ".gradle/wrapper/dists",
            DevJunkType::GradleCache,
            SafetyLevel::Safe,
        ),
        (
            "Library/Containers/com.docker.docker/Data",
            DevJunkType::DockerImages,
            SafetyLevel::Review,
        ),
        (
            "Library/Caches/Homebrew",
            DevJunkType::HomebrewCache,
            SafetyLevel::Safe,
        ),
        (".npm", DevJunkType::NpmCache, SafetyLevel::Safe),
        (
            "Library/pnpm/store",
            DevJunkType::PnpmStore,
            SafetyLevel::Safe,
        ),
        (
            ".local/share/pnpm/store",
            DevJunkType::PnpmStore,
            SafetyLevel::Safe,
        ),
        (".yarn/cache", DevJunkType::YarnCache, SafetyLevel::Safe),
        (
            "Library/Caches/Yarn",
            DevJunkType::YarnCache,
            SafetyLevel::Safe,
        ),
        (
            ".bun/install/cache",
            DevJunkType::BunCache,
            SafetyLevel::Safe,
        ),
        (
            ".cache/node/corepack",
            DevJunkType::CorepackCache,
            SafetyLevel::Safe,
        ),
        (".cache/uv", DevJunkType::UvCache, SafetyLevel::Safe),
        (".cache/pip", DevJunkType::PipCache, SafetyLevel::Safe),
        (
            "Library/Caches/pip",
            DevJunkType::PipCache,
            SafetyLevel::Safe,
        ),
        (".conda/pkgs", DevJunkType::CondaCache, SafetyLevel::Review),
        (
            "miniconda3/pkgs",
            DevJunkType::CondaCache,
            SafetyLevel::Review,
        ),
        (
            "miniforge3/pkgs",
            DevJunkType::CondaCache,
            SafetyLevel::Review,
        ),
        (
            "anaconda3/pkgs",
            DevJunkType::CondaCache,
            SafetyLevel::Review,
        ),
        (
            ".m2/repository",
            DevJunkType::MavenCache,
            SafetyLevel::Review,
        ),
        ("go/pkg/mod/cache", DevJunkType::GoCache, SafetyLevel::Safe),
        (
            ".cargo/registry/cache",
            DevJunkType::CargoCache,
            SafetyLevel::Safe,
        ),
        (
            ".cargo/git/checkouts",
            DevJunkType::CargoCache,
            SafetyLevel::Safe,
        ),
        (".cargo/git/db", DevJunkType::CargoCache, SafetyLevel::Safe),
    ];

    for (rel_path, junk_type, safety) in fixed_paths {
        let full_path = home.join(rel_path);
        push_item_if_present(
            &full_path,
            junk_type,
            safety,
            None,
            &mut items,
            &mut seen_paths,
        );
    }

    let safe_cache_paths: Vec<(&str, DevJunkType)> = vec![
        ("Library/Caches/com.apple.Safari", DevJunkType::BrowserCache),
        ("Library/Caches/Google/Chrome", DevJunkType::BrowserCache),
        ("Library/Caches/Chromium", DevJunkType::BrowserCache),
        (
            "Library/Caches/BraveSoftware/Brave-Browser",
            DevJunkType::BrowserCache,
        ),
        (
            "Library/Caches/com.microsoft.edgemac",
            DevJunkType::BrowserCache,
        ),
        ("Library/Caches/Firefox", DevJunkType::BrowserCache),
        (
            "Library/Application Support/Google/GoogleUpdater/crx_cache",
            DevJunkType::BrowserCache,
        ),
        (
            "Library/Application Support/Code/Cache",
            DevJunkType::EditorCache,
        ),
        (
            "Library/Application Support/Code/CachedData",
            DevJunkType::EditorCache,
        ),
        (
            "Library/Application Support/Code/CachedExtensions",
            DevJunkType::EditorCache,
        ),
        (
            "Library/Application Support/Code/logs",
            DevJunkType::EditorCache,
        ),
        (
            "Library/Application Support/Cursor/Cache",
            DevJunkType::EditorCache,
        ),
        (
            "Library/Application Support/Cursor/CachedData",
            DevJunkType::EditorCache,
        ),
        (
            "Library/Application Support/Cursor/CachedExtensions",
            DevJunkType::EditorCache,
        ),
        (
            "Library/Application Support/Cursor/logs",
            DevJunkType::EditorCache,
        ),
        ("Library/Caches/Zed", DevJunkType::EditorCache),
        ("Library/Logs/Zed", DevJunkType::EditorCache),
        (
            "Library/Application Support/Slack/Cache",
            DevJunkType::CommunicationCache,
        ),
        (
            "Library/Application Support/Slack/Code Cache",
            DevJunkType::CommunicationCache,
        ),
        (
            "Library/Application Support/Slack/GPUCache",
            DevJunkType::CommunicationCache,
        ),
        (
            "Library/Application Support/discord/Cache",
            DevJunkType::CommunicationCache,
        ),
        (
            "Library/Application Support/discord/Code Cache",
            DevJunkType::CommunicationCache,
        ),
        (
            "Library/Caches/us.zoom.xos",
            DevJunkType::CommunicationCache,
        ),
        (
            "Library/Caches/net.whatsapp.WhatsApp",
            DevJunkType::CommunicationCache,
        ),
        (
            "Library/Caches/ru.keepcoder.Telegram",
            DevJunkType::CommunicationCache,
        ),
        ("Library/Caches/com.openai.chat", DevJunkType::AICache),
        (
            "Library/Caches/com.anthropic.claudefordesktop",
            DevJunkType::AICache,
        ),
        ("Library/Logs/Claude", DevJunkType::AICache),
        ("Library/Logs/com.openai.codex", DevJunkType::AICache),
        (
            "Library/Application Support/Codex/Cache",
            DevJunkType::AICache,
        ),
        (
            "Library/Application Support/Codex/Code Cache",
            DevJunkType::AICache,
        ),
        (
            "Library/Application Support/Codex/GPUCache",
            DevJunkType::AICache,
        ),
        ("Library/DiagnosticReports", DevJunkType::DiagnosticReports),
        ("Library/Saved Application State", DevJunkType::SavedState),
    ];

    for (rel_path, junk_type) in safe_cache_paths {
        let full_path = home.join(rel_path);
        push_item_if_present(
            &full_path,
            junk_type,
            SafetyLevel::Safe,
            None,
            &mut items,
            &mut seen_paths,
        );
    }

    scan_top_level_children(
        &home.join("Library/Caches"),
        DevJunkType::AppCache,
        SafetyLevel::Review,
        &mut items,
        &mut seen_paths,
    );
    scan_top_level_children(
        &home.join("Library/Logs"),
        DevJunkType::AppLogs,
        SafetyLevel::Safe,
        &mut items,
        &mut seen_paths,
    );

    // ── Scan common project roots for build artifacts Mole treats as cleanable ──
    let project_dirs = vec![
        home.join("Projects"),
        home.join("Developer"),
        home.join("Code"),
        home.join("Work"),
        home.join("Workspace"),
        home.join("Repos"),
        home.join("Desktop"),
        home.join("Documents"),
        home.to_path_buf(),
    ];

    for project_dir in project_dirs {
        if project_dir.exists() {
            scan_for_project_junk(&project_dir, &mut items, &mut seen_paths, 5);
        }
    }

    // Sort by size descending
    items.sort_by(|a, b| b.size.cmp(&a.size));
    Ok(items)
}

fn push_item_if_present(
    path: &Path,
    junk_type: DevJunkType,
    safety_level: SafetyLevel,
    project_name: Option<String>,
    items: &mut Vec<DevJunkItem>,
    seen_paths: &mut HashSet<String>,
) {
    if !path.exists() {
        return;
    }

    let normalized = path.to_string_lossy().to_string();
    if !seen_paths.insert(normalized.clone()) {
        return;
    }

    let size = dir_size_fast(path);
    if size == 0 {
        return;
    }

    items.push(DevJunkItem {
        path: normalized,
        size,
        junk_type,
        project_name,
        last_modified: get_modified_time(path),
        safety_level,
    });
}

fn scan_top_level_children(
    root: &Path,
    junk_type: DevJunkType,
    safety_level: SafetyLevel,
    items: &mut Vec<DevJunkItem>,
    seen_paths: &mut HashSet<String>,
) {
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if should_skip_broad_cache_child(&name) {
            continue;
        }

        push_item_if_present(
            &path,
            junk_type.clone(),
            safety_level.clone(),
            Some(name),
            items,
            seen_paths,
        );
    }
}

fn should_skip_broad_cache_child(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("systempreferences")
        || lower.contains("system settings")
        || lower.contains("controlcenter")
        || lower.contains("backgroundtaskmanagement")
        || lower.contains("biometrickit")
        || lower.contains("tcc")
        || lower.contains("keychain")
        || lower.contains("1password")
        || lower.contains("bitwarden")
        || lower.contains("lastpass")
        || lower.contains("dashlane")
}

fn classify_project_artifact(name: &str) -> Option<(DevJunkType, SafetyLevel)> {
    match name {
        "node_modules" => Some((DevJunkType::NodeModules, SafetyLevel::Safe)),
        ".next" => Some((DevJunkType::NextCache, SafetyLevel::Safe)),
        ".turbo" => Some((DevJunkType::TurboCache, SafetyLevel::Safe)),
        "__pycache__" => Some((DevJunkType::PythonBytecode, SafetyLevel::Safe)),
        ".dart_tool" => Some((DevJunkType::FlutterCache, SafetyLevel::Safe)),
        "target" => Some((DevJunkType::RustBuild, SafetyLevel::Safe)),
        "build" | "dist" => Some((DevJunkType::BuildArtifacts, SafetyLevel::Review)),
        _ => None,
    }
}

fn should_skip_project_scan_dir(name: &str) -> bool {
    matches!(
        name,
        "Library"
            | "Applications"
            | "Movies"
            | "Music"
            | "Pictures"
            | "Public"
            | ".Trash"
            | ".Trashes"
            | ".git"
            | ".svn"
            | ".hg"
            | ".venv"
            | "venv"
            | "site-packages"
            | "DerivedData"
            | "Pods"
            | "miniconda3"
            | "miniforge3"
            | "anaconda3"
            | "mambaforge"
    )
}

fn project_name_for_artifact(path: &Path) -> Option<String> {
    path.parent()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().to_string())
}

fn scan_for_project_junk(
    dir: &std::path::Path,
    items: &mut Vec<DevJunkItem>,
    seen_paths: &mut HashSet<String>,
    max_depth: u32,
) {
    if max_depth == 0 {
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();

        if let Some((junk_type, safety)) = classify_project_artifact(&name) {
            push_item_if_present(
                &path,
                junk_type,
                safety,
                project_name_for_artifact(&path),
                items,
                seen_paths,
            );
        } else if name.starts_with('.') || should_skip_project_scan_dir(&name) {
            continue;
        } else {
            scan_for_project_junk(&path, items, seen_paths, max_depth - 1);
        }
    }
}

fn dir_size_fast(path: &std::path::Path) -> u64 {
    jwalk::WalkDir::new(path)
        .parallelism(jwalk::Parallelism::RayonNewPool(2))
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

fn get_modified_time(path: &std::path::Path) -> Option<i64> {
    std::fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
}
