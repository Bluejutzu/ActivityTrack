fn main() {
    println!("cargo:rerun-if-env-changed=ACTIVITYTRACK_CONVEX_URL");
    println!("cargo:rerun-if-env-changed=ACTIVITYTRACK_API_URL");
    tauri_build::build()
}
