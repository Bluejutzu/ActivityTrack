fn main() {
    println!("cargo:rerun-if-env-changed=ACTIVITYTRACK_CONVEX_URL");
    println!("cargo:rerun-if-env-changed=ACTIVITYTRACK_INGEST_KEY");
    println!("cargo:rerun-if-env-changed=ACTIVITYTRACK_CLERK_PUBLISHABLE_KEY");
    tauri_build::build()
}
