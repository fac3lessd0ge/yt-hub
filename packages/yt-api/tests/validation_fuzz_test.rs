use yt_api::validation;

#[test]
fn url_validation_never_panics_on_random_input() {
    let long_a = "a".repeat(10000);
    let inputs: &[&str] = &[
        "",
        " ",
        "\0",
        "\n\r",
        "null",
        &long_a,
        "https://",
        "http://",
        "ftp://youtube.com",
        "https://youtube.com",
        "https://youtube.com/",
        "https://youtube.com/watch",
        "https://youtube.com/watch?v=",
        "https://www.youtube.com/watch?v=abc&t=10",
        "https://youtu.be/",
        "https://youtu.be/abc",
        "https://m.youtube.com/watch?v=abc",
        "javascript:alert(1)",
        "data:text/html,<script>",
        "https://youtube.com.evil.com/watch?v=abc",
        "https://evil.com/youtube.com/watch?v=abc",
        "https://youtube.com/watch?v=abc/../../../etc/passwd",
        "https://youtube.com/shorts/",
        "https://youtube.com/shorts/abc",
        "\u{200B}https://youtube.com/watch?v=abc",
    ];
    for input in inputs {
        let _ = validation::validate_youtube_url(input);
    }
}

#[test]
fn filename_validation_never_panics() {
    let long_a = "a".repeat(1000);
    let inputs: &[&str] = &[
        "",
        " ",
        "\0",
        "a\0b",
        "../../../etc/passwd",
        &long_a,
        ".hidden",
        "..dotdot",
        "file/name",
        "file\\name",
        "file:name",
        "file*name",
        "file?name",
        "normal.mp3",
        "\u{007F}",
        "\u{0080}",
        "\u{540D}\u{524D}.mp3",
        "\u{1F3B5}music.mp3",
    ];
    for input in inputs {
        let _ = validation::validate_filename(input);
    }
}

#[test]
fn destination_validation_never_panics() {
    let long_a = "a".repeat(2000);
    let inputs: &[&str] = &[
        "",
        " ",
        "\0",
        "/valid/path",
        "relative/path",
        &long_a,
        "/path/../../../etc",
        "/path/with\0null",
        "/path\\backslash",
        "\\windows\\path",
        "/path/with spaces/ok",
    ];
    for input in inputs {
        let _ = validation::validate_destination(input);
    }
}

#[test]
fn url_validation_rejects_non_youtube_hosts() {
    let non_youtube = [
        "https://vimeo.com/123",
        "https://dailymotion.com/video/abc",
        "https://youtube.com.evil.com/watch?v=abc",
        "https://notyoutube.com/watch?v=abc",
        "https://youtu.be.evil.com/abc",
    ];
    for url in &non_youtube {
        assert!(
            validation::validate_youtube_url(url).is_err(),
            "should reject: {url}"
        );
    }
}

#[test]
fn url_validation_accepts_valid_youtube_urls() {
    let valid = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com/watch?v=abc123",
        "http://youtube.com/watch?v=abc",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=abc",
        "https://www.youtube.com/shorts/abc123",
    ];
    for url in &valid {
        assert!(
            validation::validate_youtube_url(url).is_ok(),
            "should accept: {url}"
        );
    }
}

#[test]
fn filename_validation_rejects_path_traversal() {
    let traversals = [
        "../etc/passwd",
        "foo/../bar",
        "..",
        "/absolute",
        "\\windows",
    ];
    for input in &traversals {
        assert!(
            validation::validate_filename(input).is_err(),
            "should reject: {input}"
        );
    }
}
