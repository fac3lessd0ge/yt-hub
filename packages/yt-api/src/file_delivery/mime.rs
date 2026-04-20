//! Extension → MIME map for downloads.
//! KEEP IN SYNC WITH: packages/yt-service/src/internalHttp/mimeTypes.ts

use std::path::Path;

pub fn mime_from_extension(filename: &str) -> &'static str {
    match Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
    {
        "mp3" => "audio/mpeg",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "m4a" => "audio/mp4",
        "ogg" | "oga" => "audio/ogg",
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "mkv" => "video/x-matroska",
        _ => "application/octet-stream",
    }
}
