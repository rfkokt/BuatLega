use crate::models::FileCategory;
use std::path::Path;

/// Categorize a file or directory based on its name and extension.
pub fn categorize_path(path: &Path, name: &str) -> FileCategory {
    // By directory name (developer junk)
    match name {
        "node_modules" | "DerivedData" | ".gradle" | "__pycache__" | "target" | "dist"
        | "build" | ".next" | ".nuxt" | ".turbo" | ".dart_tool" | ".npm" | ".pnpm-store" => {
            return FileCategory::DevCache;
        }
        "Caches" | "Cache" | "Code Cache" | "GPUCache" | "CachedData" | "CachedExtensions"
        | ".cache" => return FileCategory::Cache,
        "Logs" | "logs" => return FileCategory::Log,
        ".Trash" => return FileCategory::Trash,
        _ => {}
    }

    // By extension
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        match ext.to_lowercase().as_str() {
            // Media
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg" | "ico" | "mp4" | "mov"
            | "avi" | "mkv" | "wmv" | "flv" | "webm" | "mp3" | "wav" | "aac" | "flac" | "ogg"
            | "m4a" | "psd" | "ai" | "sketch" | "fig" | "xd" => FileCategory::Media,

            // Documents
            "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "rtf" | "csv"
            | "odt" | "ods" | "pages" | "numbers" | "keynote" | "epub" | "md" => {
                FileCategory::Document
            }

            // Code
            "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "swift" | "go" | "java" | "kt" | "c"
            | "cpp" | "h" | "hpp" | "cs" | "rb" | "php" | "dart" | "lua" | "r" | "scala" | "ex"
            | "exs" | "vue" | "svelte" | "html" | "css" | "scss" | "sass" | "json" | "yaml"
            | "yml" | "toml" | "xml" => FileCategory::Code,

            // Archives
            "zip" | "tar" | "gz" | "bz2" | "xz" | "7z" | "rar" | "dmg" | "iso" | "pkg" | "deb"
            | "rpm" => FileCategory::Archive,

            // Logs
            "log" => FileCategory::Log,

            // Applications
            "app" => FileCategory::Application,

            _ => FileCategory::Other,
        }
    } else {
        FileCategory::Other
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_categorize_node_modules() {
        let path = Path::new("/projects/my-app/node_modules");
        assert!(matches!(
            categorize_path(path, "node_modules"),
            FileCategory::DevCache
        ));
    }

    #[test]
    fn test_categorize_media() {
        let path = Path::new("/photos/vacation.jpg");
        assert!(matches!(
            categorize_path(path, "vacation.jpg"),
            FileCategory::Media
        ));
    }

    #[test]
    fn test_categorize_code() {
        let path = Path::new("/project/main.rs");
        assert!(matches!(
            categorize_path(path, "main.rs"),
            FileCategory::Code
        ));
    }

    #[test]
    fn test_categorize_archive() {
        let path = Path::new("/downloads/app.dmg");
        assert!(matches!(
            categorize_path(path, "app.dmg"),
            FileCategory::Archive
        ));
    }
}
