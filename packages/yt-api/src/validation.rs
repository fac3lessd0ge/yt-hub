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
