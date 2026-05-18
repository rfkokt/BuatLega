mod commands;
mod models;
mod scanner;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            commands::app_info::get_app_info,
            commands::disk_info::get_disk_info,
            commands::disk_info::check_fda_status,
            commands::disk_info::open_system_preferences,
            commands::disk_info::restart_app,
            commands::scan::start_scan,
            commands::scan::cancel_scan,
            commands::scan::find_large_files,
            commands::scan::open_in_finder,
            commands::cleanup::cleanup_items,
            commands::dev_tools::scan_dev_junk,
            commands::duplicates::find_duplicates,
            commands::persistence::list_ignored_paths,
            commands::persistence::add_ignored_path,
            commands::persistence::remove_ignored_path,
            commands::persistence::list_cleanup_history,
            commands::persistence::clear_cleanup_history,
            commands::persistence::get_cached_scan,
            commands::persistence::clear_scan_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
