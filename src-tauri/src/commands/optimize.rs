use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizeAction {
    pub id: String,
    pub label: String,
    pub description: String,
    pub requires_confirmation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizeActionResult {
    pub id: String,
    pub label: String,
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub fn list_optimize_actions() -> Vec<OptimizeAction> {
    vec![
        OptimizeAction {
            id: "quicklook".to_string(),
            label: "Reset Quick Look Cache".to_string(),
            description: "Refreshes Finder preview thumbnails and Quick Look generators.".to_string(),
            requires_confirmation: false,
        },
        OptimizeAction {
            id: "launchservices".to_string(),
            label: "Rebuild Launch Services".to_string(),
            description: "Refreshes app-to-file associations and stale Open With entries.".to_string(),
            requires_confirmation: true,
        },
        OptimizeAction {
            id: "dns".to_string(),
            label: "Flush DNS Cache".to_string(),
            description: "Clears local DNS resolver cache. Some macOS versions may deny mDNSResponder reload without elevated privileges.".to_string(),
            requires_confirmation: false,
        },
        OptimizeAction {
            id: "finder".to_string(),
            label: "Restart Finder".to_string(),
            description: "Restarts Finder to refresh desktop, sidebar, and file browser state.".to_string(),
            requires_confirmation: true,
        },
        OptimizeAction {
            id: "dock".to_string(),
            label: "Restart Dock".to_string(),
            description: "Restarts Dock, Mission Control, and related UI surfaces.".to_string(),
            requires_confirmation: true,
        },
        OptimizeAction {
            id: "systemui".to_string(),
            label: "Restart System UI Server".to_string(),
            description: "Refreshes menu bar extras and system UI widgets.".to_string(),
            requires_confirmation: true,
        },
    ]
}

#[tauri::command]
pub async fn run_optimize_actions(
    action_ids: Vec<String>,
) -> Result<Vec<OptimizeActionResult>, String> {
    tokio::task::spawn_blocking(move || {
        action_ids
            .into_iter()
            .map(|id| run_action(&id))
            .collect::<Vec<_>>()
    })
    .await
    .map_err(|e| format!("Optimize task failed: {}", e))
}

fn run_action(id: &str) -> OptimizeActionResult {
    match id {
        "quicklook" => run_command_result(
            id,
            "Reset Quick Look Cache",
            "qlmanage",
            &["-r", "cache"],
        ),
        "launchservices" => run_command_result(
            id,
            "Rebuild Launch Services",
            "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister",
            &["-kill", "-r", "-domain", "local", "-domain", "system", "-domain", "user"],
        ),
        "dns" => run_dns_flush(),
        "finder" => run_command_result(id, "Restart Finder", "killall", &["Finder"]),
        "dock" => run_command_result(id, "Restart Dock", "killall", &["Dock"]),
        "systemui" => run_command_result(id, "Restart System UI Server", "killall", &["SystemUIServer"]),
        _ => OptimizeActionResult {
            id: id.to_string(),
            label: id.to_string(),
            success: false,
            message: "Unknown optimization action".to_string(),
        },
    }
}

fn run_dns_flush() -> OptimizeActionResult {
    let first = Command::new("dscacheutil").arg("-flushcache").output();
    let second = Command::new("killall")
        .args(["-HUP", "mDNSResponder"])
        .output();

    match (first, second) {
        (Ok(a), Ok(b)) if a.status.success() && b.status.success() => OptimizeActionResult {
            id: "dns".to_string(),
            label: "Flush DNS Cache".to_string(),
            success: true,
            message: "DNS cache flushed".to_string(),
        },
        (Ok(a), Ok(b)) if a.status.success() => {
            let responder_message = String::from_utf8_lossy(&b.stderr).trim().to_string();
            OptimizeActionResult {
                id: "dns".to_string(),
                label: "Flush DNS Cache".to_string(),
                success: true,
                message: if responder_message.is_empty() {
                    "Local DNS cache flushed. mDNSResponder reload was skipped.".to_string()
                } else {
                    format!(
                        "Local DNS cache flushed. mDNSResponder reload skipped: {}",
                        responder_message
                    )
                },
            }
        }
        (Ok(a), Ok(b)) => {
            let stderr = format_stderr(&[a.stderr, b.stderr]);
            OptimizeActionResult {
                id: "dns".to_string(),
                label: "Flush DNS Cache".to_string(),
                success: false,
                message: stderr
                    .unwrap_or_else(|| "DNS flush command returned a non-zero status".to_string()),
            }
        }
        (Err(e), _) | (_, Err(e)) => OptimizeActionResult {
            id: "dns".to_string(),
            label: "Flush DNS Cache".to_string(),
            success: false,
            message: e.to_string(),
        },
    }
}

fn run_command_result(id: &str, label: &str, program: &str, args: &[&str]) -> OptimizeActionResult {
    match Command::new(program).args(args).output() {
        Ok(output) if output.status.success() => OptimizeActionResult {
            id: id.to_string(),
            label: label.to_string(),
            success: true,
            message: "Completed".to_string(),
        },
        Ok(output) => OptimizeActionResult {
            id: id.to_string(),
            label: label.to_string(),
            success: false,
            message: format_stderr(&[output.stderr])
                .unwrap_or_else(|| format!("Command exited with {}", output.status)),
        },
        Err(e) => OptimizeActionResult {
            id: id.to_string(),
            label: label.to_string(),
            success: false,
            message: e.to_string(),
        },
    }
}

fn format_stderr(chunks: &[Vec<u8>]) -> Option<String> {
    let message = chunks
        .iter()
        .map(|chunk| String::from_utf8_lossy(chunk))
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();

    if message.is_empty() {
        None
    } else {
        Some(message)
    }
}
