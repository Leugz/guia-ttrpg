use tauri::Manager;

pub fn init(app: &tauri::AppHandle) {
    let Ok(log_dir) = app.path().app_log_dir() else {
        fallback();
        return;
    };

    if std::fs::create_dir_all(&log_dir).is_err() {
        fallback();
        return;
    }

    let appender = tracing_appender::rolling::daily(log_dir, "app.log");
    let (writer, guard) = tracing_appender::non_blocking(appender);
    std::mem::forget(guard);
    let subscriber = tracing_subscriber::fmt()
        .with_writer(writer)
        .with_ansi(false)
        .finish();
    let _ = tracing::subscriber::set_global_default(subscriber);
}

fn fallback() {
    let _ = tracing::subscriber::set_global_default(tracing_subscriber::fmt().finish());
}
