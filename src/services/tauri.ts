import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  AppInfo,
  CleanupHistoryEntry,
  CleanupResult,
  CleanupPreview,
  DevJunkItem,
  DiskInfo,
  DuplicateGroup,
  DuplicateScanProgress,
  FileNode,
  IgnoredPath,
  InstalledApp,
  OptimizeAction,
  OptimizeActionResult,
  ScanProgress,
  ScanResult,
  SystemStatus,
} from '../types';

// ── App Info ──
export const getAppInfo = () =>
  invoke<AppInfo>('get_app_info');

export const listInstalledApps = () =>
  invoke<InstalledApp[]>('list_installed_apps');

// ── Disk Info ──
export const getDiskInfo = () =>
  invoke<DiskInfo>('get_disk_info');

export const checkFDAStatus = () =>
  invoke<boolean>('check_fda_status');

export const openSystemPreferences = () =>
  invoke<void>('open_system_preferences');

export const restartApp = () =>
  invoke<void>('restart_app');

// ── Scanning ──
export const startScan = (path: string, maxDepth?: number) =>
  invoke<ScanResult>('start_scan', { path, maxDepth });

export const cancelScan = () =>
  invoke<void>('cancel_scan');

export const getCachedScan = (path: string, maxDepth?: number) =>
  invoke<ScanResult | null>('get_cached_scan', { path, maxDepth });

export const findLargeFiles = (path: string, minSizeBytes: number) =>
  invoke<FileNode[]>('find_large_files', { path, minSizeBytes });

export const findDuplicates = (path: string, minSizeBytes?: number) =>
  invoke<DuplicateGroup[]>('find_duplicates', { path, minSizeBytes });

// ── Optimize ──
export const listOptimizeActions = () =>
  invoke<OptimizeAction[]>('list_optimize_actions');

export const runOptimizeActions = (actionIds: string[]) =>
  invoke<OptimizeActionResult[]>('run_optimize_actions', { actionIds });

// ── Status ──
export const getSystemStatus = () =>
  invoke<SystemStatus>('get_system_status');

// ── Developer Tools ──
export const scanDevJunk = () =>
  invoke<DevJunkItem[]>('scan_dev_junk');

// ── Cleanup ──
export const cleanupItems = (paths: string[], permanent: boolean = false) =>
  invoke<CleanupResult>('cleanup_items', { paths, permanent });

export const previewCleanupItems = (paths: string[]) =>
  invoke<CleanupPreview>('preview_cleanup_items', { paths });

// ── Persistence ──
export const listIgnoredPaths = () =>
  invoke<IgnoredPath[]>('list_ignored_paths');

export const addIgnoredPath = (path: string, reason?: string) =>
  invoke<IgnoredPath[]>('add_ignored_path', { path, reason });

export const removeIgnoredPath = (path: string) =>
  invoke<IgnoredPath[]>('remove_ignored_path', { path });

export const listCleanupHistory = () =>
  invoke<CleanupHistoryEntry[]>('list_cleanup_history');

export const clearCleanupHistory = () =>
  invoke<void>('clear_cleanup_history');

export const clearScanCache = () =>
  invoke<void>('clear_scan_cache');

// ── File Operations ──
export const openInFinder = (path: string) =>
  invoke<void>('open_in_finder', { path });

// ── Event Listeners ──
export const onScanProgress = (callback: (progress: ScanProgress) => void): Promise<UnlistenFn> =>
  listen<ScanProgress>('scan://progress', (event) => callback(event.payload));

export const onCleanupProgress = (
  callback: (progress: { completed: number; total: number }) => void
): Promise<UnlistenFn> =>
  listen<{ completed: number; total: number }>('cleanup://progress', (event) => callback(event.payload));

export const onDuplicateScanProgress = (
  callback: (progress: DuplicateScanProgress) => void
): Promise<UnlistenFn> =>
  listen<DuplicateScanProgress>('duplicates://progress', (event) => callback(event.payload));
