export type FileCategory =
  | 'System' | 'Application' | 'Document' | 'Media'
  | 'Code' | 'DevCache' | 'Cache' | 'Log'
  | 'Archive' | 'Trash' | 'Other';

export type SafetyLevel = 'Safe' | 'Review' | 'Caution';

export interface FileNode {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  file_type: FileCategory;
  children?: FileNode[];
  last_accessed?: number;
  last_modified?: number;
  safety_level: SafetyLevel;
}

export interface ScanResult {
  root: FileNode;
  total_size: number;
  file_count: number;
  dir_count: number;
  scan_duration_ms: number;
  categories: Record<string, number>;
}

export interface ScanProgress {
  scanned: number;
  current_path: string;
  estimated_total?: number;
}

export interface DiskInfo {
  total_capacity: number;
  available_space: number;
  used_space: number;
  purgeable_space?: number;
}

export interface AppInfo {
  name: string;
  version: string;
  identifier: string;
  build_profile: 'debug' | 'release' | string;
}

export interface AppRelatedFile {
  path: string;
  size: number;
  kind: string;
}

export interface InstalledApp {
  name: string;
  path: string;
  bundle_id?: string;
  app_size: number;
  related_size: number;
  total_size: number;
  related_files: AppRelatedFile[];
  last_used?: number;
  last_modified?: number;
  is_protected: boolean;
}

export type DevJunkType =
  | 'AppCache' | 'AppLogs' | 'BrowserCache' | 'EditorCache'
  | 'CommunicationCache' | 'AICache' | 'DiagnosticReports' | 'SavedState'
  | 'NodeModules' | 'NextCache' | 'TurboCache'
  | 'PythonBytecode' | 'FlutterCache' | 'RustBuild' | 'BuildArtifacts'
  | 'XcodeDerivedData' | 'XcodeArchives'
  | 'XcodeDeviceSupport' | 'IOSSimulators' | 'CocoaPodsCache'
  | 'SPMCache' | 'GradleCache' | 'DockerImages' | 'DockerVolumes'
  | 'GitObjects' | 'HomebrewCache' | 'NpmCache' | 'PnpmStore'
  | 'YarnCache' | 'BunCache' | 'CorepackCache' | 'UvCache'
  | 'CondaCache' | 'MavenCache' | 'GoCache' | 'CargoCache' | 'PipCache';

export interface DevJunkItem {
  path: string;
  size: number;
  junk_type: DevJunkType;
  project_name?: string;
  last_modified?: number;
  safety_level: SafetyLevel;
}

export interface CleanupResult {
  freed_bytes: number;
  reclaimable_bytes: number;
  trashed_bytes: number;
  permanently_deleted_bytes: number;
  items_deleted: number;
  failed_items: CleanupError[];
}

export interface CleanupError {
  path: string;
  reason: string;
}

export interface CleanupPreviewItem {
  path: string;
  size: number;
  status: 'cleanable' | 'skipped' | string;
  reason?: string;
}

export interface CleanupPreview {
  items: CleanupPreviewItem[];
  cleanable_count: number;
  skipped_count: number;
  total_reclaimable_bytes: number;
}

export interface IgnoredPath {
  path: string;
  reason?: string;
  created_at: number;
}

export interface CleanupHistoryEntry {
  created_at: number;
  freed_bytes: number;
  reclaimable_bytes: number;
  trashed_bytes: number;
  permanently_deleted_bytes: number;
  items_count: number;
  failed_count: number;
  permanent: boolean;
  paths: string[];
}

export interface DuplicateFile {
  name: string;
  path: string;
  size: number;
  allocated_size: number;
  file_type: FileCategory;
  last_accessed?: number;
  last_modified?: number;
  safety_level: SafetyLevel;
}

export interface DuplicateGroup {
  id: string;
  content_size: number;
  wasted_bytes: number;
  files: DuplicateFile[];
}

export interface DuplicateScanProgress {
  scanned_files: number;
  candidate_files: number;
  current_path: string;
  phase: 'indexing' | 'hashing' | 'done' | string;
}

export interface OptimizeAction {
  id: string;
  label: string;
  description: string;
  requires_confirmation: boolean;
}

export interface OptimizeActionResult {
  id: string;
  label: string;
  success: boolean;
  message: string;
}

export interface SystemStatus {
  health_score: number;
  health_label: string;
  hardware: HardwareStatus;
  cpu: CpuStatus;
  cpu_usage_percent: number;
  logical_cpu_count: number;
  load_average: [number, number, number];
  memory: MemoryStatus;
  disk: StatusDiskInfo;
  disks: StatusDiskInfo[];
  disk_io: DiskIoStatus;
  network: NetworkStatus;
  proxy: ProxyStatus;
  thermal: ThermalStatus;
  battery?: BatteryStatus;
  uptime_seconds: number;
  top_processes: ProcessStatus[];
}

export interface HardwareStatus {
  model: string;
  cpu_model: string;
  total_ram: string;
  disk_size: string;
  os_version: string;
  refresh_rate: string;
}

export interface CpuStatus {
  usage: number;
  per_core: number[];
  per_core_estimated: boolean;
  load1: number;
  load5: number;
  load15: number;
  core_count: number;
  logical_cpu: number;
  p_core_count: number;
  e_core_count: number;
}

export interface MemoryStatus {
  total: number;
  used: number;
  free: number;
  available: number;
  used_percent: number;
  swap_used: number;
  swap_total: number;
  cached: number;
  pressure: string;
}

export interface StatusDiskInfo {
  mount: string;
  device: string;
  total: number;
  used: number;
  available: number;
  used_percent: number;
  fstype: string;
  external: boolean;
}

export interface DiskIoStatus {
  read_rate: number;
  write_rate: number;
}

export interface NetworkStatus {
  down_rate: number;
  up_rate: number;
  ip: string;
  interface_name: string;
}

export interface ProxyStatus {
  enabled: boolean;
  proxy_type: string;
  host: string;
}

export interface ThermalStatus {
  battery_temp: number;
  system_power: number;
  adapter_power: number;
  battery_power: number;
}

export interface BatteryStatus {
  percent: number;
  status: string;
  time_remaining?: string;
  cycle_count?: number;
  health?: string;
  capacity?: number;
}

export interface ProcessStatus {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
}
