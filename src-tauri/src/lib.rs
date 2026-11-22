
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use sysinfo::{ProcessesToUpdate, System};

mod save_parser;

const RABI_RIBI_EXE: &str =
    r"C:\Program Files (x86)\Steam\steamapps\common\Rabi-Ribi\rabiribi.exe";

const SAVE_FOLDER: &str =
    r"C:\Program Files (x86)\Steam\steamapps\common\Rabi-Ribi\save";

#[derive(Serialize)]
struct SaveSlot {
    slot: u32,
    file_name: String,
    path: String,
    last_modified: u64,
    thumbnail: Option<Vec<u8>>,
    game_mode: String,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Check whether Rabi-Ribi is currently running.
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

// Read both verified mode fields through the shared save parser.
fn detect_game_mode(path: &Path) -> String {
    match save_parser::parse_save_file(path) {
        Ok(details) => details.mode.unwrap_or("Unknown").to_string(),
        Err(_) => "Unknown".to_string(),
    }
}

// Find Rabi-Ribi save files and their thumbnails.
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

        // Only the autosave slot (0) has a thumbnail.
        let thumbnail = if slot_number == 0 {
            fs::read(image_path.join("save0_a.bmp")).ok()
        } else {
            None
        };

        let game_mode = detect_game_mode(&path);

        slots.push(SaveSlot {
            slot: slot_number,
            file_name: file_name.to_string(),
            path: path.to_string_lossy().into_owned(),
            last_modified,
            thumbnail,
            game_mode,
        });
    }

    // Autosave first, followed by manual slots in numeric order.
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
            get_save_slots,
            save_parser::read_playthrough_details
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
