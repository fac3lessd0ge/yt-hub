use url::Url;

const MAX_URL_LENGTH: usize = 2048;
const MAX_FORMAT_LENGTH: usize = 20;
const MAX_NAME_LENGTH: usize = 255;
const MAX_DESTINATION_LENGTH: usize = 1024;

const ALLOWED_HOSTS: &[&str] = &["youtube.com", "youtu.be"];

/// Strips `www.` and `m.` prefixes from a host string.
fn normalize_host(host: &str) -> &str {
    let h = host.strip_prefix("www.").unwrap_or(host);
    h.strip_prefix("m.").unwrap_or(h)
}

pub fn validate_youtube_url(input: &str) -> Result<(), String> {
    if input.is_empty() {
        return Err("URL must not be empty".to_string());
    }
    if input.len() > MAX_URL_LENGTH {
        return Err(format!("URL must not exceed {MAX_URL_LENGTH} characters"));
    }

    let parsed = Url::parse(input).map_err(|e| format!("Invalid URL: {e}"))?;

    match parsed.scheme() {
        "http" | "https" => {}
        scheme => return Err(format!("URL scheme must be http or https, got: {scheme}")),
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| "URL must have a host".to_string())?;

    let normalized = normalize_host(host);

    if !ALLOWED_HOSTS.contains(&normalized) {
        return Err(format!(
            "URL host must be youtube.com or youtu.be, got: {host}"
        ));
    }

    if normalized == "youtu.be" {
        // youtu.be/VIDEO_ID — path must have a video ID (length > 1 to exclude just "/")
        if parsed.path().len() <= 1 {
            return Err("youtu.be URL must include a video ID".to_string());
        }
    } else {
        // youtube.com: must be /watch?v=... or /shorts/VIDEO_ID
        let path = parsed.path();
        if path == "/watch" {
            let has_v = parsed.query_pairs().any(|(k, _)| k == "v");
            if !has_v {
                return Err("youtube.com/watch URL must include a ?v= parameter".to_string());
            }
        } else if let Some(video_id) = path.strip_prefix("/shorts/") {
            if video_id.is_empty() {
                return Err("youtube.com/shorts/ URL must include a video ID".to_string());
            }
        } else {
            return Err(
                "youtube.com URL must be /watch?v=... or /shorts/VIDEO_ID".to_string(),
            );
        }
    }

    Ok(())
}

pub fn validate_format(format: &str) -> Result<(), String> {
    if format.is_empty() {
        return Err("Format must not be empty".to_string());
    }
    if format.len() > MAX_FORMAT_LENGTH {
        return Err(format!(
            "Format must not exceed {MAX_FORMAT_LENGTH} characters"
        ));
    }
    Ok(())
}

pub fn validate_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Name must not be empty".to_string());
    }
    if name.len() > MAX_NAME_LENGTH {
        return Err(format!(
            "Name must not exceed {MAX_NAME_LENGTH} characters"
        ));
    }
    Ok(())
}

pub fn validate_filename(filename: &str) -> Result<(), String> {
    if filename.is_empty() {
        return Err("Filename must not be empty".to_string());
    }
    if filename.len() > MAX_NAME_LENGTH {
        return Err(format!(
            "Filename must not exceed {MAX_NAME_LENGTH} characters"
        ));
    }
    if filename.contains('\0') {
        return Err("Filename must not contain null bytes".to_string());
    }
    if filename.contains('/') || filename.contains('\\') {
        return Err("Filename must not contain path separators".to_string());
    }
    if filename.contains("..") {
        return Err("Filename must not contain path traversal sequences".to_string());
    }
    if filename.starts_with('.') {
        return Err("Filename must not start with a dot".to_string());
    }
    Ok(())
}

pub fn validate_destination(dest: &str) -> Result<(), String> {
    if dest.len() > MAX_DESTINATION_LENGTH {
        return Err(format!(
            "Destination must not exceed {MAX_DESTINATION_LENGTH} characters"
        ));
    }
    if dest.contains('\0') {
        return Err("Destination must not contain null bytes".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- validate_youtube_url ---

    #[test]
    fn url_empty_is_rejected() {
        let err = validate_youtube_url("").unwrap_err();
        assert!(err.contains("empty"), "expected 'empty' in: {err}");
    }

    #[test]
    fn url_too_long_is_rejected() {
        let long = format!("https://youtube.com/watch?v={}", "a".repeat(MAX_URL_LENGTH));
        assert!(validate_youtube_url(&long).is_err());
    }

    #[test]
    fn url_non_http_scheme_is_rejected() {
        let err = validate_youtube_url("ftp://youtube.com/watch?v=abc").unwrap_err();
        assert!(err.contains("http"), "expected mention of http in: {err}");
    }

    #[test]
    fn url_bad_host_is_rejected() {
        let err = validate_youtube_url("https://example.com/watch?v=abc").unwrap_err();
        assert!(
            err.contains("youtube.com") || err.contains("youtu.be"),
            "expected allowed host mention in: {err}"
        );
    }

    #[test]
    fn url_www_youtube_watch_is_valid() {
        assert!(validate_youtube_url("https://www.youtube.com/watch?v=abc").is_ok());
    }

    #[test]
    fn url_youtu_be_with_id_is_valid() {
        assert!(validate_youtube_url("https://youtu.be/abc123").is_ok());
    }

    #[test]
    fn url_youtu_be_without_id_is_rejected() {
        let err = validate_youtube_url("https://youtu.be/").unwrap_err();
        assert!(
            err.contains("video ID"),
            "expected 'video ID' in: {err}"
        );
    }

    #[test]
    fn url_shorts_is_valid() {
        assert!(validate_youtube_url("https://youtube.com/shorts/abc123").is_ok());
    }

    #[test]
    fn url_unknown_host_is_rejected() {
        assert!(validate_youtube_url("https://vimeo.com/123").is_err());
    }

    #[test]
    fn url_m_youtube_is_valid() {
        assert!(validate_youtube_url("https://m.youtube.com/watch?v=xyz").is_ok());
    }

    #[test]
    fn url_youtube_no_v_param_is_rejected() {
        assert!(validate_youtube_url("https://youtube.com/watch").is_err());
    }

    #[test]
    fn url_youtube_unknown_path_is_rejected() {
        assert!(validate_youtube_url("https://youtube.com/playlist?list=abc").is_err());
    }

    // --- validate_format ---

    #[test]
    fn format_empty_is_rejected() {
        let err = validate_format("").unwrap_err();
        assert!(err.contains("empty"), "expected 'empty' in: {err}");
    }

    #[test]
    fn format_too_long_is_rejected() {
        let long = "a".repeat(MAX_FORMAT_LENGTH + 1);
        assert!(validate_format(&long).is_err());
    }

    #[test]
    fn format_valid() {
        assert!(validate_format("mp4").is_ok());
    }

    // --- validate_name ---

    #[test]
    fn name_empty_is_rejected() {
        let err = validate_name("").unwrap_err();
        assert!(err.contains("empty"), "expected 'empty' in: {err}");
    }

    #[test]
    fn name_too_long_is_rejected() {
        let long = "a".repeat(MAX_NAME_LENGTH + 1);
        assert!(validate_name(&long).is_err());
    }

    #[test]
    fn name_valid() {
        assert!(validate_name("my-video").is_ok());
    }

    // --- validate_destination ---

    #[test]
    fn destination_too_long_is_rejected() {
        let long = "a".repeat(MAX_DESTINATION_LENGTH + 1);
        assert!(validate_destination(&long).is_err());
    }

    #[test]
    fn destination_null_byte_is_rejected() {
        let err = validate_destination("/tmp/foo\0bar").unwrap_err();
        assert!(
            err.contains("null"),
            "expected 'null' in: {err}"
        );
    }

    #[test]
    fn destination_valid() {
        assert!(validate_destination("/tmp/downloads").is_ok());
    }

    #[test]
    fn destination_empty_is_allowed() {
        assert!(validate_destination("").is_ok());
    }
}
