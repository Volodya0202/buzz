//! Native Gemini Web session capture and authentication flow.

use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

const GEMINI_LOGIN_WINDOW_LABEL: &str = "gemini-login";
const GEMINI_URL: &str = "https://gemini.google.com";

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

/// Check if active Gemini session cookies already exist in the webview storage.
#[tauri::command]
pub async fn get_gemini_cookies(app: AppHandle) -> Result<Option<GeminiSessionData>, String> {
    query_gemini_cookies(&app).await
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

    // Create the login webview window
    let login_window = WebviewWindowBuilder::new(
        &app,
        GEMINI_LOGIN_WINDOW_LABEL,
        WebviewUrl::External(target_url),
    )
    .title("Авторизация Google Gemini (Подписка Web)")
    .inner_size(960.0, 720.0)
    .min_inner_size(640.0, 480.0)
    .center()
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
