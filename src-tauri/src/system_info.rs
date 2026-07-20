use serde::{Deserialize, Serialize};
use std::process::Command;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};
use std::sync::Mutex;
use tauri::State;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemStats {
    pub memory_used_percent: u8,
    pub cpu_load_percent: u8,
    pub disk_available_gb: f64,
    pub battery_percent: u8,
    pub battery_charging: bool,
    pub is_connected: bool,
    pub hostname: String,
}

pub struct SysInfoState {
    pub sys: Mutex<System>,
}

impl Default for SysInfoState {
    fn default() -> Self {
        Self {
            sys: Mutex::new(System::new_with_specifics(
                RefreshKind::new()
                    .with_cpu(CpuRefreshKind::everything())
                    .with_memory(MemoryRefreshKind::everything()),
            )),
        }
    }
}

#[tauri::command]
pub fn get_system_stats(state: State<'_, SysInfoState>) -> SystemStats {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    // Calculate memory
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();
    let memory_used_percent = if total_memory > 0 {
        ((used_memory as f64 / total_memory as f64) * 100.0) as u8
    } else {
        0
    };

    // Calculate CPU
    let cpus = sys.cpus();
    let cpu_load_percent = if !cpus.is_empty() {
        let sum: f32 = cpus.iter().map(|cpu| cpu.cpu_usage()).sum();
        (sum / cpus.len() as f32) as u8
    } else {
        0
    };

    // Calculate Disk Space
    let disks = Disks::new_with_refreshed_list();
    let mut disk_available_gb = 0.0;
    // Just find the first disk (usually Macintosh HD)
    for disk in disks.list() {
        if disk.mount_point().to_string_lossy() == "/" || disk.mount_point().to_string_lossy().contains("Macintosh HD") {
            disk_available_gb = disk.available_space() as f64 / 1_000_000_000.0;
            break;
        }
    }
    // Fallback if not found
    if disk_available_gb == 0.0 && !disks.list().is_empty() {
         disk_available_gb = disks.list()[0].available_space() as f64 / 1_000_000_000.0;
    }

    // Calculate Battery via pmset (macOS specific)
    let mut battery_percent = 100;
    let mut battery_charging = false;
    
    if let Ok(output) = Command::new("pmset").arg("-g").arg("batt").output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        
        // Example output: 
        // Now drawing from 'Battery Power'
        // -InternalBattery-0 (id=4653155)	100%; discharging; 20:00 remaining present: true
        
        if stdout.contains("AC Power") {
            battery_charging = true;
        } else if stdout.contains("charging") && !stdout.contains("discharging") {
            battery_charging = true;
        }

        if let Some(idx) = stdout.find('%') {
            // go back a few characters to find the number
            let mut start = idx;
            while start > 0 {
                let ch = stdout.as_bytes()[start - 1] as char;
                if !ch.is_ascii_digit() {
                    break;
                }
                start -= 1;
            }
            if let Ok(val) = stdout[start..idx].parse::<u8>() {
                battery_percent = val;
            }
        }
    }

    // Network connectivity (simple check, e.g., can ping 8.8.8.8 or just assume true for now)
    // A robust way is to use system tools or a simple TCP connect.
    let is_connected = Command::new("ping").args(["-c", "1", "-t", "1", "8.8.8.8"]).output().is_ok_and(|out| out.status.success());

    let hostname = System::host_name().unwrap_or_else(|| "My Mac".to_string());

    SystemStats {
        memory_used_percent,
        cpu_load_percent,
        disk_available_gb: (disk_available_gb * 100.0).round() / 100.0,
        battery_percent,
        battery_charging,
        is_connected,
        hostname,
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemHealth {
    pub is_safe: bool,
    pub sip_enabled: bool,
}

#[tauri::command]
pub fn check_system_health() -> SystemHealth {
    let mut sip_enabled = true;
    
    // Check SIP status
    if let Ok(output) = Command::new("csrutil").arg("status").output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.contains("disabled") {
            sip_enabled = false;
        }
    }
    
    SystemHealth {
        is_safe: sip_enabled,
        sip_enabled,
    }
}
