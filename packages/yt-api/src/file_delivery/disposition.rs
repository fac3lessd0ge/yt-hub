//! RFC 6266-style Content-Disposition for downloads.
//! KEEP IN SYNC WITH: packages/yt-service/src/internalHttp/contentDisposition.ts

use axum::http::header::HeaderValue;

use crate::error::AppError;

pub fn attachment_header_value(filename: &str) -> Result<HeaderValue, AppError> {
    let ascii_filename: String = filename
        .chars()
        .map(|c| if c.is_ascii() { c } else { '_' })
        .collect();
    let encoded: String = filename
        .bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.' {
                format!("{}", b as char)
            } else {
                format!("%{b:02X}")
            }
        })
        .collect();
    let disposition = format!(
        "attachment; filename=\"{ascii_filename}\"; filename*=UTF-8''{encoded}"
    );
    disposition.parse().map_err(|_| {
        AppError::Validation("Invalid filename for Content-Disposition".to_string())
    })
}
