fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("cargo:rerun-if-changed=../yt-service/proto/yt_service.proto");
    tonic_build::configure()
        .build_server(false)
        .compile_protos(
            &["../yt-service/proto/yt_service.proto"],
            &["../yt-service/proto"],
        )?;
    Ok(())
}
