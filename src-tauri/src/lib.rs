
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use sysinfo::{ProcessesToUpdate, System};

const RABI_RIBI_EXE: &str =
    r"C:\Program Files (x86)\Steam\steamapps\common\Rabi-Ribi\rabiribi.exe";

const SAVE_FOLDER: &str =
    r"C:\Program Files (x86)\Steam\steamapps\common\Rabi-Ribi\save";

#[derive(Serialize)]
struct SaveSlot {
    slot: u32,
    file_name: String,
    last_modified: u64,
    thumbnail: Option<Vec<u8>>,
}

// Keep the original command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Check whether Rabi-Ribi is currently running
#[tauri::command]
fn check_rabi_ribi() -> bool {
    let mut system = System::new();

    system.refresh_processes(ProcessesToUpdate::All, true);

    system.processes().values().any(|process| {
        process.exe().is_some_and(|path| {
            path.to_string_lossy()
                .eq_ignore_ascii_case(RABI_RIBI_EXE)
        })
    })
}

// Find Rabi-Ribi save files and their thumbnails
#[tauri::command]
fn get_save_slots() -> Result<Vec<SaveSlot>, String> {
    let save_path = PathBuf::from(SAVE_FOLDER);
    let image_path = save_path.join("image");

    let entries = fs::read_dir(&save_path)
        .map_err(|error| format!("Unable to read save folder: {}", error))?;

    let mut slots = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();

        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };

        let Some(slot_text) = file_name
            .strip_prefix("save")
            .and_then(|name| name.strip_suffix(".sav"))
        else {
            continue;
        };

        let Ok(slot_number) = slot_text.parse::<u32>() else {
            continue;
        };

        let metadata = fs::metadata(&path)
            .map_err(|error| format!("Unable to read {}: {}", file_name, error))?;

        let last_modified = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs())
            .unwrap_or(0);

        let thumbnail_file = image_path.join(format!("save{}_a.bmp", slot_number));

        let thumbnail = fs::read(&thumbnail_file).ok();

        slots.push(SaveSlot {
            slot: slot_number,
            file_name: file_name.to_string(),
            last_modified,
            thumbnail,
        });
    }

    slots.sort_by_key(|save| save.slot);

    Ok(slots)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            check_rabi_ribi,
            get_save_slots
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
