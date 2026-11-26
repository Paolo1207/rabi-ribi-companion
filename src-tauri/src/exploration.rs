//! Read-only parser for the per-room exploration grid in Rabi-Ribi `.sav` files.
//!
//! What has been verified (against `save3.sav` and `area0.map` / `areaN.png`):
//!
//!   0x0004..0x4654  4,500 little-endian int32 values = 10 blocks x 450 entries
//!   block N         starts at 0x0004 + N * 0x708 and belongs to `areaN`
//!   one block       is a 25 x 18 room grid, `index = rx * 18 + ry`
//!                   (the same index as `roomtype` in the `.map` files)
//!   value 0         room not discovered (every discovered room checked so far
//!                   lies on a real room of the matching map)
//!   value != 0      room discovered
//!
//! NOT verified, so returned raw and never labelled: the extra bits in the
//! values 3, 7, 13 and 15. Do not treat them as save points, warp stones,
//! items or bosses until they have been confirmed with before/after saves.
//!
//! Block 0 <-> `area0.map` was checked against `roomtype`. Blocks 1..9 were only
//! checked against the rendered `areaN.png` files.

use crate::save_parser::{SaveParseError, SAVE_SIZE};
use serde::Serialize;
use std::fs::File;
use std::io::Read;
use std::path::Path;

/// First int32 of every analysed save (same value `save_parser` checks).
const HEADER_VALUE: i32 = 2019;

pub const EXPLORATION_OFFSET: usize = 0x0004;
pub const AREA_COUNT: usize = 10;
pub const ROOMS_X: usize = 25;
pub const ROOMS_Y: usize = 18;
pub const ROOMS_PER_AREA: usize = ROOMS_X * ROOMS_Y; // 450
const ENTRY_SIZE: usize = 4;
const EXPLORATION_END: usize = EXPLORATION_OFFSET + AREA_COUNT * ROOMS_PER_AREA * ENTRY_SIZE; // 0x4654

/// Index of room (rx, ry) inside one area block.
pub const fn room_index(rx: usize, ry: usize) -> usize {
    rx * ROOMS_Y + ry
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorationData {
    pub area_count: usize,
    pub rooms_x: usize,
    pub rooms_y: usize,
    /// `areas[area][rx * rooms_y + ry]`, raw values exactly as stored.
    pub areas: Vec<Vec<i32>>,
    /// Notes about anything unexpected (negative values, etc.).
    pub warnings: Vec<String>,
}

/// Parse an in-memory save. Never panics: bad input is an `Err`.
pub fn parse_exploration_bytes(buf: &[u8]) -> Result<ExplorationData, SaveParseError> {
    if buf.len() != SAVE_SIZE {
        return Err(SaveParseError::UnexpectedSize {
            expected: SAVE_SIZE,
            actual: buf.len() as u64,
        });
    }

    let header = buf
        .get(0..4)
        .and_then(|b| <[u8; 4]>::try_from(b).ok())
        .map(i32::from_le_bytes);
    if header != Some(HEADER_VALUE) {
        return Err(SaveParseError::BadHeader { found: header });
    }

    let mut warnings = Vec::new();
    let mut areas = Vec::with_capacity(AREA_COUNT);

    for area in 0..AREA_COUNT {
        let start = EXPLORATION_OFFSET + area * ROOMS_PER_AREA * ENTRY_SIZE;
        let end = start + ROOMS_PER_AREA * ENTRY_SIZE;
        // Cannot fail while SAVE_SIZE > EXPLORATION_END, but never index blindly.
        let Some(block) = buf.get(start..end) else {
            return Err(SaveParseError::UnexpectedSize {
                expected: EXPLORATION_END,
                actual: buf.len() as u64,
            });
        };

        let values: Vec<i32> = block
            .chunks_exact(ENTRY_SIZE)
            .map(|c| i32::from_le_bytes([c[0], c[1], c[2], c[3]]))
            .collect();

        let negatives = values.iter().filter(|&&v| v < 0).count();
        if negatives > 0 {
            warnings.push(format!(
                "area {area}: {negatives} negative exploration value(s) at 0x{start:X}"
            ));
        }
        areas.push(values);
    }

    Ok(ExplorationData {
        area_count: AREA_COUNT,
        rooms_x: ROOMS_X,
        rooms_y: ROOMS_Y,
        areas,
        warnings,
    })
}

/// Read and parse a `.sav` file. The size is checked from metadata first so an
/// unexpectedly large file is never loaded into memory.
pub fn parse_exploration_file(path: &Path) -> Result<ExplorationData, SaveParseError> {
    let is_sav = path
        .extension()
        .map_or(false, |e| e.eq_ignore_ascii_case("sav"));
    if !is_sav {
        return Err(SaveParseError::NotASaveFile);
    }

    let mut file = File::open(path).map_err(|e| SaveParseError::Io(e.to_string()))?;
    let len = file
        .metadata()
        .map_err(|e| SaveParseError::Io(e.to_string()))?
        .len();
    if len != SAVE_SIZE as u64 {
        return Err(SaveParseError::UnexpectedSize { expected: SAVE_SIZE, actual: len });
    }

    let mut buf = Vec::with_capacity(SAVE_SIZE);
    (&mut file)
        .take(SAVE_SIZE as u64 + 1)
        .read_to_end(&mut buf)
        .map_err(|e| SaveParseError::Io(e.to_string()))?;

    parse_exploration_bytes(&buf)
}

// ---------------------------------------------------------- tauri command ---

/// Exposed to React. Errors are returned as plain strings.
#[tauri::command]
pub fn read_exploration(path: String) -> Result<ExplorationData, String> {
    parse_exploration_file(Path::new(&path)).map_err(|e| e.to_string())
}

// ------------------------------------------------------------------ tests ---

#[cfg(test)]
mod tests {
    use super::*;

    fn blank() -> Vec<u8> {
        let mut b = vec![0u8; SAVE_SIZE];
        b[0..4].copy_from_slice(&HEADER_VALUE.to_le_bytes());
        b
    }

    fn put(buf: &mut [u8], area: usize, rx: usize, ry: usize, value: i32) {
        let off = EXPLORATION_OFFSET + (area * ROOMS_PER_AREA + room_index(rx, ry)) * ENTRY_SIZE;
        buf[off..off + 4].copy_from_slice(&value.to_le_bytes());
    }

    #[test]
    fn layout_constants_match_the_verified_format() {
        assert_eq!(ROOMS_PER_AREA, 450);
        assert_eq!(EXPLORATION_END, 0x4654);
        assert!(EXPLORATION_END <= SAVE_SIZE);
        assert_eq!(room_index(0, 0), 0);
        assert_eq!(room_index(10, 9), 189);
        assert_eq!(room_index(24, 17), 449);
    }

    #[test]
    fn values_land_in_the_expected_area_and_cell() {
        let mut b = blank();
        put(&mut b, 0, 10, 9, 15);
        put(&mut b, 5, 12, 15, 13);
        put(&mut b, 9, 24, 17, 1);
        let d = parse_exploration_bytes(&b).unwrap();
        assert_eq!(d.areas.len(), AREA_COUNT);
        assert!(d.areas.iter().all(|a| a.len() == ROOMS_PER_AREA));
        assert_eq!(d.areas[0][room_index(10, 9)], 15);
        assert_eq!(d.areas[5][room_index(12, 15)], 13);
        assert_eq!(d.areas[9][room_index(24, 17)], 1);
        assert_eq!(d.areas.iter().flatten().filter(|&&v| v != 0).count(), 3);
        assert!(d.warnings.is_empty());
    }

    #[test]
    fn first_and_last_entries_use_the_exact_section_bounds() {
        let mut b = blank();
        b[0x0004..0x0008].copy_from_slice(&1i32.to_le_bytes());
        b[0x4650..0x4654].copy_from_slice(&1i32.to_le_bytes());
        let d = parse_exploration_bytes(&b).unwrap();
        assert_eq!(d.areas[0][0], 1);
        assert_eq!(d.areas[9][ROOMS_PER_AREA - 1], 1);
    }

    #[test]
    fn negative_values_are_kept_and_warned_about() {
        let mut b = blank();
        put(&mut b, 2, 3, 4, -1);
        let d = parse_exploration_bytes(&b).unwrap();
        assert_eq!(d.areas[2][room_index(3, 4)], -1);
        assert_eq!(d.warnings.len(), 1);
    }

    #[test]
    fn rejects_wrong_sizes_and_bad_header() {
        let b = blank();
        assert!(matches!(
            parse_exploration_bytes(&b[..SAVE_SIZE - 1]),
            Err(SaveParseError::UnexpectedSize { .. })
        ));
        let mut big = b.clone();
        big.push(0);
        assert!(matches!(parse_exploration_bytes(&big), Err(SaveParseError::UnexpectedSize { .. })));
        assert!(matches!(parse_exploration_bytes(&[]), Err(SaveParseError::UnexpectedSize { .. })));
        let mut bad = b;
        bad[0..4].copy_from_slice(&1234i32.to_le_bytes());
        assert!(matches!(
            parse_exploration_bytes(&bad),
            Err(SaveParseError::BadHeader { found: Some(1234) })
        ));
    }

    #[test]
    fn non_sav_extension_is_rejected_before_any_io() {
        assert!(matches!(
            parse_exploration_file(Path::new("save0.txt")),
            Err(SaveParseError::NotASaveFile)
        ));
    }

    /// Tests against a REAL save. Nothing is committed: put your own files in the
    /// git-ignored folder `src-tauri/tests/local_saves/` (or set `RABI_SAVES_DIR`).
    /// Missing files are skipped.
    mod local_saves {
        use super::super::*;
        use std::path::PathBuf;

        fn dir() -> Option<PathBuf> {
            let dir = std::env::var_os("RABI_SAVES_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|| {
                    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests").join("local_saves")
                });
            dir.is_dir().then_some(dir)
        }

        #[test]
        fn save3_matches_the_values_found_during_analysis() {
            let Some(dir) = dir() else {
                eprintln!("local_saves: no save directory found, skipping");
                return;
            };
            let path = dir.join("save3.sav");
            if !path.exists() {
                eprintln!("local_saves: save3.sav not found, skipping");
                return;
            }
            let d = parse_exploration_file(&path).unwrap();

            // Discovered (nonzero) rooms per area, counted from the raw file.
            let counts: Vec<usize> = d
                .areas
                .iter()
                .map(|a| a.iter().filter(|&&v| v != 0).count())
                .collect();
            assert_eq!(counts, vec![80, 100, 107, 115, 69, 10, 0, 51, 32, 0]);
            assert_eq!(counts.iter().sum::<usize>(), 564);

            // Spot checks (area 0).
            assert_eq!(d.areas[0][room_index(10, 9)], 15);
            assert_eq!(d.areas[0][room_index(4, 8)], 1);
            assert_eq!(d.areas[0][room_index(7, 5)], 0); // room (7,5) is undiscovered
            assert_eq!(d.areas[5][room_index(15, 12)], 13);
            assert!(d.warnings.is_empty());
        }
    }
}
