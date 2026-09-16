//! Native Gemini Web session capture and authentication flow.

use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

const GEMINI_LOGIN_WINDOW_LABEL: &str = "gemini-login";
const GEMINI_URL: &str = "https://gemini.google.com";

// Standard desktop Chrome User-Agent without embedded WebView tokens to avoid Google sign-in blocks
const DESKTOP_CHROME_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiSessionData {
    pub psid: String,
    pub psidts: Option<String>,
    pub psidcc: Option<String>,
    pub cookie_header: String,
}

fn extract_gemini_session_from_cookies(
    cookies: &[tauri::webview::Cookie<'static>],
) -> Option<GeminiSessionData> {
    let mut psid = None;
    let mut psidts = None;
    let mut psidcc = None;
    let mut relevant_pairs = Vec::new();

    for cookie in cookies {
        let name = cookie.name().trim();
        let value = cookie.value().trim();
        if value.is_empty() {
            continue;
        }

        match name {
            "__Secure-1PSID" => {
                psid = Some(value.to_string());
                relevant_pairs.push(format!("{name}={value}"));
            }
            "__Secure-1PSIDTS" => {
                psidts = Some(value.to_string());
                relevant_pairs.push(format!("{name}={value}"));
            }
            "__Secure-1PSIDCC" => {
                psidcc = Some(value.to_string());
                relevant_pairs.push(format!("{name}={value}"));
            }
            "__Secure-1PAPISID" | "SID" | "HSID" | "SSID" => {
                relevant_pairs.push(format!("{name}={value}"));
            }
            _ => {}
        }
    }

    if let Some(psid_val) = psid {
        let cookie_header = relevant_pairs.join("; ");
        Some(GeminiSessionData {
            psid: psid_val,
            psidts,
            psidcc,
            cookie_header,
        })
    } else {
        None
    }
}

/// Polls or reads cookies from any available webview window in the application.
async fn query_gemini_cookies(app: &AppHandle) -> Result<Option<GeminiSessionData>, String> {
    let url = Url::parse(GEMINI_URL).map_err(|e| e.to_string())?;

    // Try gemini-login window first if open, otherwise fall back to main window
    let window = app
        .get_webview_window(GEMINI_LOGIN_WINDOW_LABEL)
        .or_else(|| app.get_webview_window("main"));

    let Some(window) = window else {
        return Ok(None);
    };

    let cookies = tokio::task::spawn_blocking(move || window.cookies_for_url(url))
        .await
        .map_err(|e| format!("thread error reading cookies: {e}"))?
        .map_err(|e| format!("failed to read cookies: {e}"))?;

    Ok(extract_gemini_session_from_cookies(&cookies))
}

/// Automatically extracts Gemini session cookies from local Firefox profiles.
pub fn import_firefox_gemini_cookies() -> Option<GeminiSessionData> {
    #[cfg(target_os = "windows")]
    let profiles_base = std::env::var("APPDATA")
        .ok()
        .map(|appdata| std::path::PathBuf::from(appdata).join("Mozilla").join("Firefox").join("Profiles"));

    #[cfg(target_os = "macos")]
    let profiles_base = dirs::home_dir().map(|h| {
        h.join("Library")
            .join("Application Support")
            .join("Firefox")
            .join("Profiles")
    });

    #[cfg(target_os = "linux")]
    let profiles_base = dirs::home_dir().map(|h| h.join(".mozilla").join("firefox"));

    let Some(profiles_dir) = profiles_base else {
        return None;
    };

    if !profiles_dir.exists() {
        return None;
    }

    let entries = std::fs::read_dir(profiles_dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let db_path = path.join("cookies.sqlite");
            if db_path.exists() {
                if let Ok(temp_file) = tempfile::NamedTempFile::new() {
                    let temp_path = temp_file.path().to_path_buf();
                    if std::fs::copy(&db_path, &temp_path).is_ok() {
                        if let Ok(conn) = rusqlite::Connection::open(&temp_path) {
                            let query = "SELECT name, value, host FROM moz_cookies WHERE host LIKE '%google.com' AND name IN ('__Secure-1PSID', '__Secure-1PSIDTS', '__Secure-1PSIDCC', '__Secure-1PAPISID', 'SID', 'HSID', 'SSID')";
                            if let Ok(mut stmt) = conn.prepare(query) {
                                let mut psid = None;
                                let mut psidts = None;
                                let mut psidcc = None;
                                let mut relevant_pairs = Vec::new();

                                let rows = stmt.query_map([], |row| {
                                    let name: String = row.get(0)?;
                                    let value: String = row.get(1)?;
                                    let host: String = row.get(2)?;
                                    Ok((name, value, host))
                                });

                                if let Ok(rows) = rows {
                                    for r in rows.flatten() {
                                        let (name, value, _host) = r;
                                        if value.is_empty() {
                                            continue;
                                        }
                                        match name.as_str() {
                                            "__Secure-1PSID" => {
                                                psid = Some(value.clone());
                                                relevant_pairs.push(format!("{name}={value}"));
                                            }
                                            "__Secure-1PSIDTS" => {
                                                psidts = Some(value.clone());
                                                relevant_pairs.push(format!("{name}={value}"));
                                            }
                                            "__Secure-1PSIDCC" => {
                                                psidcc = Some(value.clone());
                                                relevant_pairs.push(format!("{name}={value}"));
                                            }
                                            "__Secure-1PAPISID" | "SID" | "HSID" | "SSID" => {
                                                relevant_pairs.push(format!("{name}={value}"));
                                            }
                                            _ => {}
                                        }
                                    }
                                }

                                if let Some(psid_val) = psid {
                                    let cookie_header = relevant_pairs.join("; ");
                                    return Some(GeminiSessionData {
                                        psid: psid_val,
                                        psidts,
                                        psidcc,
                                        cookie_header,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// Check if active Gemini session cookies already exist in the browser or webview storage.
#[tauri::command]
pub async fn get_gemini_cookies(app: AppHandle) -> Result<Option<GeminiSessionData>, String> {
    // 1. Check if user has active session in local browser (e.g. Firefox)
    if let Some(session) = import_firefox_gemini_cookies() {
        return Ok(Some(session));
    }

    // 2. Check webview storage
    query_gemini_cookies(&app).await
}

/// Explicit command to import Gemini cookies from local browser profiles.
#[tauri::command]
pub async fn import_browser_gemini_cookies() -> Result<Option<GeminiSessionData>, String> {
    Ok(import_firefox_gemini_cookies())
}

/// Close the Gemini login window if currently open.
#[tauri::command]
pub async fn close_gemini_login_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(GEMINI_LOGIN_WINDOW_LABEL) {
        let _ = window.close();
    }
    Ok(())
}

/// Open an in-app WebView window for Google Gemini authentication and watch for session cookies.
#[tauri::command]
pub async fn open_gemini_login_window(app: AppHandle) -> Result<(), String> {
    let target_url = Url::parse(GEMINI_URL).map_err(|e| e.to_string())?;

    // If window already exists, focus it
    if let Some(window) = app.get_webview_window(GEMINI_LOGIN_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    // Create the login webview window with a clean User-Agent and script that removes embedded markers
    let login_window = WebviewWindowBuilder::new(
        &app,
        GEMINI_LOGIN_WINDOW_LABEL,
        WebviewUrl::External(target_url),
    )
    .title("Авторизация Google Gemini (Подписка Web)")
    .inner_size(960.0, 720.0)
    .min_inner_size(640.0, 480.0)
    .center()
    .user_agent(DESKTOP_CHROME_USER_AGENT)
    .initialization_script(
        r#"
        try {
            if (window.chrome) {
                try { delete window.chrome.webview; } catch(e) {}
                try { Object.defineProperty(window.chrome, 'webview', { get: () => undefined }); } catch(e) {}
            }
            try {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            } catch(e) {}
        } catch(e) {}
        "#,
    )
    .build()
    .map_err(|e| format!("failed to create login window: {e}"))?;

    let _ = login_window.show();
    let _ = login_window.set_focus();

    // Spawn background watcher to detect when user logs in
    let app_handle = app.clone();
    tokio::spawn(async move {
        let timeout = Duration::from_secs(300); // 5 minutes
        let poll_interval = Duration::from_millis(1500);
        let start = std::time::Instant::now();

        while start.elapsed() < timeout {
            // Check if window was closed by user
            if app_handle.get_webview_window(GEMINI_LOGIN_WINDOW_LABEL).is_none() {
                break;
            }

            match query_gemini_cookies(&app_handle).await {
                Ok(Some(session)) => {
                    // Successfully found __Secure-1PSID!
                    let _ = app_handle.emit("gemini-cookies-captured", &session);

                    // Short delay to let the user see the page loaded, then close
                    tokio::time::sleep(Duration::from_millis(1000)).await;
                    if let Some(window) = app_handle.get_webview_window(GEMINI_LOGIN_WINDOW_LABEL) {
                        let _ = window.close();
                    }
                    break;
                }
                _ => {}
            }

            tokio::time::sleep(poll_interval).await;
        }
    });

    Ok(())
}

pub const GEMINI_BRIDGE_PORT: u16 = 20129;
pub const GEMINI_BRIDGE_BASE_URL: &str = "http://127.0.0.1:20129/v1";
const GEMINI_BRIDGE_HEALTH_URL: &str = "http://127.0.0.1:20129/health";
const GEMINI_BRIDGE_SCRIPT: &str = include_str!("../../resources/gemini_bridge.py");

/// Checks whether the local Gemini Web bridge is alive.
pub fn is_gemini_bridge_alive() -> bool {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(500))
        .build()
        .ok();
    if let Some(c) = client {
        if let Ok(resp) = c.get(GEMINI_BRIDGE_HEALTH_URL).send() {
            return resp.status().is_success();
        }
    }
    false
}

/// Ensures the local Gemini Web bridge process is running.
pub fn ensure_gemini_bridge() -> Result<u16, String> {
    if is_gemini_bridge_alive() {
        return Ok(GEMINI_BRIDGE_PORT);
    }

    let bridge_dir = dirs::data_dir()
        .map(|d| d.join("xyz.block.buzz.app"))
        .unwrap_or_else(std::env::temp_dir);
    let _ = std::fs::create_dir_all(&bridge_dir);
    let bridge_path = bridge_dir.join("gemini_bridge.py");
    let _ = std::fs::write(&bridge_path, GEMINI_BRIDGE_SCRIPT);

    let python_candidates = [
        "python",
        "py",
        "python3",
        r"C:\Python313\python.exe",
        r"C:\Python312\python.exe",
        r"C:\Python311\python.exe",
    ];

    let mut spawned = false;
    for py in &python_candidates {
        let mut cmd = std::process::Command::new(py);
        cmd.arg(&bridge_path);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        cmd.stdin(std::process::Stdio::null());
        cmd.stdout(std::process::Stdio::null());
        cmd.stderr(std::process::Stdio::null());

        if let Ok(_) = cmd.spawn() {
            spawned = true;
            break;
        }
    }

    if !spawned {
        return Err("Python not found. Please install Python to run the Gemini Web bridge.".to_string());
    }

    let start = std::time::Instant::now();
    while start.elapsed() < Duration::from_secs(3) {
        if is_gemini_bridge_alive() {
            eprintln!("buzz-desktop: gemini web bridge is running on 127.0.0.1:{GEMINI_BRIDGE_PORT}");
            return Ok(GEMINI_BRIDGE_PORT);
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    Ok(GEMINI_BRIDGE_PORT)
}

/// Tauri command to start or verify the local Gemini Web bridge.
#[tauri::command]
pub async fn start_gemini_bridge() -> Result<String, String> {
    tokio::task::spawn_blocking(ensure_gemini_bridge)
        .await
        .map_err(|e| e.to_string())?
        .map(|_| GEMINI_BRIDGE_BASE_URL.to_string())
}

