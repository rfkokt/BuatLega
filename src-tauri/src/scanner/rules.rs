use crate::models::{FileCategory, SafetyLevel};
use std::path::Path;

fn path_text(path: &Path) -> String {
    path.to_string_lossy().to_lowercase()
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default()
        .to_lowercase()
}

fn is_caution_path(path_str: &str) -> bool {
    path_str.contains("/system/")
        || path_str.contains("/.ssh/")
        || path_str.contains("/.gnupg/")
        || path_str.starts_with("/usr/")
        || path_str.starts_with("/bin/")
        || path_str.starts_with("/sbin/")
        || path_str.contains("/library/preferences/")
        || path_str.ends_with("/.git")
        || path_str.contains("/.git/")
}

fn is_known_app_cache_path(path_str: &str) -> bool {
    const APP_CACHE_PATHS: &[&str] = &[
        "/library/application support/code/cache/",
        "/library/application support/code/cacheddata/",
        "/library/application support/code/cachedextensions/",
        "/library/application support/code/code cache/",
        "/library/application support/code/gpucache/",
        "/library/application support/code/logs/",
        "/library/application support/cursor/cache/",
        "/library/application support/cursor/cacheddata/",
        "/library/application support/cursor/cachedextensions/",
        "/library/application support/cursor/code cache/",
        "/library/application support/cursor/gpucache/",
        "/library/application support/cursor/logs/",
        "/library/application support/slack/cache/",
        "/library/application support/slack/code cache/",
        "/library/application support/slack/gpucache/",
        "/library/application support/discord/cache/",
        "/library/application support/discord/code cache/",
        "/library/application support/discord/gpucache/",
        "/library/application support/codex/cache/",
        "/library/application support/codex/code cache/",
        "/library/application support/codex/gpucache/",
    ];

    APP_CACHE_PATHS
        .iter()
        .any(|fragment| path_str.contains(fragment))
}

fn is_known_package_cache_path(path_str: &str) -> bool {
    const PACKAGE_CACHE_PATHS: &[&str] = &[
        "/.npm/",
        "/.yarn/cache/",
        "/library/caches/yarn/",
        "/library/pnpm/store/",
        "/.local/share/pnpm/store/",
        "/.bun/install/cache/",
        "/.cache/node/corepack/",
        "/.cache/uv/",
        "/.cache/pip/",
        "/library/caches/pip/",
        "/go/pkg/mod/cache/",
        "/.cargo/registry/cache/",
        "/.cargo/git/checkouts/",
        "/.cargo/git/db/",
        "/.gradle/caches/",
        "/.gradle/wrapper/dists/",
    ];

    PACKAGE_CACHE_PATHS
        .iter()
        .any(|fragment| path_str.contains(fragment))
}

fn is_known_reclaimable_cache_path(path_str: &str) -> bool {
    path_str.contains("/library/caches/")
        || path_str.contains("/library/logs/")
        || path_str.contains("/library/developer/xcode/deriveddata/")
        || is_known_app_cache_path(path_str)
        || is_known_package_cache_path(path_str)
}

/// Assess how safe it is to delete a file or directory.
pub fn assess_safety(path: &Path, category: &FileCategory) -> SafetyLevel {
    let path_str = path_text(path);
    let name = file_name(path);

    // 🔴 CAUTION — never delete these
    if is_caution_path(&path_str) {
        return SafetyLevel::Caution;
    }

    // 🟢 SAFE — can always regenerate
    match category {
        FileCategory::DevCache => return SafetyLevel::Safe,
        FileCategory::Cache => return SafetyLevel::Safe,
        FileCategory::Log => return SafetyLevel::Safe,
        FileCategory::Trash => return SafetyLevel::Safe,
        _ => {}
    }

    // Specific safe paths
    if is_known_reclaimable_cache_path(&path_str) {
        return SafetyLevel::Safe;
    }

    if matches!(
        name.as_str(),
        "cache" | "code cache" | "gpucache" | "cacheddata" | "cachedextensions" | ".cache"
    ) {
        return SafetyLevel::Safe;
    }

    // 🟡 REVIEW — check before deleting
    // Archives in Downloads
    if path_str.contains("/downloads/") {
        match category {
            FileCategory::Archive => return SafetyLevel::Review,
            _ => {}
        }
    }

    // Large files get review
    if let Ok(metadata) = std::fs::metadata(path) {
        let size = metadata.len();
        // Files > 500MB that haven't been modified in 6 months
        if size > 500_000_000 {
            if let Ok(modified) = metadata.modified() {
                if let Ok(duration) = modified.elapsed() {
                    let six_months = std::time::Duration::from_secs(180 * 24 * 3600);
                    if duration > six_months {
                        return SafetyLevel::Review;
                    }
                }
            }
        }
    }

    // Default: review for safety
    SafetyLevel::Review
}

/// Large file results need a stricter "Safe" threshold because they are
/// selected as individual files, often outside the directory context.
pub fn assess_large_file_safety(path: &Path, category: &FileCategory) -> SafetyLevel {
    let path_str = path_text(path);

    if is_caution_path(&path_str) {
        return SafetyLevel::Caution;
    }

    if matches!(category, FileCategory::Trash) || is_known_reclaimable_cache_path(&path_str) {
        return SafetyLevel::Safe;
    }

    SafetyLevel::Review
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_files_caution() {
        let path = Path::new("/System/Library/something");
        assert!(matches!(
            assess_safety(path, &FileCategory::System),
            SafetyLevel::Caution
        ));
    }

    #[test]
    fn test_ssh_keys_caution() {
        let path = Path::new("/Users/test/.ssh/id_rsa");
        assert!(matches!(
            assess_safety(path, &FileCategory::Other),
            SafetyLevel::Caution
        ));
    }

    #[test]
    fn test_cache_safe() {
        let path = Path::new("/Users/test/Library/Caches/something");
        assert!(matches!(
            assess_safety(path, &FileCategory::Cache),
            SafetyLevel::Safe
        ));
    }

    #[test]
    fn test_node_modules_safe() {
        let path = Path::new("/projects/app/node_modules");
        assert!(matches!(
            assess_safety(path, &FileCategory::DevCache),
            SafetyLevel::Safe
        ));
    }

    #[test]
    fn test_app_support_cache_safe() {
        let path = Path::new("/Users/test/Library/Application Support/Code/CachedData");
        assert!(matches!(
            assess_safety(path, &FileCategory::Cache),
            SafetyLevel::Safe
        ));
    }

    #[test]
    fn test_user_cache_dir_safe() {
        let path = Path::new("/Users/test/.cache/pip");
        assert!(matches!(
            assess_safety(path, &FileCategory::Other),
            SafetyLevel::Safe
        ));
    }

    #[test]
    fn test_large_file_library_cache_safe() {
        let path = Path::new("/Users/test/Library/Caches/com.example/blob.bin");
        assert!(matches!(
            assess_large_file_safety(path, &FileCategory::Other),
            SafetyLevel::Safe
        ));
    }

    #[test]
    fn test_large_file_npm_cache_safe() {
        let path = Path::new("/Users/test/.npm/_cacache/content-v2/sha512/blob");
        assert!(matches!(
            assess_large_file_safety(path, &FileCategory::Other),
            SafetyLevel::Safe
        ));
    }

    #[test]
    fn test_large_file_node_modules_review() {
        let path = Path::new("/Users/test/project/node_modules/pkg/large.dat");
        assert!(matches!(
            assess_large_file_safety(path, &FileCategory::Other),
            SafetyLevel::Review
        ));
    }

    #[test]
    fn test_large_file_generic_dot_cache_review() {
        let path = Path::new("/Users/test/.cache/custom-tool/model.bin");
        assert!(matches!(
            assess_large_file_safety(path, &FileCategory::Other),
            SafetyLevel::Review
        ));
    }

    #[test]
    fn test_large_file_generic_cache_name_review() {
        let path = Path::new("/Users/test/Documents/Cache/archive.bin");
        assert!(matches!(
            assess_large_file_safety(path, &FileCategory::Cache),
            SafetyLevel::Review
        ));
    }
}
