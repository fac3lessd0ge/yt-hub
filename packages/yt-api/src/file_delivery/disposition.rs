//! RFC 6266 Content-Disposition for downloads.
//!
//! KEEP IN SYNC WITH: packages/yt-service/src/internalHttp/contentDisposition.ts
//! (the TS side delegates to the `content-disposition` npm package; we keep this
//! hand-rolled implementation for parity without adding a Rust dependency).
//!
//! Output format: `attachment; filename="<ascii fallback>"; filename*=UTF-8''<percent-encoded>`
//!
//! - `filename=` is the legacy field. RFC 6266 requires it to be ASCII, so any
//!   non-ASCII char in the input is replaced with `_`. Modern browsers ignore
//!   this field whenever `filename*` is present, so the lossy fallback is only
//!   visible to clients that do not implement RFC 5987 (very rare in 2026).
//! - `filename*=UTF-8''…` carries the original name percent-encoded (RFC 5987).
//!   Every byte except ASCII alphanumerics, `-`, `_` and `.` is encoded.

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ascii_filename_is_unchanged_in_both_fields() {
        let value = attachment_header_value("track.mp3").unwrap();
        let s = value.to_str().unwrap();
        assert_eq!(
            s,
            "attachment; filename=\"track.mp3\"; filename*=UTF-8''track.mp3"
        );
    }

    #[test]
    fn space_is_percent_encoded_in_starred_field() {
        let value = attachment_header_value("my song.mp3").unwrap();
        let s = value.to_str().unwrap();
        assert!(s.contains("filename=\"my song.mp3\""));
        assert!(s.contains("filename*=UTF-8''my%20song.mp3"));
    }

    #[test]
    fn non_ascii_replaced_with_underscore_in_legacy_field_and_percent_encoded_in_starred() {
        let value = attachment_header_value("Привет.mp3").unwrap();
        let s = value.to_str().unwrap();
        assert!(
            s.contains("filename=\"______.mp3\""),
            "expected ASCII fallback to underscore non-ASCII chars, got: {s}"
        );
        assert!(
            s.contains("filename*=UTF-8''%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82.mp3"),
            "expected UTF-8 percent-encoded starred field, got: {s}"
        );
    }

    #[test]
    fn special_ascii_chars_are_percent_encoded_in_starred_field() {
        let value = attachment_header_value("a&b=c.mp3").unwrap();
        let s = value.to_str().unwrap();
        assert!(s.contains("filename*=UTF-8''a%26b%3Dc.mp3"));
    }
}
