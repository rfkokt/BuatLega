use crate::commands::persistence::{clear_scan_cache_entries, record_cleanup_history};
use crate::models::{CleanupError, CleanupHistoryEntry, CleanupResult};
use crate::storage::allocated_size;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;

/// System paths that must NEVER be deleted (matched by filename)
const PROTECTED_NAMES: &[&str] = &[
    ".Trash",
    ".Trashes",
    ".Spotlight-V100",
    ".fseventsd",
    ".DocumentRevisions-V100",
    ".vol",
    ".TemporaryItems",
];

struct CleanupTarget {
    original: String,
    path: PathBuf,
    size: u64,
}

/// Check if a canonical path is protected (system folder that should never be deleted).
fn is_protected(path: &Path) -> bool {
    if path == Path::new("/")
        || path.starts_with("/System")
        || path.starts_with("/bin")
        || path.starts_with("/sbin")
        || path.starts_with("/usr")
        || path.starts_with("/etc")
        || path.starts_with("/private")
    {
        return true;
    }

    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        // Always block these system dirs regardless of where they are
        if PROTECTED_NAMES.contains(&name) {
            return true;
        }
    }
    // Never delete top-level dirs on root or volumes
    if let Some(parent) = path.parent() {
        let parent_str = parent.to_string_lossy();
        if parent_str == "/" || parent_str == "/Volumes" {
            return true;
        }
        // Protect direct children of /Users (i.e. entire user home dirs)
        if parent_str == "/Users" {
            return true;
        }
        // Protect ~/Library and ~/Applications themselves (but NOT their contents)
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name == "Library"
                || name == "Applications"
                || name == "Desktop"
                || name == "Documents"
                || name == "Downloads"
            {
                // Only protect if this is a direct child of a user's home dir
                if parent_str.starts_with("/Users/") && parent_str.matches('/').count() == 2 {
                    return true;
                }
            }
        }
    }
    false
}

fn prepare_target(path_str: &str) -> Result<Option<CleanupTarget>, CleanupError> {
    let path = Path::new(path_str);

    if !path.exists() {
        return Ok(None);
    }

    let metadata = std::fs::symlink_metadata(path).map_err(|e| CleanupError {
        path: path_str.to_string(),
        reason: e.to_string(),
    })?;

    if metadata.file_type().is_symlink() {
        return Err(CleanupError {
            path: path_str.to_string(),
            reason: "Symlink skipped — deleting links is not useful for storage cleanup"
                .to_string(),
        });
    }

    let canonical = path.canonicalize().map_err(|e| CleanupError {
        path: path_str.to_string(),
        reason: e.to_string(),
    })?;

    if is_protected(&canonical) {
        return Err(CleanupError {
            path: path_str.to_string(),
            reason: "Protected system path — skipped".to_string(),
        });
    }

    let size = if metadata.is_dir() {
        dir_size(&canonical)
    } else {
        allocated_size(&metadata)
    };

    Ok(Some(CleanupTarget {
        original: path_str.to_string(),
        path: canonical,
        size,
    }))
}

fn dedupe_nested_targets(mut targets: Vec<CleanupTarget>) -> Vec<CleanupTarget> {
    targets.sort_by_key(|target| target.path.components().count());
    let mut deduped: Vec<CleanupTarget> = Vec::new();

    'targets: for target in targets {
        for existing in &deduped {
            if target.path.starts_with(&existing.path) {
                continue 'targets;
            }
        }
        deduped.push(target);
    }

    deduped
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

#[tauri::command]
pub async fn cleanup_items(
    app: tauri::AppHandle,
    paths: Vec<String>,
    permanent: bool,
) -> Result<CleanupResult, String> {
    let mut targets = Vec::new();
    let mut failed_items: Vec<CleanupError> = Vec::new();

    for path_str in &paths {
        match prepare_target(path_str) {
            Ok(Some(target)) => targets.push(target),
            Ok(None) => {}
            Err(error) => failed_items.push(error),
        }
    }

    let targets = dedupe_nested_targets(targets);
    let total = targets.len() as u64;
    let mut freed_bytes: u64 = 0;
    let mut reclaimable_bytes: u64 = 0;
    let mut trashed_bytes: u64 = 0;
    let mut permanently_deleted_bytes: u64 = 0;
    let mut items_deleted: u64 = 0;
    let mut successful_paths: Vec<String> = Vec::new();

    for (i, target) in targets.iter().enumerate() {
        let delete_result = if permanent {
            if target.path.is_dir() {
                std::fs::remove_dir_all(&target.path).map_err(|e| e)
            } else {
                std::fs::remove_file(&target.path).map_err(|e| e)
            }
        } else {
            if !target.path.exists() {
                Ok(())
            } else {
                trash::delete(&target.path)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
            }
        };

        match delete_result {
            Ok(()) => {
                reclaimable_bytes += target.size;
                if permanent {
                    freed_bytes += target.size;
                    permanently_deleted_bytes += target.size;
                } else {
                    trashed_bytes += target.size;
                }
                items_deleted += 1;
                successful_paths.push(target.original.clone());
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::NotFound {
                    // Already deleted (e.g. parent folder was deleted), count as success
                    reclaimable_bytes += target.size;
                    if permanent {
                        freed_bytes += target.size;
                        permanently_deleted_bytes += target.size;
                    } else {
                        trashed_bytes += target.size;
                    }
                    items_deleted += 1;
                    successful_paths.push(target.original.clone());
                } else {
                    failed_items.push(CleanupError {
                        path: target.original.clone(),
                        reason: e.to_string(),
                    });
                }
            }
        }

        // Emit progress only every 100 items or on the last item to prevent IPC freezing
        if total > 0 && (i % 100 == 0 || i == targets.len() - 1) {
            let _ = app.emit(
                "cleanup://progress",
                serde_json::json!({
                    "completed": i as u64 + 1,
                    "total": total,
                }),
            );
        }
    }

    if items_deleted > 0 {
        let history_result = record_cleanup_history(CleanupHistoryEntry {
            created_at: now_secs(),
            freed_bytes,
            reclaimable_bytes,
            trashed_bytes,
            permanently_deleted_bytes,
            items_count: items_deleted,
            failed_count: failed_items.len() as u64,
            permanent,
            paths: successful_paths,
        });

        if let Err(e) = history_result {
            log::warn!("Failed to record cleanup history: {}", e);
        }

        if let Err(e) = clear_scan_cache_entries() {
            log::warn!("Failed to clear scan cache after cleanup: {}", e);
        }
    }

    Ok(CleanupResult {
        freed_bytes,
        reclaimable_bytes,
        trashed_bytes,
        permanently_deleted_bytes,
        items_deleted,
        failed_items,
    })
}

fn dir_size(path: &Path) -> u64 {
    jwalk::WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter_map(|e| std::fs::symlink_metadata(e.path()).ok())
        .filter(|m| !m.file_type().is_symlink())
        .map(|m| allocated_size(&m))
        .sum()
}
