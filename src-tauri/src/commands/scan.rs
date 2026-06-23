use crate::commands::persistence::{is_ignored_path, load_ignored_paths, save_scan_cache};
use crate::models::{FileCategory, FileNode, SafetyLevel, ScanProgress, ScanResult};
use crate::scanner::categorizer::categorize_path;
use crate::scanner::rules::{assess_large_file_safety, assess_safety};
use crate::storage::{accessed_secs, allocated_size, modified_secs};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tauri::Emitter;

/// Directory names to skip during scanning (system/virtual dirs that cause hangs)
const SKIP_DIR_NAMES: &[&str] = &[
    ".Spotlight-V100",
    ".fseventsd",
    ".Trashes",
    ".DocumentRevisions-V100",
    ".vol",
    "System",
    ".TemporaryItems",
];

const SKIP_PATH_FRAGMENTS: &[&str] = &["/private/var/db", "/private/var/folders"];

/// Throttle interval — sleep this long every N files to let macOS I/O breathe
const THROTTLE_SLEEP: Duration = Duration::from_millis(1);
/// How many files to process between throttle sleeps
const THROTTLE_BATCH: u64 = 500;
static SCAN_CANCELLED: AtomicBool = AtomicBool::new(false);

/// Set current thread to background I/O + CPU priority on macOS.
/// This tells the kernel to deprioritize this thread's disk access,
/// similar to how Time Machine and Spotlight work in the background.
fn throttle_current_thread() {
    extern "C" {
        fn setiopolicy_np(iotype: i32, scope: i32, policy: i32) -> i32;
    }
    unsafe {
        // macOS: set I/O policy to THROTTLE for this thread
        // IOPOL_TYPE_DISK = 0, IOPOL_SCOPE_THREAD = 1, IOPOL_THROTTLE = 3
        setiopolicy_np(0, 1, 3);

        // Lower CPU priority (nice value 10 = low priority)
        libc::nice(10);
    }
}

#[tauri::command]
pub async fn start_scan(
    app: tauri::AppHandle,
    path: String,
    max_depth: Option<u32>,
) -> Result<ScanResult, String> {
    let start = Instant::now();
    let root_path = std::path::Path::new(&path).to_path_buf();

    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let depth = max_depth.unwrap_or(u32::MAX);
    let cache_path = path.clone();
    let cache_depth = max_depth;
    SCAN_CANCELLED.store(false, Ordering::Relaxed);

    // Run the scan in a blocking thread so it doesn't starve the async runtime
    let task_result = tokio::task::spawn_blocking(move || -> Result<ScanResult, String> {
        // Apply macOS I/O throttling to this thread
        throttle_current_thread();

        if SCAN_CANCELLED.load(Ordering::Relaxed) {
            return Err("Scan cancelled".to_string());
        }

        let mut file_count: u64 = 0;
        let mut dir_count: u64 = 0;
        let mut categories: HashMap<String, u64> = HashMap::new();
        let scanned = AtomicU64::new(0);
        let ignored_paths = load_ignored_paths().unwrap_or_default();

        let root = scan_directory(
            &root_path,
            depth,
            &app,
            &mut file_count,
            &mut dir_count,
            &mut categories,
            &scanned,
            None,
            &ignored_paths,
        )?;

        let duration = start.elapsed().as_millis() as u64;
        let total_size = root.size;

        let result = ScanResult {
            root,
            total_size,
            file_count,
            dir_count,
            scan_duration_ms: duration,
            categories,
        };

        if let Err(e) = save_scan_cache(&cache_path, cache_depth, &result) {
            log::warn!("Failed to save scan cache: {}", e);
        }

        Ok(result)
    })
    .await;

    SCAN_CANCELLED.store(false, Ordering::Relaxed);
    task_result.map_err(|e| format!("Scan task failed: {}", e))?
}

#[tauri::command]
pub async fn cancel_scan() -> Result<(), String> {
    SCAN_CANCELLED.store(true, Ordering::Relaxed);
    Ok(())
}

/// Check if a directory name should be skipped
fn should_skip(name: &str) -> bool {
    SKIP_DIR_NAMES.iter().any(|s| name == *s)
}

fn should_skip_path(path: &std::path::Path, name: &str) -> bool {
    if should_skip(name) {
        return true;
    }

    let path_str = path.to_string_lossy();
    SKIP_PATH_FRAGMENTS
        .iter()
        .any(|fragment| path_str.contains(fragment))
}

fn aggregates_children(category: &FileCategory) -> bool {
    matches!(
        category,
        FileCategory::DevCache | FileCategory::Cache | FileCategory::Log | FileCategory::Trash
    )
}

#[derive(Default)]
struct DirectorySummary {
    size: u64,
    files: u64,
    dirs: u64,
}

fn summarize_directory_contents(
    path: &std::path::Path,
    app: &tauri::AppHandle,
    scanned: &AtomicU64,
    ignored_paths: &[crate::models::IgnoredPath],
) -> Result<DirectorySummary, String> {
    let mut summary = DirectorySummary::default();

    match std::fs::read_dir(path) {
        Ok(entries) => {
            for entry in entries.flatten() {
                if SCAN_CANCELLED.load(Ordering::Relaxed) {
                    return Err("Scan cancelled".to_string());
                }

                let entry_path = entry.path();
                let entry_name = entry.file_name().to_string_lossy().to_string();
                let count = scanned.fetch_add(1, Ordering::Relaxed) + 1;

                if count % THROTTLE_BATCH == 0 {
                    let _ = app.emit(
                        "scan://progress",
                        ScanProgress {
                            scanned: count,
                            current_path: entry_path.to_string_lossy().to_string(),
                            estimated_total: None,
                        },
                    );
                    std::thread::sleep(THROTTLE_SLEEP);
                }

                if should_skip_path(&entry_path, &entry_name)
                    || is_ignored_path(&entry_path, ignored_paths)
                {
                    continue;
                }

                let Ok(metadata) = std::fs::symlink_metadata(&entry_path) else {
                    continue;
                };
                let file_type = metadata.file_type();

                if file_type.is_symlink() {
                    summary.size += allocated_size(&metadata);
                } else if file_type.is_dir() {
                    summary.dirs += 1;
                    let child =
                        summarize_directory_contents(&entry_path, app, scanned, ignored_paths)?;
                    summary.size += child.size;
                    summary.files += child.files;
                    summary.dirs += child.dirs;
                } else {
                    summary.files += 1;
                    summary.size += allocated_size(&metadata);
                }
            }
        }
        Err(e) => {
            log::warn!(
                "Skipping inaccessible directory: {} ({})",
                path.display(),
                e
            );
        }
    }

    Ok(summary)
}

fn scan_directory(
    path: &std::path::Path,
    max_depth: u32,
    app: &tauri::AppHandle,
    file_count: &mut u64,
    dir_count: &mut u64,
    categories: &mut HashMap<String, u64>,
    scanned: &AtomicU64,
    inherited_category: Option<FileCategory>,
    ignored_paths: &[crate::models::IgnoredPath],
) -> Result<FileNode, String> {
    if SCAN_CANCELLED.load(Ordering::Relaxed) {
        return Err("Scan cancelled".to_string());
    }

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    let category = categorize_path(path, &name);
    let safety = assess_safety(path, &category);
    let active_category = inherited_category
        .clone()
        .or_else(|| aggregates_children(&category).then(|| category.clone()));

    let mut children = Vec::new();
    let mut total_size: u64 = 0;

    if max_depth > 0 && aggregates_children(&category) {
        let summary = summarize_directory_contents(path, app, scanned, ignored_paths)?;
        total_size = summary.size;
        *file_count += summary.files;
        *dir_count += summary.dirs;
        *categories.entry(category.to_string()).or_insert(0) += total_size;

        let metadata = std::fs::metadata(path).ok();
        let last_modified = metadata.as_ref().and_then(modified_secs);
        let last_accessed = metadata.as_ref().and_then(accessed_secs);

        return Ok(FileNode {
            name,
            path: path.to_string_lossy().to_string(),
            size: total_size,
            is_dir: true,
            file_type: category,
            children: Some(children),
            last_accessed,
            last_modified,
            safety_level: safety,
        });
    }

    if max_depth > 0 {
        match std::fs::read_dir(path) {
            Ok(entries) => {
                for entry in entries.flatten() {
                    if SCAN_CANCELLED.load(Ordering::Relaxed) {
                        return Err("Scan cancelled".to_string());
                    }

                    let entry_path = entry.path();
                    let entry_name = entry.file_name().to_string_lossy().to_string();

                    // Skip system directories that cause hangs or are useless
                    if should_skip_path(&entry_path, &entry_name) {
                        continue;
                    }
                    if is_ignored_path(&entry_path, ignored_paths) {
                        continue;
                    }

                    if let Ok(metadata) = std::fs::symlink_metadata(&entry_path) {
                        let file_type = metadata.file_type();

                        if file_type.is_symlink() {
                            let link_size = allocated_size(&metadata);
                            total_size += link_size;

                            let file_cat = categorize_path(&entry_path, &entry_name);
                            let bucket =
                                active_category.clone().unwrap_or_else(|| file_cat.clone());
                            *categories.entry(bucket.to_string()).or_insert(0) += link_size;

                            children.push(FileNode {
                                name: entry_name,
                                path: entry_path.to_string_lossy().to_string(),
                                size: link_size,
                                is_dir: false,
                                file_type: file_cat,
                                children: None,
                                last_accessed: accessed_secs(&metadata),
                                last_modified: modified_secs(&metadata),
                                safety_level: SafetyLevel::Review,
                            });
                        } else if file_type.is_dir() {
                            *dir_count += 1;
                            let child = scan_directory(
                                &entry_path,
                                max_depth - 1,
                                app,
                                file_count,
                                dir_count,
                                categories,
                                scanned,
                                active_category.clone(),
                                ignored_paths,
                            )?;
                            total_size += child.size;
                            children.push(child);
                        } else {
                            *file_count += 1;
                            let file_size = allocated_size(&metadata);
                            total_size += file_size;

                            let file_cat = categorize_path(&entry_path, &entry_name);
                            let file_safety = assess_safety(&entry_path, &file_cat);
                            let bucket =
                                active_category.clone().unwrap_or_else(|| file_cat.clone());

                            let cat_key = bucket.to_string();
                            *categories.entry(cat_key).or_insert(0) += file_size;

                            children.push(FileNode {
                                name: entry_name,
                                path: entry_path.to_string_lossy().to_string(),
                                size: file_size,
                                is_dir: false,
                                file_type: file_cat,
                                children: None,
                                last_accessed: accessed_secs(&metadata),
                                last_modified: modified_secs(&metadata),
                                safety_level: file_safety,
                            });
                        }
                    }

                    let count = scanned.fetch_add(1, Ordering::Relaxed) + 1;

                    // Emit progress + throttle every THROTTLE_BATCH files
                    if count % THROTTLE_BATCH == 0 {
                        let _ = app.emit(
                            "scan://progress",
                            ScanProgress {
                                scanned: count,
                                current_path: entry_path.to_string_lossy().to_string(),
                                estimated_total: None,
                            },
                        );

                        // Sleep to let macOS I/O scheduler serve other processes
                        std::thread::sleep(THROTTLE_SLEEP);
                    }
                }
            }
            Err(e) => {
                log::warn!(
                    "Skipping inaccessible directory: {} ({})",
                    path.display(),
                    e
                );
            }
        }
    }

    // Sort children by size descending
    children.sort_by(|a, b| b.size.cmp(&a.size));

    let metadata = std::fs::metadata(path).ok();
    let last_modified = metadata.as_ref().and_then(modified_secs);
    let last_accessed = metadata.as_ref().and_then(accessed_secs);

    Ok(FileNode {
        name,
        path: path.to_string_lossy().to_string(),
        size: total_size,
        is_dir: true,
        file_type: category,
        children: Some(children),
        last_accessed,
        last_modified,
        safety_level: safety,
    })
}

#[tauri::command]
pub async fn find_large_files(path: String, min_size_bytes: u64) -> Result<Vec<FileNode>, String> {
    let root_path = std::path::Path::new(&path).to_path_buf();
    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    // Run in blocking thread to prevent async runtime starvation
    let large_files = tokio::task::spawn_blocking(move || {
        throttle_current_thread();
        let mut results = Vec::new();
        let ignored_paths = load_ignored_paths().unwrap_or_default();

        for entry in jwalk::WalkDir::new(&root_path)
            .skip_hidden(false)
            .parallelism(jwalk::Parallelism::RayonNewPool(2)) // Limit to 2 threads
            .into_iter()
            .filter_map(|e| e.ok())
        {
            // Skip system directories
            if let Some(name) = entry.path().file_name() {
                if should_skip_path(&entry.path(), &name.to_string_lossy()) {
                    continue;
                }
            }
            if is_ignored_path(&entry.path(), &ignored_paths) {
                continue;
            }

            if entry.file_type().is_file() {
                if let Ok(metadata) = entry.metadata() {
                    let size = allocated_size(&metadata);
                    if size >= min_size_bytes {
                        let name = entry.file_name().to_string_lossy().to_string();
                        let entry_path = entry.path();
                        let category = categorize_path(&entry_path, &name);
                        let safety = assess_large_file_safety(&entry_path, &category);

                        results.push(FileNode {
                            name,
                            path: entry_path.to_string_lossy().to_string(),
                            size,
                            is_dir: false,
                            file_type: category,
                            children: None,
                            last_accessed: accessed_secs(&metadata),
                            last_modified: modified_secs(&metadata),
                            safety_level: safety,
                        });
                    }
                }
            }
        }

        results.sort_by(|a, b| b.size.cmp(&a.size));
        results
    })
    .await
    .map_err(|e| format!("Large files scan failed: {}", e))?;

    Ok(large_files)
}

#[tauri::command]
pub async fn open_in_finder(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .args(["-R", &path])
        .spawn()
        .map_err(|e| format!("Failed to open Finder: {}", e))?;
    Ok(())
}
