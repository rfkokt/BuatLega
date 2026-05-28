use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::file_node::FileNode;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub root: FileNode,
    pub total_size: u64,
    pub file_count: u64,
    pub dir_count: u64,
    pub scan_duration_ms: u64,
    pub categories: HashMap<String, u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub scanned: u64,
    pub current_path: String,
    pub estimated_total: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub total_capacity: u64,
    pub available_space: u64,
    pub used_space: u64,
    pub purgeable_space: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupResult {
    /// Bytes immediately freed from disk. Moving to Trash does not usually free
    /// space until the user empties Trash.
    pub freed_bytes: u64,
    /// Bytes that were selected and successfully cleaned.
    pub reclaimable_bytes: u64,
    /// Bytes moved to Trash and recoverable by the user.
    pub trashed_bytes: u64,
    /// Bytes permanently removed.
    pub permanently_deleted_bytes: u64,
    pub items_deleted: u64,
    pub failed_items: Vec<CleanupError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupError {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupPreviewItem {
    pub path: String,
    pub size: u64,
    pub status: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupPreview {
    pub items: Vec<CleanupPreviewItem>,
    pub cleanable_count: u64,
    pub skipped_count: u64,
    pub total_reclaimable_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgnoredPath {
    pub path: String,
    pub reason: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupHistoryEntry {
    pub created_at: i64,
    pub freed_bytes: u64,
    pub reclaimable_bytes: u64,
    pub trashed_bytes: u64,
    pub permanently_deleted_bytes: u64,
    pub items_count: u64,
    pub failed_count: u64,
    pub permanent: bool,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateFile {
    pub name: String,
    pub path: String,
    /// Logical content size. Duplicate detection compares this value and the
    /// file content hash.
    pub size: u64,
    /// Approximate bytes occupied on disk.
    pub allocated_size: u64,
    pub file_type: super::file_node::FileCategory,
    pub last_accessed: Option<i64>,
    pub last_modified: Option<i64>,
    pub safety_level: super::file_node::SafetyLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub id: String,
    pub content_size: u64,
    pub wasted_bytes: u64,
    pub files: Vec<DuplicateFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateScanProgress {
    pub scanned_files: u64,
    pub candidate_files: u64,
    pub current_path: String,
    pub phase: String,
}
