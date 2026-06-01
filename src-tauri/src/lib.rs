mod gcal;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .manage(gcal::GcalState::new())
    .invoke_handler(tauri::generate_handler![
      gcal::gcal_auth_start,
      gcal::gcal_auth_status,
      gcal::gcal_disconnect,
      gcal::gcal_request,
    ])
    .setup(|app| {
      // dev 모드 전용 메뉴 + 로깅. release 에선 devtools API 가 없어 컴파일 자체에서 제거 필요
      // (런타임 if cfg!(debug_assertions) 로는 코드가 compile path 에 남아 release build 실패).
      #[cfg(debug_assertions)]
      {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;

        // dev 모드: JS 가 죽어 흰 화면 되어도 native menu 가 살아 있어 Cmd+R 로 복구.
        use tauri::menu::{Menu, MenuItemBuilder, SubmenuBuilder};
        use tauri::Manager;

        let menu = Menu::default(app.app_handle())?;
        let reload = MenuItemBuilder::with_id("reload", "Reload")
          .accelerator("CmdOrCtrl+R")
          .build(app)?;
        let toggle_devtools = MenuItemBuilder::with_id("toggle_devtools", "Toggle DevTools")
          .accelerator("CmdOrCtrl+Alt+I")
          .build(app)?;
        let dev = SubmenuBuilder::new(app, "Dev")
          .item(&reload)
          .item(&toggle_devtools)
          .build()?;
        menu.append(&dev)?;
        app.set_menu(menu)?;
        app.on_menu_event(|app, event| match event.id().as_ref() {
          "reload" => {
            if let Some(w) = app.get_webview_window("main") {
              let _ = w.eval("window.location.reload()");
            }
          }
          "toggle_devtools" => {
            if let Some(w) = app.get_webview_window("main") {
              if w.is_devtools_open() {
                w.close_devtools();
              } else {
                w.open_devtools();
              }
            }
          }
          _ => {}
        });
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
