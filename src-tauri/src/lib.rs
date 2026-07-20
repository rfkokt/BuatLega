mod commands;
mod models;
mod scanner;
mod storage;
mod system_info;

#[tauri::command]
fn show_main_window(app_handle: tauri::AppHandle, route: String) {
    use tauri::{Manager, Emitter};
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app_handle.emit("navigate_main", route);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(system_info::SysInfoState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Focused(false) = event {
                if window.label() == "menubar" {
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::Manager;
                
                // Create the tray icon
                let _tray = tauri::tray::TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click { rect, button_state: tauri::tray::MouseButtonState::Up, .. } = event {
                            let app = tray.app_handle();
                            
                            let tray_x = match rect.position {
                                tauri::Position::Physical(p) => p.x as f64,
                                tauri::Position::Logical(p) => p.x,
                            };
                            let tray_y = match rect.position {
                                tauri::Position::Physical(p) => p.y as f64,
                                tauri::Position::Logical(p) => p.y,
                            };
                            let tray_height = match rect.size {
                                tauri::Size::Physical(s) => s.height as f64,
                                tauri::Size::Logical(s) => s.height,
                            };
                            let window_width = 360.0;
                            let x = tray_x - (window_width / 2.0);
                            let y = tray_y + tray_height;
                            
                            if let Some(window) = app.get_webview_window("menubar") {
                                let is_visible = window.is_visible().unwrap_or(false);
                                if is_visible {
                                    let _ = window.hide();
                                } else {
                                    // position window below the tray icon
                                    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x as i32, y as i32)));
                                    
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            } else {
                                // Create the window
                                let window = tauri::WebviewWindowBuilder::new(
                                    app,
                                    "menubar",
                                    tauri::WebviewUrl::App("/menubar".into())
                                )
                                .title("BuatLega Menubar")
                                .inner_size(360.0, 680.0)
                                .decorations(false)
                                .always_on_top(true)
                                .skip_taskbar(true)
                                .build()
                                .unwrap();
                                
                                let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x as i32, y as i32)));
                            }
                        }
                    })
                    .build(app)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info::get_app_info,
            commands::apps::list_installed_apps,
            commands::disk_info::get_disk_info,
            commands::disk_info::check_fda_status,
            commands::disk_info::open_system_preferences,
            commands::disk_info::restart_app,
            commands::scan::start_scan,
            commands::scan::cancel_scan,
            commands::scan::find_large_files,
            commands::scan::open_in_finder,
            commands::cleanup::preview_cleanup_items,
            commands::cleanup::cleanup_items,
            commands::dev_tools::scan_dev_junk,
            commands::duplicates::find_duplicates,
            commands::optimize::list_optimize_actions,
            commands::optimize::run_optimize_actions,
            commands::persistence::list_ignored_paths,
            commands::persistence::add_ignored_path,
            commands::persistence::remove_ignored_path,
            commands::persistence::list_cleanup_history,
            commands::persistence::clear_cleanup_history,
            commands::persistence::get_cached_scan,
            commands::persistence::clear_scan_cache,
            commands::status::get_system_status,
            system_info::get_system_stats,
            system_info::check_system_health,
            show_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
