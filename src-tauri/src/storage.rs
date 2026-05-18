use std::fs::Metadata;
use std::time::UNIX_EPOCH;

#[cfg(unix)]
use std::os::unix::fs::MetadataExt;

/// Return the bytes allocated on disk when the platform exposes it.
/// APFS clones and sparse files can make logical length misleading for cleanup.
pub fn allocated_size(metadata: &Metadata) -> u64 {
    #[cfg(unix)]
    {
        let blocks = metadata.blocks();
        if blocks > 0 {
            return blocks.saturating_mul(512);
        }
    }

    metadata.len()
}

pub fn modified_secs(metadata: &Metadata) -> Option<i64> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs() as i64)
}

pub fn accessed_secs(metadata: &Metadata) -> Option<i64> {
    metadata
        .accessed()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs() as i64)
}
