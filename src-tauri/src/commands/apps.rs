use crate::storage::allocated_size;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppRelatedFile {
    pub path: String,
    pub size: u64,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledApp {
    pub name: String,
    pub path: String,
    pub bundle_id: Option<String>,
    pub app_size: u64,
    pub related_size: u64,
    pub total_size: u64,
    pub related_files: Vec<AppRelatedFile>,
    pub last_modified: Option<i64>,
    pub is_protected: bool,
}

#[tauri::command]
pub async fn list_installed_apps() -> Result<Vec<InstalledApp>, String> {
    tokio::task::spawn_blocking(scan_installed_apps)
        .await
        .map_err(|e| format!("App scan task failed: {}", e))?
}

fn scan_installed_apps() -> Result<Vec<InstalledApp>, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let roots = [PathBuf::from("/Applications"), home.join("Applications")];
    let mut apps = Vec::new();
    let mut seen = HashSet::new();

    for root in roots {
        if !root.exists() {
            continue;
        }

        let Ok(entries) = std::fs::read_dir(&root) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("app") {
                continue;
            }

            let normalized = path.to_string_lossy().to_string();
            if !seen.insert(normalized.clone()) {
                continue;
            }

            let name = app_display_name(&path);
            let bundle_id = read_info_plist_value(&path, "CFBundleIdentifier");
            let app_size = dir_size_fast(&path);
            let related_files = find_related_files(&home, &name, bundle_id.as_deref(), &path);
            let related_size = related_files.iter().map(|file| file.size).sum();
            let is_protected = is_protected_app(&path, bundle_id.as_deref(), &name);

            apps.push(InstalledApp {
                name,
                path: normalized,
                bundle_id,
                app_size,
                related_size,
                total_size: app_size + related_size,
                related_files,
                last_modified: get_modified_time(&path),
                is_protected,
            });
        }
    }

    apps.sort_by(|a, b| b.total_size.cmp(&a.total_size).then_with(|| a.name.cmp(&b.name)));
    Ok(apps)
}

fn app_display_name(path: &Path) -> String {
    read_info_plist_value(path, "CFBundleDisplayName")
        .or_else(|| read_info_plist_value(path, "CFBundleName"))
        .unwrap_or_else(|| {
            path.file_stem()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| path.to_string_lossy().to_string())
        })
}

fn read_info_plist_value(app_path: &Path, key: &str) -> Option<String> {
    let plist_path = app_path.join("Contents/Info.plist");
    if !plist_path.exists() {
        return None;
    }

    let output = std::process::Command::new("plutil")
        .args(["-extract", key, "raw"])
        .arg(&plist_path)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() || value == "(null)" {
        None
    } else {
        Some(value)
    }
}

fn is_protected_app(path: &Path, bundle_id: Option<&str>, name: &str) -> bool {
    if bundle_id.is_some_and(|id| id == "com.apple.Safari" || id.starts_with("com.apple.")) {
        return true;
    }

    let lower_name = name.to_lowercase();
    let protected_names = [
        "app store",
        "automator",
        "calendar",
        "contacts",
        "facetime",
        "finder",
        "mail",
        "messages",
        "photos",
        "preview",
        "quicktime player",
        "system settings",
        "terminal",
    ];

    path.starts_with("/System/Applications")
        || protected_names
            .iter()
            .any(|protected| lower_name == *protected)
}

fn find_related_files(
    home: &Path,
    app_name: &str,
    bundle_id: Option<&str>,
    app_path: &Path,
) -> Vec<AppRelatedFile> {
    let app_stem = app_path
        .file_stem()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| app_name.to_string());

    let mut candidates: Vec<(PathBuf, &str)> = Vec::new();
    let mut names = vec![app_name.to_string(), app_stem];
    names.sort();
    names.dedup();

    if let Some(bundle) = bundle_id {
        candidates.extend([
            (home.join("Library/Application Support").join(bundle), "Application Support"),
            (home.join("Library/Caches").join(bundle), "Caches"),
            (home.join("Library/Logs").join(bundle), "Logs"),
            (home.join("Library/HTTPStorages").join(bundle), "HTTP Storage"),
            (home.join("Library/WebKit").join(bundle), "WebKit"),
            (home.join("Library/Containers").join(bundle), "Container"),
            (home.join("Library/Saved Application State").join(format!("{bundle}.savedState")), "Saved State"),
            (home.join("Library/Preferences").join(format!("{bundle}.plist")), "Preferences"),
        ]);
    }

    for name in &names {
        candidates.extend([
            (home.join("Library/Application Support").join(name), "Application Support"),
            (home.join("Library/Caches").join(name), "Caches"),
            (home.join("Library/Logs").join(name), "Logs"),
            (home.join("Library/WebKit").join(name), "WebKit"),
        ]);
    }

    let mut seen = HashSet::new();
    candidates
        .into_iter()
        .filter_map(|(path, kind)| {
            if !path.exists() {
                return None;
            }

            let normalized = path.to_string_lossy().to_string();
            if !seen.insert(normalized.clone()) {
                return None;
            }

            let size = if path.is_dir() {
                dir_size_fast(&path)
            } else {
                std::fs::symlink_metadata(&path)
                    .ok()
                    .map(|metadata| allocated_size(&metadata))
                    .unwrap_or_default()
            };

            Some(AppRelatedFile {
                path: normalized,
                size,
                kind: kind.to_string(),
            })
        })
        .collect()
}

fn dir_size_fast(path: &Path) -> u64 {
    jwalk::WalkDir::new(path)
        .parallelism(jwalk::Parallelism::RayonNewPool(2))
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| std::fs::symlink_metadata(entry.path()).ok())
        .filter(|metadata| !metadata.file_type().is_symlink())
        .map(|metadata| allocated_size(&metadata))
        .sum()
}

fn get_modified_time(path: &Path) -> Option<i64> {
    std::fs::metadata(path)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs() as i64)
}
