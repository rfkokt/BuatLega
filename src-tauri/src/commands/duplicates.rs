use crate::commands::persistence::{is_ignored_path, load_ignored_paths};
use crate::models::{DuplicateFile, DuplicateGroup, DuplicateScanProgress};
use crate::scanner::categorizer::categorize_path;
use crate::scanner::rules::assess_safety;
use crate::storage::{accessed_secs, allocated_size, modified_secs};
use std::collections::HashMap;
use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom};
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::Emitter;
use xxhash_rust::xxh3::Xxh3;

const MIN_DUPLICATE_SIZE: u64 = 1024 * 1024;
const SAMPLE_BYTES: usize = 64 * 1024;
const HASH_BUFFER_BYTES: usize = 1024 * 1024;
const PROGRESS_BATCH: u64 = 500;

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

#[derive(Debug, Clone)]
struct CandidateFile {
    name: String,
    path: PathBuf,
    logical_size: u64,
    allocated_size: u64,
    device: u64,
    inode: u64,
    last_accessed: Option<i64>,
    last_modified: Option<i64>,
}

fn throttle_current_thread() {
    extern "C" {
        fn setiopolicy_np(iotype: i32, scope: i32, policy: i32) -> i32;
    }
    unsafe {
        setiopolicy_np(0, 1, 3);
        libc::nice(10);
    }
}

fn should_skip_name(name: &str) -> bool {
    SKIP_DIR_NAMES.iter().any(|skip| name == *skip)
}

fn should_skip_path(path: &Path, name: &str) -> bool {
    if should_skip_name(name) {
        return true;
    }

    let path_str = path.to_string_lossy();
    SKIP_PATH_FRAGMENTS
        .iter()
        .any(|fragment| path_str.contains(fragment))
}

fn emit_progress(
    app: &tauri::AppHandle,
    scanned_files: u64,
    candidate_files: u64,
    current_path: &Path,
    phase: &str,
) {
    let _ = app.emit(
        "duplicates://progress",
        DuplicateScanProgress {
            scanned_files,
            candidate_files,
            current_path: current_path.to_string_lossy().to_string(),
            phase: phase.to_string(),
        },
    );
}

fn partial_hash(path: &Path, logical_size: u64) -> io::Result<u64> {
    let mut file = File::open(path)?;
    let mut hasher = Xxh3::new();
    hasher.update(&logical_size.to_le_bytes());

    let mut first = vec![0; SAMPLE_BYTES.min(logical_size as usize)];
    let first_read = file.read(&mut first)?;
    hasher.update(&first[..first_read]);

    if logical_size > SAMPLE_BYTES as u64 {
        let tail_size = SAMPLE_BYTES.min(logical_size as usize);
        file.seek(SeekFrom::End(-(tail_size as i64)))?;

        let mut tail = vec![0; tail_size];
        let tail_read = file.read(&mut tail)?;
        hasher.update(&tail[..tail_read]);
    }

    Ok(hasher.digest())
}

fn full_hash(path: &Path, logical_size: u64) -> io::Result<u64> {
    let mut file = File::open(path)?;
    let mut buffer = vec![0; HASH_BUFFER_BYTES];
    let mut hasher = Xxh3::new();
    hasher.update(&logical_size.to_le_bytes());

    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(hasher.digest())
}

fn wasted_bytes(files: &[CandidateFile]) -> u64 {
    let mut physical_copies: HashMap<(u64, u64), u64> = HashMap::new();
    for file in files {
        physical_copies
            .entry((file.device, file.inode))
            .or_insert(file.allocated_size);
    }

    if physical_copies.len() < 2 {
        return 0;
    }

    let total: u64 = physical_copies.values().sum();
    let keep_size = physical_copies.values().copied().max().unwrap_or_default();
    total.saturating_sub(keep_size)
}

fn to_duplicate_file(file: CandidateFile) -> DuplicateFile {
    let path = file.path.to_string_lossy().to_string();
    let category = categorize_path(&file.path, &file.name);
    let safety = assess_safety(&file.path, &category);

    DuplicateFile {
        name: file.name,
        path,
        size: file.logical_size,
        allocated_size: file.allocated_size,
        file_type: category,
        last_accessed: file.last_accessed,
        last_modified: file.last_modified,
        safety_level: safety,
    }
}

#[tauri::command]
pub async fn find_duplicates(
    app: tauri::AppHandle,
    path: String,
    min_size_bytes: Option<u64>,
) -> Result<Vec<DuplicateGroup>, String> {
    let root_path = Path::new(&path).to_path_buf();
    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let min_size = min_size_bytes
        .unwrap_or(10 * MIN_DUPLICATE_SIZE)
        .max(MIN_DUPLICATE_SIZE);

    let duplicate_groups = tokio::task::spawn_blocking(move || {
        throttle_current_thread();

        let ignored_paths = load_ignored_paths().unwrap_or_default();
        let mut scanned_files = 0_u64;
        let mut candidate_files = 0_u64;
        let mut by_size: HashMap<u64, Vec<CandidateFile>> = HashMap::new();

        for entry in jwalk::WalkDir::new(&root_path)
            .skip_hidden(false)
            .parallelism(jwalk::Parallelism::RayonNewPool(2))
            .into_iter()
            .filter_map(|entry| entry.ok())
        {
            let entry_path = entry.path();
            let entry_name = entry.file_name().to_string_lossy().to_string();

            if should_skip_path(&entry_path, &entry_name)
                || is_ignored_path(&entry_path, &ignored_paths)
            {
                continue;
            }

            let Ok(metadata) = std::fs::symlink_metadata(&entry_path) else {
                continue;
            };

            if metadata.file_type().is_symlink() || !metadata.file_type().is_file() {
                continue;
            }

            scanned_files += 1;
            let logical_size = metadata.len();
            if logical_size >= min_size {
                candidate_files += 1;
                by_size
                    .entry(logical_size)
                    .or_default()
                    .push(CandidateFile {
                        name: entry_name,
                        path: entry_path.clone(),
                        logical_size,
                        allocated_size: allocated_size(&metadata),
                        device: metadata.dev(),
                        inode: metadata.ino(),
                        last_accessed: accessed_secs(&metadata),
                        last_modified: modified_secs(&metadata),
                    });
            }

            if scanned_files % PROGRESS_BATCH == 0 {
                emit_progress(
                    &app,
                    scanned_files,
                    candidate_files,
                    &entry_path,
                    "indexing",
                );
                std::thread::sleep(Duration::from_millis(1));
            }
        }

        let candidate_groups: Vec<Vec<CandidateFile>> = by_size
            .into_values()
            .filter(|files| files.len() > 1)
            .collect();

        let mut by_partial_hash: HashMap<(u64, u64), Vec<CandidateFile>> = HashMap::new();
        for files in candidate_groups {
            for file in files {
                match partial_hash(&file.path, file.logical_size) {
                    Ok(hash) => {
                        by_partial_hash
                            .entry((file.logical_size, hash))
                            .or_default()
                            .push(file);
                    }
                    Err(e) => {
                        log::warn!("Failed to partial-hash {}: {}", file.path.display(), e);
                    }
                }
            }
        }

        let mut by_full_hash: HashMap<(u64, u64), Vec<CandidateFile>> = HashMap::new();
        let mut hashed_files = 0_u64;

        for files in by_partial_hash
            .into_values()
            .filter(|files| files.len() > 1)
        {
            for file in files {
                hashed_files += 1;
                if hashed_files % PROGRESS_BATCH == 0 {
                    emit_progress(&app, scanned_files, candidate_files, &file.path, "hashing");
                }

                match full_hash(&file.path, file.logical_size) {
                    Ok(hash) => {
                        by_full_hash
                            .entry((file.logical_size, hash))
                            .or_default()
                            .push(file);
                    }
                    Err(e) => {
                        log::warn!("Failed to hash {}: {}", file.path.display(), e);
                    }
                }
            }
        }

        let mut groups = Vec::new();
        for ((logical_size, hash), mut files) in by_full_hash {
            if files.len() < 2 {
                continue;
            }

            let waste = wasted_bytes(&files);
            if waste == 0 {
                continue;
            }

            files.sort_by(|a, b| {
                b.last_modified
                    .cmp(&a.last_modified)
                    .then_with(|| a.path.cmp(&b.path))
            });

            groups.push(DuplicateGroup {
                id: format!("{hash:016x}-{logical_size}"),
                content_size: logical_size,
                wasted_bytes: waste,
                files: files.into_iter().map(to_duplicate_file).collect(),
            });
        }

        groups.sort_by(|a, b| b.wasted_bytes.cmp(&a.wasted_bytes));
        emit_progress(&app, scanned_files, candidate_files, &root_path, "done");

        groups
    })
    .await
    .map_err(|e| format!("Duplicate scan failed: {}", e))?;

    Ok(duplicate_groups)
}
