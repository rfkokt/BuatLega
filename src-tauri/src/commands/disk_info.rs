use crate::models::DiskInfo;

#[tauri::command]
pub async fn get_disk_info() -> Result<DiskInfo, String> {
    // Use `diskutil info /` for accurate APFS container-level disk info.
    // `df` on APFS reports per-volume/snapshot usage which is misleading.
    let output = std::process::Command::new("diskutil")
        .args(["info", "/"])
        .output()
        .map_err(|e| format!("Failed to run diskutil: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    let mut total: Option<u64> = None;
    let mut free: Option<u64> = None;

    for line in stdout.lines() {
        let trimmed = line.trim();

        // "Container Total Space:  245.1 GB (245107195904 Bytes) ..."
        if trimmed.starts_with("Container Total Space:") || trimmed.starts_with("Disk Size:") {
            total = total.or_else(|| parse_bytes_from_diskutil(trimmed));
        }

        // "Container Free Space:   29.1 GB (29122838528 Bytes) ..."
        if trimmed.starts_with("Container Free Space:") {
            free = parse_bytes_from_diskutil(trimmed);
        }
    }

    // If no container info (non-APFS), fall back to Disk Size + Volume Free
    if free.is_none() {
        for line in stdout.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("Volume Free Space:")
                || trimmed.starts_with("Volume Available Space:")
            {
                free = parse_bytes_from_diskutil(trimmed);
                break;
            }
        }
    }

    let total = total.ok_or("Could not determine total disk capacity")?;
    let free = free.ok_or("Could not determine free space")?;
    let used = total.saturating_sub(free);

    Ok(DiskInfo {
        total_capacity: total,
        available_space: free,
        used_space: used,
        purgeable_space: None,
    })
}

/// Parse byte count from diskutil output line.
/// Format: "Container Total Space:  245.1 GB (245107195904 Bytes) (exactly ...)"
fn parse_bytes_from_diskutil(line: &str) -> Option<u64> {
    let open = line.find('(')?;
    let bytes_end = line[open..].find(" Bytes")?;
    let bytes_str = &line[open + 1..open + bytes_end];
    bytes_str.trim().parse::<u64>().ok()
}

#[tauri::command]
pub async fn check_fda_status() -> Result<bool, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(true);
    };

    // Full Disk Access is best detected by probing multiple TCC-protected
    // locations. A single folder can be absent or have app-specific ACLs, which
    // makes checks like ~/Library/Mail prone to false negatives.
    let protected_paths = [
        "Library/Mail",
        "Library/Messages",
        "Library/Safari",
        "Library/Calendars",
        "Library/Application Support/AddressBook",
    ];

    let mut saw_permission_denied = false;

    for relative_path in protected_paths {
        let test_path = home.join(relative_path);

        match std::fs::read_dir(&test_path) {
            Ok(_) => return Ok(true),
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                saw_permission_denied = true;
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => {
                log::debug!(
                    "Full Disk Access probe skipped {}: {}",
                    test_path.display(),
                    e
                );
            }
        }
    }

    Ok(!saw_permission_denied)
}

#[tauri::command]
pub async fn open_system_preferences() -> Result<(), String> {
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
        .spawn()
        .map_err(|e| format!("Failed to open System Settings: {}", e))?;
    Ok(())
}

/// Restart the app by spawning a new instance and exiting the current one.
/// macOS caches TCC permissions per-process, so a full restart is needed
/// after the user toggles Full Disk Access in System Settings.
#[tauri::command]
pub async fn restart_app(app: tauri::AppHandle) -> Result<(), String> {
    let current_exe =
        std::env::current_exe().map_err(|e| format!("Failed to get current executable: {}", e))?;

    // On macOS, the binary is inside Foo.app/Contents/MacOS/foo.
    // We need to find the .app bundle and use `open` to relaunch it properly.
    let exe_path = current_exe.to_string_lossy().to_string();
    if let Some(app_bundle_end) = exe_path.find(".app/") {
        let app_bundle = &exe_path[..app_bundle_end + 4]; // include ".app"
        std::process::Command::new("open")
            .args(["-n", "-a", app_bundle])
            .spawn()
            .map_err(|e| format!("Failed to restart: {}", e))?;
    } else {
        // Fallback: spawn the binary directly (dev mode)
        std::process::Command::new(&current_exe)
            .spawn()
            .map_err(|e| format!("Failed to restart: {}", e))?;
    }

    // Exit current instance
    app.exit(0);
    Ok(())
}
