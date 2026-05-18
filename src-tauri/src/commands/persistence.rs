use crate::models::{CleanupHistoryEntry, IgnoredPath, ScanResult};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use xxhash_rust::xxh3::xxh3_64;

const APP_DIR_NAME: &str = "com.buatlega.app";
const IGNORED_PATHS_FILE: &str = "ignored_paths.json";
const CLEANUP_HISTORY_FILE: &str = "cleanup_history.json";
const SCAN_CACHE_FILE: &str = "scan_cache.json";
const HISTORY_LIMIT: usize = 100;
const SCAN_CACHE_LIMIT: usize = 5;
const SCAN_CACHE_TTL_SECS: i64 = 24 * 60 * 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ScanCacheEntry {
    key: String,
    path: String,
    max_depth: Option<u32>,
    ignored_signature: String,
    created_at: i64,
    result: ScanResult,
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

fn app_data_dir() -> Result<PathBuf, String> {
    let base = dirs::data_dir()
        .or_else(dirs::home_dir)
        .ok_or("Could not determine app data directory")?;
    let dir = base.join(APP_DIR_NAME);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    Ok(dir)
}

fn data_file(name: &str) -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join(name))
}

fn read_json<T>(name: &str) -> Result<T, String>
where
    T: DeserializeOwned + Default,
{
    let path = data_file(name)?;
    if !path.exists() {
        return Ok(T::default());
    }

    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    serde_json::from_str(&text).map_err(|e| format!("Failed to parse {}: {}", path.display(), e))
}

fn write_json<T>(name: &str, value: &T) -> Result<(), String>
where
    T: Serialize,
{
    let path = data_file(name)?;
    let text = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed to serialize {}: {}", path.display(), e))?;
    std::fs::write(&path, text).map_err(|e| format!("Failed to write {}: {}", path.display(), e))
}

fn normalize_path(path: &str) -> String {
    let input = Path::new(path);
    input
        .canonicalize()
        .unwrap_or_else(|_| input.to_path_buf())
        .to_string_lossy()
        .to_string()
}

pub fn load_ignored_paths() -> Result<Vec<IgnoredPath>, String> {
    read_json(IGNORED_PATHS_FILE)
}

pub fn is_ignored_path(path: &Path, ignored: &[IgnoredPath]) -> bool {
    let path_str = path.to_string_lossy();
    ignored.iter().any(|ignored| {
        path_str == ignored.path || path_str.starts_with(&format!("{}/", ignored.path))
    })
}

pub fn record_cleanup_history(entry: CleanupHistoryEntry) -> Result<(), String> {
    let mut history: Vec<CleanupHistoryEntry> = read_json(CLEANUP_HISTORY_FILE)?;
    history.insert(0, entry);
    history.truncate(HISTORY_LIMIT);
    write_json(CLEANUP_HISTORY_FILE, &history)
}

fn ignored_signature(ignored: &[IgnoredPath]) -> String {
    let mut paths: Vec<&str> = ignored.iter().map(|entry| entry.path.as_str()).collect();
    paths.sort_unstable();
    format!("{:016x}", xxh3_64(paths.join("\n").as_bytes()))
}

fn scan_cache_key(path: &str, max_depth: Option<u32>, ignored_signature: &str) -> String {
    let input = format!("{}|{:?}|{}", path, max_depth, ignored_signature);
    format!("{:016x}", xxh3_64(input.as_bytes()))
}

pub fn load_cached_scan(path: &str, max_depth: Option<u32>) -> Result<Option<ScanResult>, String> {
    let normalized = normalize_path(path);
    let ignored = load_ignored_paths()?;
    let ignored_signature = ignored_signature(&ignored);
    let key = scan_cache_key(&normalized, max_depth, &ignored_signature);
    let now = now_secs();
    let entries: Vec<ScanCacheEntry> = read_json(SCAN_CACHE_FILE)?;

    Ok(entries.into_iter().find_map(|entry| {
        let is_match = entry.key == key
            && entry.path == normalized
            && entry.max_depth == max_depth
            && entry.ignored_signature == ignored_signature;
        let is_fresh = now.saturating_sub(entry.created_at) <= SCAN_CACHE_TTL_SECS;

        if is_match && is_fresh {
            Some(entry.result)
        } else {
            None
        }
    }))
}

pub fn save_scan_cache(
    path: &str,
    max_depth: Option<u32>,
    result: &ScanResult,
) -> Result<(), String> {
    let normalized = normalize_path(path);
    let ignored = load_ignored_paths()?;
    let ignored_signature = ignored_signature(&ignored);
    let key = scan_cache_key(&normalized, max_depth, &ignored_signature);
    let now = now_secs();
    let mut entries: Vec<ScanCacheEntry> = read_json(SCAN_CACHE_FILE)?;

    entries.retain(|entry| {
        entry.key != key && now.saturating_sub(entry.created_at) <= SCAN_CACHE_TTL_SECS
    });
    entries.insert(
        0,
        ScanCacheEntry {
            key,
            path: normalized,
            max_depth,
            ignored_signature,
            created_at: now,
            result: result.clone(),
        },
    );
    entries.truncate(SCAN_CACHE_LIMIT);
    write_json(SCAN_CACHE_FILE, &entries)
}

pub fn clear_scan_cache_entries() -> Result<(), String> {
    write_json(SCAN_CACHE_FILE, &Vec::<ScanCacheEntry>::new())
}

#[tauri::command]
pub async fn list_ignored_paths() -> Result<Vec<IgnoredPath>, String> {
    tokio::task::spawn_blocking(load_ignored_paths)
        .await
        .map_err(|e| format!("Ignored paths task failed: {}", e))?
}

#[tauri::command]
pub async fn add_ignored_path(
    path: String,
    reason: Option<String>,
) -> Result<Vec<IgnoredPath>, String> {
    tokio::task::spawn_blocking(move || {
        let normalized = normalize_path(&path);
        let mut ignored: Vec<IgnoredPath> = read_json(IGNORED_PATHS_FILE)?;

        if let Some(existing) = ignored.iter_mut().find(|entry| entry.path == normalized) {
            existing.reason = reason;
        } else {
            ignored.push(IgnoredPath {
                path: normalized,
                reason,
                created_at: now_secs(),
            });
        }

        ignored.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        write_json(IGNORED_PATHS_FILE, &ignored)?;
        Ok(ignored)
    })
    .await
    .map_err(|e| format!("Add ignored path task failed: {}", e))?
}

#[tauri::command]
pub async fn remove_ignored_path(path: String) -> Result<Vec<IgnoredPath>, String> {
    tokio::task::spawn_blocking(move || {
        let normalized = normalize_path(&path);
        let mut ignored: Vec<IgnoredPath> = read_json(IGNORED_PATHS_FILE)?;
        ignored.retain(|entry| entry.path != normalized);
        write_json(IGNORED_PATHS_FILE, &ignored)?;
        Ok(ignored)
    })
    .await
    .map_err(|e| format!("Remove ignored path task failed: {}", e))?
}

#[tauri::command]
pub async fn list_cleanup_history() -> Result<Vec<CleanupHistoryEntry>, String> {
    tokio::task::spawn_blocking(|| read_json(CLEANUP_HISTORY_FILE))
        .await
        .map_err(|e| format!("Cleanup history task failed: {}", e))?
}

#[tauri::command]
pub async fn clear_cleanup_history() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        write_json(CLEANUP_HISTORY_FILE, &Vec::<CleanupHistoryEntry>::new())
    })
    .await
    .map_err(|e| format!("Clear cleanup history task failed: {}", e))?
}

#[tauri::command]
pub async fn get_cached_scan(
    path: String,
    max_depth: Option<u32>,
) -> Result<Option<ScanResult>, String> {
    tokio::task::spawn_blocking(move || load_cached_scan(&path, max_depth))
        .await
        .map_err(|e| format!("Load cached scan task failed: {}", e))?
}

#[tauri::command]
pub async fn clear_scan_cache() -> Result<(), String> {
    tokio::task::spawn_blocking(clear_scan_cache_entries)
        .await
        .map_err(|e| format!("Clear scan cache task failed: {}", e))?
}
