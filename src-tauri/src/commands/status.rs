use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub health_score: u8,
    pub health_label: String,
    pub hardware: HardwareStatus,
    pub cpu: CpuStatus,
    pub cpu_usage_percent: f64,
    pub logical_cpu_count: u32,
    pub load_average: [f64; 3],
    pub memory: MemoryStatus,
    pub disk: DiskStatus,
    pub disks: Vec<DiskStatus>,
    pub disk_io: DiskIoStatus,
    pub network: NetworkStatus,
    pub proxy: ProxyStatus,
    pub thermal: ThermalStatus,
    pub battery: Option<BatteryStatus>,
    pub uptime_seconds: u64,
    pub top_processes: Vec<ProcessStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HardwareStatus {
    pub model: String,
    pub cpu_model: String,
    pub total_ram: String,
    pub disk_size: String,
    pub os_version: String,
    pub refresh_rate: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuStatus {
    pub usage: f64,
    pub per_core: Vec<f64>,
    pub per_core_estimated: bool,
    pub load1: f64,
    pub load5: f64,
    pub load15: f64,
    pub core_count: u32,
    pub logical_cpu: u32,
    pub p_core_count: u32,
    pub e_core_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStatus {
    pub total: u64,
    pub used: u64,
    pub free: u64,
    pub available: u64,
    pub used_percent: f64,
    pub swap_used: u64,
    pub swap_total: u64,
    pub cached: u64,
    pub pressure: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskStatus {
    pub mount: String,
    pub device: String,
    pub total: u64,
    pub used: u64,
    pub available: u64,
    pub used_percent: f64,
    pub fstype: String,
    pub external: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DiskIoStatus {
    pub read_rate: f64,
    pub write_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NetworkStatus {
    pub down_rate: f64,
    pub up_rate: f64,
    pub ip: String,
    pub interface_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProxyStatus {
    pub enabled: bool,
    pub proxy_type: String,
    pub host: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ThermalStatus {
    pub battery_temp: f64,
    pub system_power: f64,
    pub adapter_power: f64,
    pub battery_power: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryStatus {
    pub percent: u8,
    pub status: String,
    pub time_remaining: Option<String>,
    pub cycle_count: Option<u32>,
    pub health: Option<String>,
    pub capacity: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessStatus {
    pub pid: u32,
    pub name: String,
    pub cpu: f64,
    pub memory: f64,
}

#[derive(Clone)]
struct NetSample {
    at: Instant,
    counters: HashMap<String, (u64, u64)>,
}

static NET_SAMPLE: OnceLock<Mutex<Option<NetSample>>> = OnceLock::new();

#[tauri::command]
pub async fn get_system_status() -> Result<SystemStatus, String> {
    tokio::task::spawn_blocking(|| {
        let cpu = collect_cpu_status();
        let memory = collect_memory_status()?;
        let disks = collect_disk_statuses();
        let disk = disks
            .first()
            .cloned()
            .unwrap_or_else(|| collect_root_disk_status().unwrap_or_else(|_| default_disk_status()));
        let disk_io = collect_disk_io();
        let network = collect_network_status();
        let proxy = collect_proxy_status();
        let thermal = collect_thermal_status();
        let battery = collect_battery_status();
        let uptime_seconds = collect_uptime_seconds();
        let top_processes = collect_top_processes();
        let hardware = collect_hardware_status(memory.total, disk.total);
        let (health_score, health_label) = calculate_health(&cpu, &memory, &disk, battery.as_ref());

        Ok(SystemStatus {
            health_score,
            health_label,
            hardware,
            cpu_usage_percent: cpu.usage,
            logical_cpu_count: cpu.logical_cpu,
            load_average: [cpu.load1, cpu.load5, cpu.load15],
            cpu,
            memory,
            disk,
            disks,
            disk_io,
            network,
            proxy,
            thermal,
            battery,
            uptime_seconds,
            top_processes,
        })
    })
    .await
    .map_err(|e| format!("Status task failed: {}", e))?
}

fn collect_cpu_status() -> CpuStatus {
    let load_average = collect_load_average();
    let logical = collect_sysctl_u32("hw.logicalcpu").unwrap_or(1).max(1);
    let physical = collect_sysctl_u32("hw.physicalcpu").unwrap_or(logical).max(1);
    let usage = collect_cpu_usage_percent(logical);
    let (p_cores, e_cores) = collect_core_topology();

    CpuStatus {
        usage,
        per_core: vec![usage; logical as usize],
        per_core_estimated: true,
        load1: load_average[0],
        load5: load_average[1],
        load15: load_average[2],
        core_count: physical,
        logical_cpu: logical,
        p_core_count: p_cores,
        e_core_count: e_cores,
    }
}

fn collect_sysctl_u32(key: &str) -> Option<u32> {
    command_stdout("sysctl", &["-n", key])
        .ok()
        .and_then(|value| value.trim().parse::<u32>().ok())
}

fn collect_cpu_usage_percent(logical_cpu_count: u32) -> f64 {
    let output = command_stdout("ps", &["-Aceo", "pcpu="]).unwrap_or_default();
    let total_process_cpu: f64 = output
        .lines()
        .filter_map(|line| line.trim().parse::<f64>().ok())
        .sum();

    (total_process_cpu / logical_cpu_count.max(1) as f64).clamp(0.0, 100.0)
}

fn collect_core_topology() -> (u32, u32) {
    let output = command_stdout(
        "sysctl",
        &[
            "-n",
            "hw.perflevel0.logicalcpu",
            "hw.perflevel0.name",
            "hw.perflevel1.logicalcpu",
            "hw.perflevel1.name",
        ],
    )
    .unwrap_or_default();

    let lines: Vec<_> = output.lines().map(str::trim).collect();
    if lines.len() < 4 {
        return (0, 0);
    }

    let level0_count = lines[0].parse::<u32>().unwrap_or(0);
    let level0_name = lines[1].to_lowercase();
    let level1_count = lines[2].parse::<u32>().unwrap_or(0);
    let level1_name = lines[3].to_lowercase();
    let mut p_cores = 0;
    let mut e_cores = 0;

    if level0_name.contains("performance") {
        p_cores = level0_count;
    } else if level0_name.contains("efficiency") {
        e_cores = level0_count;
    }
    if level1_name.contains("performance") {
        p_cores = level1_count;
    } else if level1_name.contains("efficiency") {
        e_cores = level1_count;
    }

    (p_cores, e_cores)
}

fn collect_load_average() -> [f64; 3] {
    let output = Command::new("sysctl")
        .args(["-n", "vm.loadavg"])
        .output()
        .ok()
        .map(|out| String::from_utf8_lossy(&out.stdout).to_string())
        .unwrap_or_default();

    let values: Vec<f64> = output
        .trim_matches(|c| c == '{' || c == '}' || c == ' ')
        .split_whitespace()
        .filter_map(|part| part.parse::<f64>().ok())
        .collect();

    [
        values.first().copied().unwrap_or_default(),
        values.get(1).copied().unwrap_or_default(),
        values.get(2).copied().unwrap_or_default(),
    ]
}

fn collect_memory_status() -> Result<MemoryStatus, String> {
    let total = command_stdout("sysctl", &["-n", "hw.memsize"])?
        .trim()
        .parse::<u64>()
        .map_err(|e| format!("Failed to parse memory size: {}", e))?;
    let vm_stat = command_stdout("vm_stat", &[])?;

    let page_size = vm_stat
        .lines()
        .next()
        .and_then(|line| line.split("page size of ").nth(1))
        .and_then(|tail| tail.split_whitespace().next())
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(16_384);

    let pages_free = parse_vm_pages(&vm_stat, "Pages free:");
    let pages_speculative = parse_vm_pages(&vm_stat, "Pages speculative:");
    let pages_inactive = parse_vm_pages(&vm_stat, "Pages inactive:");
    let pages_file_backed = parse_vm_pages(&vm_stat, "File-backed pages:");
    let free = (pages_free + pages_speculative).saturating_mul(page_size);
    let available = (pages_free + pages_speculative + pages_inactive).saturating_mul(page_size);
    let used = total.saturating_sub(available.min(total));
    let used_percent = if total == 0 { 0.0 } else { (used as f64 / total as f64) * 100.0 };
    let (swap_used, swap_total) = collect_swap_usage();

    Ok(MemoryStatus {
        total,
        used,
        free,
        available: available.min(total),
        used_percent,
        swap_used,
        swap_total,
        cached: pages_file_backed.saturating_mul(page_size),
        pressure: collect_memory_pressure(),
    })
}

fn parse_vm_pages(vm_stat: &str, label: &str) -> u64 {
    vm_stat
        .lines()
        .find(|line| line.trim_start().starts_with(label))
        .and_then(|line| line.split(':').nth(1))
        .map(|value| value.trim().trim_end_matches('.'))
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or_default()
}

fn collect_swap_usage() -> (u64, u64) {
    let output = command_stdout("sysctl", &["-n", "vm.swapusage"]).unwrap_or_default();
    let total = parse_swap_field(&output, "total");
    let used = parse_swap_field(&output, "used");
    (used, total)
}

fn parse_swap_field(output: &str, key: &str) -> u64 {
    let marker = format!("{} = ", key);
    output
        .split(&marker)
        .nth(1)
        .and_then(|tail| tail.split_whitespace().next())
        .map(parse_size_token)
        .unwrap_or_default()
}

fn parse_size_token(value: &str) -> u64 {
    let number = value
        .trim_matches(|c: char| !c.is_ascii_digit() && c != '.')
        .parse::<f64>()
        .unwrap_or_default();
    let lower = value.to_lowercase();
    let multiplier = if lower.contains('g') {
        1024.0 * 1024.0 * 1024.0
    } else if lower.contains('m') {
        1024.0 * 1024.0
    } else if lower.contains('k') {
        1024.0
    } else {
        1.0
    };
    (number * multiplier) as u64
}

fn collect_memory_pressure() -> String {
    let output = command_stdout("memory_pressure", &[]).unwrap_or_default().to_lowercase();
    if output.contains("critical") {
        "critical".to_string()
    } else if output.contains("warn") {
        "warn".to_string()
    } else if output.contains("normal") {
        "normal".to_string()
    } else {
        String::new()
    }
}

fn collect_disk_statuses() -> Vec<DiskStatus> {
    let mut paths = vec!["-kP".to_string(), "/".to_string()];
    if let Ok(entries) = fs::read_dir("/Volumes") {
        for entry in entries.flatten() {
            if let Some(path) = entry.path().to_str() {
                paths.push(path.to_string());
            }
        }
    }
    let args: Vec<&str> = paths.iter().map(String::as_str).collect();
    let output = command_stdout("df", &args).unwrap_or_default();
    let mut disks: Vec<DiskStatus> = output
        .lines()
        .skip(1)
        .filter_map(parse_df_line)
        .filter(|disk| disk.total >= 1 << 30)
        .collect();

    if disks.is_empty() {
        if let Ok(root) = collect_root_disk_status() {
            disks.push(root);
        }
    }

    disks.sort_by(|a, b| {
        a.external
            .cmp(&b.external)
            .then_with(|| b.total.cmp(&a.total))
    });
    disks.truncate(3);
    disks
}

fn parse_df_line(line: &str) -> Option<DiskStatus> {
    let parts: Vec<_> = line.split_whitespace().collect();
    if parts.len() < 6 {
        return None;
    }
    let device = parts[0].to_string();
    let total = parts[1].parse::<u64>().ok()?.saturating_mul(1024);
    let used = parts[2].parse::<u64>().ok()?.saturating_mul(1024);
    let available = parts[3].parse::<u64>().ok()?.saturating_mul(1024);
    let mount = parts[5..].join(" ");
    let external = mount.starts_with("/Volumes/");

    Some(DiskStatus {
        mount,
        device,
        total,
        used,
        available,
        used_percent: if total == 0 { 0.0 } else { (used as f64 / total as f64) * 100.0 },
        fstype: String::new(),
        external,
    })
}

fn collect_root_disk_status() -> Result<DiskStatus, String> {
    let output = command_stdout("diskutil", &["info", "/"])?;
    let mut total = None;
    let mut available = None;
    let mut device = String::new();
    let mut fstype = String::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Device Identifier:") {
            device = format!("/dev/{}", trimmed.split(':').nth(1).unwrap_or_default().trim());
        }
        if trimmed.starts_with("Type (Bundle):") || trimmed.starts_with("File System Personality:") {
            fstype = trimmed.split(':').nth(1).unwrap_or_default().trim().to_string();
        }
        if trimmed.starts_with("Container Total Space:") || trimmed.starts_with("Disk Size:") {
            total = total.or_else(|| parse_diskutil_bytes(trimmed));
        }
        if trimmed.starts_with("Container Free Space:")
            || trimmed.starts_with("Volume Free Space:")
            || trimmed.starts_with("Volume Available Space:")
        {
            available = available.or_else(|| parse_diskutil_bytes(trimmed));
        }
    }

    let total = total.ok_or("Could not determine disk total")?;
    let available = available.ok_or("Could not determine disk available")?;
    let used = total.saturating_sub(available);

    Ok(DiskStatus {
        mount: "/".to_string(),
        device,
        total,
        used,
        available,
        used_percent: if total == 0 { 0.0 } else { (used as f64 / total as f64) * 100.0 },
        fstype,
        external: false,
    })
}

fn default_disk_status() -> DiskStatus {
    DiskStatus {
        mount: "/".to_string(),
        device: String::new(),
        total: 0,
        used: 0,
        available: 0,
        used_percent: 0.0,
        fstype: String::new(),
        external: false,
    }
}

fn parse_diskutil_bytes(line: &str) -> Option<u64> {
    let open = line.find('(')?;
    let end = line[open..].find(" Bytes")?;
    line[open + 1..open + end].trim().parse().ok()
}

fn collect_disk_io() -> DiskIoStatus {
    let output = command_stdout("iostat", &["-d", "-w", "1", "-c", "2"]).unwrap_or_default();
    let Some(line) = output.lines().rev().find(|line| {
        let parts: Vec<_> = line.split_whitespace().collect();
        parts.len() >= 3 && parts.iter().all(|part| part.parse::<f64>().is_ok())
    }) else {
        return DiskIoStatus::default();
    };

    let values: Vec<f64> = line
        .split_whitespace()
        .filter_map(|part| part.parse::<f64>().ok())
        .collect();

    if values.len() < 3 {
        return DiskIoStatus::default();
    }

    let total_mbs = values
        .chunks(3)
        .filter_map(|chunk| chunk.get(2))
        .sum::<f64>();

    DiskIoStatus {
        read_rate: total_mbs,
        write_rate: 0.0,
    }
}

fn collect_network_status() -> NetworkStatus {
    let output = command_stdout("netstat", &["-ibn"]).unwrap_or_default();
    let counters = parse_network_counters(&output);
    let ip_map = collect_interface_ips();
    let now = Instant::now();
    let sample_lock = NET_SAMPLE.get_or_init(|| Mutex::new(None));
    let mut guard = sample_lock.lock().ok();
    let mut status = NetworkStatus::default();

    if let Some(ref mut sample) = guard {
        if let Some(previous) = sample.as_ref() {
            let elapsed = now.duration_since(previous.at).as_secs_f64().max(0.1);
            for (name, (rx, tx)) in &counters {
                let Some((old_rx, old_tx)) = previous.counters.get(name) else {
                    continue;
                };
                let down = rx.saturating_sub(*old_rx) as f64 / 1024.0 / 1024.0 / elapsed;
                let up = tx.saturating_sub(*old_tx) as f64 / 1024.0 / 1024.0 / elapsed;
                if down + up > status.down_rate + status.up_rate {
                    status = NetworkStatus {
                        down_rate: down,
                        up_rate: up,
                        ip: ip_map.get(name).cloned().unwrap_or_default(),
                        interface_name: name.clone(),
                    };
                }
            }
        }
        **sample = Some(NetSample { at: now, counters });
    }

    status
}

fn parse_network_counters(output: &str) -> HashMap<String, (u64, u64)> {
    let mut counters: HashMap<String, (u64, u64)> = HashMap::new();
    for line in output.lines().skip(1) {
        let parts: Vec<_> = line.split_whitespace().collect();
        if parts.len() < 10 {
            continue;
        }
        let iface = parts[0].trim_end_matches('*');
        if is_noise_interface(iface) {
            continue;
        }
        let rx = parts.get(6).and_then(|value| value.parse::<u64>().ok()).unwrap_or(0);
        let tx = parts.get(9).and_then(|value| value.parse::<u64>().ok()).unwrap_or(0);
        let entry = counters.entry(iface.to_string()).or_insert((0, 0));
        entry.0 = entry.0.saturating_add(rx);
        entry.1 = entry.1.saturating_add(tx);
    }
    counters
}

fn collect_interface_ips() -> HashMap<String, String> {
    let output = command_stdout("ifconfig", &[]).unwrap_or_default();
    let mut map = HashMap::new();
    let mut current = String::new();
    for line in output.lines() {
        if !line.starts_with('\t') && line.contains(':') {
            current = line.split(':').next().unwrap_or_default().to_string();
        }
        let trimmed = line.trim();
        if trimmed.starts_with("inet ") && !trimmed.contains("127.0.0.1") {
            if let Some(ip) = trimmed.split_whitespace().nth(1) {
                map.insert(current.clone(), ip.to_string());
            }
        }
    }
    map
}

fn is_noise_interface(name: &str) -> bool {
    let lower = name.to_lowercase();
    ["lo", "awdl", "utun", "llw", "bridge", "gif", "stf", "xhc", "anpi", "ap"]
        .iter()
        .any(|prefix| lower.starts_with(prefix))
}

fn collect_proxy_status() -> ProxyStatus {
    let output = command_stdout("scutil", &["--proxy"]).unwrap_or_default();
    for (enabled_key, host_key, port_key, proxy_type) in [
        ("SOCKSEnable", "SOCKSProxy", "SOCKSPort", "SOCKS"),
        ("HTTPSEnable", "HTTPSProxy", "HTTPSPort", "HTTPS"),
        ("HTTPEnable", "HTTPProxy", "HTTPPort", "HTTP"),
    ] {
        if scutil_value(&output, enabled_key) == Some("1".to_string()) {
            let host = scutil_value(&output, host_key).unwrap_or_else(|| "System Proxy".to_string());
            let port = scutil_value(&output, port_key).unwrap_or_default();
            return ProxyStatus {
                enabled: true,
                proxy_type: proxy_type.to_string(),
                host: if port.is_empty() { host } else { format!("{}:{}", host, port) },
            };
        }
    }

    if scutil_value(&output, "ProxyAutoConfigEnable") == Some("1".to_string()) {
        return ProxyStatus {
            enabled: true,
            proxy_type: "PAC".to_string(),
            host: scutil_value(&output, "ProxyAutoConfigURLString").unwrap_or_else(|| "PAC".to_string()),
        };
    }

    ProxyStatus::default()
}

fn scutil_value(output: &str, key: &str) -> Option<String> {
    let prefix = format!("{} :", key);
    output.lines().find_map(|line| {
        let trimmed = line.trim();
        trimmed
            .strip_prefix(&prefix)
            .map(|value| value.trim().to_string())
    })
}

fn collect_battery_status() -> Option<BatteryStatus> {
    let output = command_stdout("pmset", &["-g", "batt"]).ok()?;
    let battery_line = output.lines().find(|line| line.contains('%'))?;
    let percent = battery_line
        .split('%')
        .next()
        .and_then(|left| left.split_whitespace().last())
        .and_then(|value| value.parse::<u8>().ok())?;
    let parts: Vec<&str> = battery_line.split(';').map(str::trim).collect();
    let status = parts.get(1).copied().unwrap_or("unknown").to_string();
    let time_remaining = parts
        .get(2)
        .map(|value| {
            value
                .replace(" remaining", "")
                .replace(" present: true", "")
                .trim()
                .to_string()
        })
        .filter(|value| !value.is_empty() && !value.contains("no estimate"));
    let (health, cycle_count, capacity) = collect_power_data();

    Some(BatteryStatus {
        percent,
        status,
        time_remaining,
        cycle_count,
        health,
        capacity,
    })
}

fn collect_power_data() -> (Option<String>, Option<u32>, Option<u32>) {
    let output = command_stdout("system_profiler", &["SPPowerDataType"]).unwrap_or_default();
    let mut health = None;
    let mut cycles = None;
    let mut capacity = None;

    for line in output.lines() {
        let lower = line.to_lowercase();
        if lower.contains("condition:") {
            health = line.split(':').nth(1).map(|value| value.trim().to_string());
        }
        if lower.contains("cycle count:") {
            cycles = line
                .split(':')
                .nth(1)
                .and_then(|value| value.trim().parse::<u32>().ok());
        }
        if lower.contains("maximum capacity:") {
            capacity = line
                .split(':')
                .nth(1)
                .map(|value| value.trim().trim_end_matches('%'))
                .and_then(|value| value.parse::<u32>().ok());
        }
    }

    (health, cycles, capacity)
}

fn collect_thermal_status() -> ThermalStatus {
    let output = command_stdout("ioreg", &["-rn", "AppleSmartBattery"]).unwrap_or_default();
    let mut thermal = ThermalStatus::default();
    let mut voltage_mv = 0.0;
    let mut amperage_ma = 0.0;

    for line in output.lines() {
        if let Some(temp) = parse_ioreg_number(line, "Temperature") {
            thermal.battery_temp = if temp < 1000.0 { temp } else { temp / 100.0 };
        }
        if line.contains("\"AdapterDetails\"") && !line.contains("AppleRaw") {
            if let Some(watts) = parse_ioreg_number(line, "Watts") {
                thermal.adapter_power = watts;
            }
        }
        if let Some(power) = parse_ioreg_number(line, "SystemPowerIn").or_else(|| parse_ioreg_number(line, "SystemPower")) {
            thermal.system_power = power / 1000.0;
        }
        if let Some(power) = parse_ioreg_number(line, "BatteryPower") {
            thermal.battery_power = power / 1000.0;
        }
        if let Some(voltage) = parse_ioreg_number(line, "Voltage").or_else(|| parse_ioreg_number(line, "AppleRawBatteryVoltage")) {
            voltage_mv = voltage;
        }
        if let Some(amperage) = parse_ioreg_number(line, "InstantAmperage").or_else(|| parse_ioreg_number(line, "Amperage")) {
            amperage_ma = amperage;
        }
    }

    if thermal.battery_power == 0.0 && voltage_mv > 0.0 && amperage_ma != 0.0 {
        thermal.battery_power = -(voltage_mv * amperage_ma) / 1_000_000.0;
    }

    thermal
}

fn parse_ioreg_number(line: &str, key: &str) -> Option<f64> {
    let key_pos = line.find(key)?;
    let after = &line[key_pos + key.len()..];
    let number: String = after
        .chars()
        .skip_while(|c| !c.is_ascii_digit() && *c != '-')
        .take_while(|c| c.is_ascii_digit() || *c == '-' || *c == '.')
        .collect();
    number.parse::<f64>().ok()
}

fn collect_hardware_status(total_ram: u64, disk_size: u64) -> HardwareStatus {
    let hardware = command_stdout("system_profiler", &["SPHardwareDataType"]).unwrap_or_default();
    let display = command_stdout("system_profiler", &["-detailLevel", "mini", "SPDisplaysDataType"]).unwrap_or_default();
    let os_version = command_stdout("sw_vers", &["-productVersion"])
        .map(|value| format!("macOS {}", value.trim()))
        .unwrap_or_default();

    HardwareStatus {
        model: parse_profiler_field(&hardware, "Model Name").unwrap_or_default(),
        cpu_model: parse_profiler_field(&hardware, "Chip")
            .or_else(|| parse_profiler_field(&hardware, "Processor Name"))
            .unwrap_or_default(),
        total_ram: human_bytes(total_ram),
        disk_size: human_bytes(disk_size),
        os_version,
        refresh_rate: parse_refresh_rate(&display),
    }
}

fn parse_profiler_field(output: &str, field: &str) -> Option<String> {
    let prefix = format!("{}:", field);
    output.lines().find_map(|line| {
        let trimmed = line.trim();
        trimmed
            .strip_prefix(&prefix)
            .map(|value| value.trim().to_string())
    })
}

fn parse_refresh_rate(output: &str) -> String {
    let mut max_hz = 0;
    for token in output.split_whitespace() {
        let cleaned = token
            .trim_matches(|c: char| !c.is_ascii_digit() && c != '.')
            .split('.')
            .next()
            .unwrap_or_default();
        if token.to_lowercase().contains("hz") {
            if let Ok(hz) = cleaned.parse::<u32>() {
                if hz > max_hz && hz < 500 {
                    max_hz = hz;
                }
            }
        }
    }
    if max_hz > 0 { format!("{}Hz", max_hz) } else { String::new() }
}

fn collect_uptime_seconds() -> u64 {
    let output = command_stdout("sysctl", &["-n", "kern.boottime"]).unwrap_or_default();
    let boot_secs = output
        .split("sec = ")
        .nth(1)
        .and_then(|tail| tail.split(',').next())
        .and_then(|value| value.trim().parse::<u64>().ok())
        .unwrap_or_default();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    now.saturating_sub(boot_secs)
}

fn collect_top_processes() -> Vec<ProcessStatus> {
    let output = command_stdout("ps", &["-Aceo", "pid=,pcpu=,pmem=,comm=", "-r"]).unwrap_or_default();

    output
        .lines()
        .take(8)
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let pid = parts.next()?.parse::<u32>().ok()?;
            let cpu = parts.next()?.parse::<f64>().ok()?;
            let memory = parts.next()?.parse::<f64>().ok()?;
            let name = parts.collect::<Vec<_>>().join(" ");
            Some(ProcessStatus {
                pid,
                name,
                cpu,
                memory,
            })
        })
        .collect()
}

fn calculate_health(
    cpu: &CpuStatus,
    memory: &MemoryStatus,
    disk: &DiskStatus,
    battery: Option<&BatteryStatus>,
) -> (u8, String) {
    let mut score = 100.0;

    if cpu.usage > 85.0 {
        score -= ((cpu.usage - 85.0) * 0.6).min(12.0);
    }
    if memory.used_percent > 85.0 {
        score -= (memory.used_percent - 85.0).min(15.0);
    }
    if memory.pressure == "warn" {
        score -= 5.0;
    } else if memory.pressure == "critical" {
        score -= 15.0;
    }
    if disk.used_percent > 80.0 {
        score -= ((disk.used_percent - 80.0) * 1.2).min(20.0);
    }
    if cpu.load1 > cpu.logical_cpu as f64 {
        score -= ((cpu.load1 - cpu.logical_cpu as f64) * 2.0).min(15.0);
    }
    if let Some(battery) = battery {
        if battery.percent < 20 && battery.status.contains("discharging") {
            score -= 10.0;
        }
        if battery.health.as_deref().is_some_and(|health| !health.eq_ignore_ascii_case("normal")) {
            score -= 5.0;
        }
    }

    let score = score.clamp(0.0, 100.0).round() as u8;
    let label = if score >= 85 {
        "Good"
    } else if score >= 65 {
        "Review"
    } else {
        "Needs Attention"
    };

    (score, label.to_string())
}

fn human_bytes(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{} {}", bytes, UNITS[unit])
    } else {
        format!("{:.1} {}", value, UNITS[unit])
    }
}

fn command_stdout(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run {}: {}", program, e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
