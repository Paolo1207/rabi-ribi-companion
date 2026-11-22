//! Read-only parser for Rabi-Ribi `.sav` files.
//!
//! Every offset below was checked against known in-game values on Story and
//! Speedrun saves (little-endian throughout):
//!
//!   0x80A0  HP                       int32
//!   0x80C0  MP                       f64, divide by 100
//!   0x8118  difficulty               int32  (0x9AFC holds a mirror copy)
//!   0x99A4  town / boss progression  int32
//!   0x99A8  chapter                  int32
//!   0x9B18  item completion %        int32
//!   0x9B1C  map completion %         int32
//!   0x9A2C  route: 0 Story, 1 Speedrun            int32
//!   0x11098 rules: 0 Standard, 1 Alternative      int32
//!
//! `0x11098` is the rule that was selected when the file was last SAVED. It is
//! not a permanent property of a playthrough: loading a save and choosing the
//! other rule, then saving, flips it (verified on a real save).
//!
//! Deliberately not interpreted (no evidence yet):
//!   * Difficulty indexes other than 0 (Casual), 3 (Hard), 4 (Hell)
//!   * Rule values other than 0/1 (Bunny Heaven / Bunny Extinction / ERINA 200%)
//!   * Route values other than 0/1
//!   * Whether HP / MP are current or maximum values
//!
//! Unknown values are returned as raw numbers with no label.

use serde::Serialize;
use std::fmt;
use std::fs::File;
use std::io::Read;
use std::path::Path;

/// Every save analysed so far is exactly this size.
pub const SAVE_SIZE: usize = 69_824;
/// First int32 of every analysed save.
const HEADER_VALUE: i32 = 2019;

mod offsets {
    pub const HEADER: usize = 0x0000;
    pub const HP: usize = 0x80A0;
    /// 8-byte little-endian double; the in-game MP is this value / 100.
    pub const MP: usize = 0x80C0;
    pub const DIFFICULTY: usize = 0x8118;
    pub const DIFFICULTY_MIRROR: usize = 0x9AFC;
    pub const TOWN_PROGRESS: usize = 0x99A4;
    pub const CHAPTER: usize = 0x99A8;
    pub const ITEM_PCT: usize = 0x9B18;
    pub const MAP_PCT: usize = 0x9B1C;
    pub const ROUTE: usize = 0x9A2C;
    pub const RULES: usize = 0x11098;
}

// ---------------------------------------------------------------- errors ---

#[derive(Debug)]
pub enum SaveParseError {
    NotASaveFile,
    Io(String),
    UnexpectedSize { expected: usize, actual: u64 },
    BadHeader { found: Option<i32> },
}

impl fmt::Display for SaveParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotASaveFile => write!(f, "not a .sav file"),
            Self::Io(e) => write!(f, "could not read save file: {e}"),
            Self::UnexpectedSize { expected, actual } => write!(
                f,
                "unexpected save size: expected {expected} bytes, found {actual}"
            ),
            Self::BadHeader { found } => write!(
                f,
                "unrecognised save header: expected {HEADER_VALUE}, found {found:?}"
            ),
        }
    }
}

impl std::error::Error for SaveParseError {}

// ----------------------------------------------------------------- types ---

/// A stored enum value plus its label, when (and only when) the value is verified.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LabeledValue {
    pub raw: Option<i32>,
    pub label: Option<&'static str>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DifficultyInfo {
    /// `None` if the two stored copies disagree or are invalid.
    pub raw: Option<i32>,
    /// Only verified indexes are labelled: 0 Casual, 3 Hard, 4 Hell.
    pub label: Option<&'static str>,
    pub copies_agree: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaythroughDetails {
    /// "Story Mode", "Story Mode 2", "Speedrun" or "Speedrun 2". `None` when
    /// either the route or the rules value is not a verified 0/1.
    pub mode: Option<&'static str>,
    /// 0x9A2C: Story / Speedrun.
    pub route: LabeledValue,
    /// 0x11098: Standard / Alternative as selected when last saved.
    pub rules: LabeledValue,
    pub chapter: Option<i32>,
    pub town_progress: Option<i32>,
    /// HP as stored. Not established whether this is current or maximum.
    pub hp: Option<i32>,
    /// MP as stored (double / 100). Not established whether this is current or maximum.
    pub mp: Option<f64>,
    pub map_completion: Option<u8>,
    pub item_completion: Option<u8>,
    pub difficulty: DifficultyInfo,
    /// Notes about anything unexpected that was skipped.
    pub warnings: Vec<String>,
}

// --------------------------------------------------------------- helpers ---

fn read_i32(buf: &[u8], offset: usize) -> Option<i32> {
    let end = offset.checked_add(4)?;
    let bytes: [u8; 4] = buf.get(offset..end)?.try_into().ok()?;
    Some(i32::from_le_bytes(bytes))
}

fn read_f64(buf: &[u8], offset: usize) -> Option<f64> {
    let end = offset.checked_add(8)?;
    let bytes: [u8; 8] = buf.get(offset..end)?.try_into().ok()?;
    Some(f64::from_le_bytes(bytes))
}

fn read_non_negative(
    buf: &[u8],
    offset: usize,
    name: &str,
    warnings: &mut Vec<String>,
) -> Option<i32> {
    match read_i32(buf, offset) {
        Some(v) if v >= 0 => Some(v),
        other => {
            warnings.push(format!("{name}: invalid value {other:?} at 0x{offset:X}"));
            None
        }
    }
}

fn read_percent(
    buf: &[u8],
    offset: usize,
    name: &str,
    warnings: &mut Vec<String>,
) -> Option<u8> {
    match read_i32(buf, offset) {
        Some(v) if (0..=100).contains(&v) => Some(v as u8),
        other => {
            warnings.push(format!("{name}: value {other:?} at 0x{offset:X} is not 0-100"));
            None
        }
    }
}

fn route_label(raw: i32) -> Option<&'static str> {
    match raw {
        0 => Some("Story"),
        1 => Some("Speedrun"),
        _ => None,
    }
}

fn rules_label(raw: i32) -> Option<&'static str> {
    match raw {
        0 => Some("Standard"),
        1 => Some("Alternative"),
        _ => None, // special modes are unverified: do not invent names
    }
}

fn difficulty_label(raw: i32) -> Option<&'static str> {
    match raw {
        0 => Some("Casual"),
        3 => Some("Hard"),
        4 => Some("Hell"),
        _ => None, // indexes 1, 2 and 5 are unverified
    }
}

/// Derived in-game style label. Only the four verified (route, rules) pairs
/// produce one.
pub fn mode_label(route: Option<i32>, rules: Option<i32>) -> Option<&'static str> {
    match (route, rules) {
        (Some(0), Some(0)) => Some("Story Mode"),
        (Some(0), Some(1)) => Some("Story Mode 2"),
        (Some(1), Some(0)) => Some("Speedrun"),
        (Some(1), Some(1)) => Some("Speedrun 2"),
        _ => None,
    }
}

// ---------------------------------------------------------------- parsing ---

/// Parse an in-memory save. Never panics: bad input is an `Err`, and individual
/// unreadable or out-of-range fields become `None` plus a warning.
pub fn parse_save_bytes(buf: &[u8]) -> Result<PlaythroughDetails, SaveParseError> {
    if buf.len() != SAVE_SIZE {
        return Err(SaveParseError::UnexpectedSize {
            expected: SAVE_SIZE,
            actual: buf.len() as u64,
        });
    }
    let header = read_i32(buf, offsets::HEADER);
    if header != Some(HEADER_VALUE) {
        return Err(SaveParseError::BadHeader { found: header });
    }

    let mut warnings = Vec::new();

    let route_raw = read_i32(buf, offsets::ROUTE);
    let route = LabeledValue { raw: route_raw, label: route_raw.and_then(route_label) };
    if route.label.is_none() {
        warnings.push(format!("route: unrecognised value {route_raw:?}"));
    }

    let rules_raw = read_i32(buf, offsets::RULES);
    let rules = LabeledValue { raw: rules_raw, label: rules_raw.and_then(rules_label) };
    if rules.label.is_none() {
        warnings.push(format!("rules: unrecognised value {rules_raw:?}"));
    }

    let primary = read_i32(buf, offsets::DIFFICULTY);
    let mirror = read_i32(buf, offsets::DIFFICULTY_MIRROR);
    let difficulty = match (primary, mirror) {
        (Some(a), Some(b)) if a == b && a >= 0 => DifficultyInfo {
            raw: Some(a),
            label: difficulty_label(a),
            copies_agree: true,
        },
        _ => {
            warnings.push(format!(
                "difficulty: copies at 0x{:X} and 0x{:X} disagree or are invalid ({primary:?} vs {mirror:?})",
                offsets::DIFFICULTY,
                offsets::DIFFICULTY_MIRROR
            ));
            DifficultyInfo { raw: None, label: None, copies_agree: false }
        }
    };

    let mp = match read_f64(buf, offsets::MP) {
        Some(v) if v.is_finite() && v >= 0.0 => Some(v / 100.0),
        other => {
            warnings.push(format!("mp: invalid value {other:?} at 0x{:X}", offsets::MP));
            None
        }
    };

    Ok(PlaythroughDetails {
        mode: mode_label(route_raw, rules_raw),
        route,
        rules,
        chapter: read_non_negative(buf, offsets::CHAPTER, "chapter", &mut warnings),
        town_progress: read_non_negative(buf, offsets::TOWN_PROGRESS, "town progress", &mut warnings),
        hp: read_non_negative(buf, offsets::HP, "hp", &mut warnings),
        mp,
        map_completion: read_percent(buf, offsets::MAP_PCT, "map completion", &mut warnings),
        item_completion: read_percent(buf, offsets::ITEM_PCT, "item completion", &mut warnings),
        difficulty,
        warnings,
    })
}

/// Read and parse a `.sav` file. The size is checked from metadata first so an
/// unexpectedly large file is never loaded into memory.
pub fn parse_save_file(path: &Path) -> Result<PlaythroughDetails, SaveParseError> {
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
    // +1 so a file that grew after the metadata check is detected, not truncated.
    (&mut file)
        .take(SAVE_SIZE as u64 + 1)
        .read_to_end(&mut buf)
        .map_err(|e| SaveParseError::Io(e.to_string()))?;

    parse_save_bytes(&buf)
}

// ---------------------------------------------------------- tauri command ---

/// Exposed to React. Errors are returned as plain strings.
#[tauri::command]
pub fn read_playthrough_details(path: String) -> Result<PlaythroughDetails, String> {
    parse_save_file(Path::new(&path)).map_err(|e| e.to_string())
}

// ------------------------------------------------------------------ tests ---

#[cfg(test)]
mod tests {
    use super::*;

    fn put_i32(buf: &mut [u8], offset: usize, value: i32) {
        buf[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }

    fn put_f64(buf: &mut [u8], offset: usize, value: f64) {
        buf[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
    }

    /// Synthetic save (no real save data) with the given verified field values.
    #[allow(clippy::too_many_arguments)]
    fn build(
        route: i32,
        rules: i32,
        chapter: i32,
        town: i32,
        difficulty: i32,
        hp: i32,
        mp: f64,
        map: i32,
        item: i32,
    ) -> Vec<u8> {
        let mut b = vec![0u8; SAVE_SIZE];
        put_i32(&mut b, offsets::HEADER, HEADER_VALUE);
        put_i32(&mut b, offsets::ROUTE, route);
        put_i32(&mut b, offsets::RULES, rules);
        put_i32(&mut b, offsets::CHAPTER, chapter);
        put_i32(&mut b, offsets::TOWN_PROGRESS, town);
        put_i32(&mut b, offsets::DIFFICULTY, difficulty);
        put_i32(&mut b, offsets::DIFFICULTY_MIRROR, difficulty);
        put_i32(&mut b, offsets::HP, hp);
        put_f64(&mut b, offsets::MP, mp * 100.0);
        put_i32(&mut b, offsets::MAP_PCT, map);
        put_i32(&mut b, offsets::ITEM_PCT, item);
        b
    }

    fn story() -> Vec<u8> {
        build(0, 0, 4, 10, 4, 60, 40.0, 30, 0)
    }

    #[test]
    fn all_four_modes_are_detected_from_the_two_fields() {
        for (route, rules, expected) in [
            (0, 0, "Story Mode"),
            (0, 1, "Story Mode 2"),
            (1, 0, "Speedrun"),
            (1, 1, "Speedrun 2"),
        ] {
            let d = parse_save_bytes(&build(route, rules, 1, 1, 3, 100, 50.0, 0, 0)).unwrap();
            assert_eq!(d.mode, Some(expected));
            assert!(d.warnings.is_empty());
        }
    }

    #[test]
    fn known_in_game_values_decode_correctly() {
        // (route, rules, chapter, town, difficulty, hp, mp, map, item, mode, difficulty label)
        let rows = [
            (0, 1, 10, 27, 3, 856, 228.0, 98, 96, "Story Mode 2", Some("Hard")),
            (0, 0, 10, 27, 3, 856, 228.0, 98, 96, "Story Mode", Some("Hard")),
            (0, 0, 10, 27, 3, 888, 282.0, 100, 98, "Story Mode", Some("Hard")),
            (0, 1, 4, 10, 4, 60, 40.0, 30, 0, "Story Mode 2", Some("Hell")),
            (1, 1, 1, 1, 4, 339, 85.0, 27, 35, "Speedrun 2", Some("Hell")),
            (1, 0, 9, 4, 0, 311, 100.0, 32, 47, "Speedrun", Some("Casual")),
        ];
        for (route, rules, ch, town, diff, hp, mp, map, item, mode, label) in rows {
            let d = parse_save_bytes(&build(route, rules, ch, town, diff, hp, mp, map, item)).unwrap();
            assert_eq!(d.mode, Some(mode));
            assert_eq!(d.chapter, Some(ch));
            assert_eq!(d.town_progress, Some(town));
            assert_eq!(d.difficulty.raw, Some(diff));
            assert_eq!(d.difficulty.label, label);
            assert_eq!(d.hp, Some(hp));
            assert_eq!(d.mp, Some(mp));
            assert_eq!(d.map_completion, Some(map as u8));
            assert_eq!(d.item_completion, Some(item as u8));
        }
    }

    #[test]
    fn rules_labels_and_unknown_rules_value() {
        let d = parse_save_bytes(&build(0, 1, 1, 1, 3, 1, 1.0, 0, 0)).unwrap();
        assert_eq!(d.rules.label, Some("Alternative"));
        let d = parse_save_bytes(&build(0, 2, 1, 1, 3, 1, 1.0, 0, 0)).unwrap();
        assert_eq!(d.rules.raw, Some(2));
        assert_eq!(d.rules.label, None);
        assert_eq!(d.mode, None);
        assert!(!d.warnings.is_empty());
    }

    #[test]
    fn unknown_route_value_has_no_label_or_mode() {
        let d = parse_save_bytes(&build(5, 0, 1, 1, 3, 1, 1.0, 0, 0)).unwrap();
        assert_eq!(d.route.raw, Some(5));
        assert_eq!(d.route.label, None);
        assert_eq!(d.mode, None);
        assert!(!d.warnings.is_empty());
    }

    #[test]
    fn mp_is_a_little_endian_double_divided_by_100() {
        // 22800.0 = 00 00 00 00 00 44 D6 40 (little-endian) -> MP 228
        let mut b = story();
        b[offsets::MP..offsets::MP + 8]
            .copy_from_slice(&[0x00, 0x00, 0x00, 0x00, 0x00, 0x44, 0xD6, 0x40]);
        assert_eq!(parse_save_bytes(&b).unwrap().mp, Some(228.0));
    }

    #[test]
    fn invalid_mp_becomes_none_with_warning() {
        for bad in [f64::NAN, f64::INFINITY, -5.0] {
            let mut b = story();
            put_f64(&mut b, offsets::MP, bad);
            let d = parse_save_bytes(&b).unwrap();
            assert_eq!(d.mp, None);
            assert!(!d.warnings.is_empty());
        }
    }

    #[test]
    fn only_verified_difficulty_indexes_get_labels() {
        for (idx, label) in [(0, Some("Casual")), (1, None), (2, None), (3, Some("Hard")), (4, Some("Hell")), (5, None), (9, None)] {
            let d = parse_save_bytes(&build(0, 0, 1, 1, idx, 1, 1.0, 0, 0)).unwrap();
            assert_eq!(d.difficulty.raw, Some(idx));
            assert_eq!(d.difficulty.label, label);
        }
    }

    #[test]
    fn disagreeing_difficulty_copies_give_none() {
        let mut b = story();
        put_i32(&mut b, offsets::DIFFICULTY_MIRROR, 3);
        let d = parse_save_bytes(&b).unwrap();
        assert_eq!(d.difficulty.raw, None);
        assert_eq!(d.difficulty.label, None);
        assert!(!d.difficulty.copies_agree);
        assert_eq!(d.hp, Some(60));
    }

    #[test]
    fn changing_only_the_rules_value_changes_only_rules_and_mode() {
        // Mirrors the real original/updated save1 comparison (0x11098: 1 -> 0).
        let original = parse_save_bytes(&build(0, 1, 10, 27, 3, 856, 228.0, 98, 96)).unwrap();
        let updated = parse_save_bytes(&build(0, 0, 10, 27, 3, 856, 228.0, 98, 96)).unwrap();
        assert_eq!(original.mode, Some("Story Mode 2"));
        assert_eq!(updated.mode, Some("Story Mode"));
        assert_eq!(original.hp, updated.hp);
        assert_eq!(original.mp, updated.mp);
        assert_eq!(original.difficulty, updated.difficulty);
        assert_ne!(original.rules, updated.rules);
    }

    #[test]
    fn out_of_range_values_become_none_with_warnings() {
        let mut b = story();
        put_i32(&mut b, offsets::MAP_PCT, 101);
        put_i32(&mut b, offsets::ITEM_PCT, -5);
        put_i32(&mut b, offsets::HP, -1);
        let d = parse_save_bytes(&b).unwrap();
        assert_eq!(d.map_completion, None);
        assert_eq!(d.item_completion, None);
        assert_eq!(d.hp, None);
        assert_eq!(d.warnings.len(), 3);
    }

    #[test]
    fn rejects_wrong_sizes_and_bad_header() {
        let b = story();
        assert!(matches!(
            parse_save_bytes(&b[..SAVE_SIZE - 1]),
            Err(SaveParseError::UnexpectedSize { .. })
        ));
        let mut big = b.clone();
        big.push(0);
        assert!(matches!(parse_save_bytes(&big), Err(SaveParseError::UnexpectedSize { .. })));
        assert!(matches!(parse_save_bytes(&[]), Err(SaveParseError::UnexpectedSize { .. })));
        let mut bad = b;
        put_i32(&mut bad, offsets::HEADER, 1234);
        assert!(matches!(
            parse_save_bytes(&bad),
            Err(SaveParseError::BadHeader { found: Some(1234) })
        ));
    }

    #[test]
    fn non_sav_extension_is_rejected_before_any_io() {
        assert!(matches!(
            parse_save_file(Path::new("save0.txt")),
            Err(SaveParseError::NotASaveFile)
        ));
    }

    /// Tests against REAL saves. Nothing is committed: put your own files in a
    /// git-ignored folder (default `src-tauri/tests/local_saves/`, or set the
    /// `RABI_SAVES_DIR` environment variable). Missing files are skipped.
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

        // file, mode, chapter, town, difficulty, hp, mp, map, item
        const EXPECTED: [(&str, &str, i32, i32, i32, i32, f64, u8, u8); 7] = [
            ("save0.sav", "Story Mode 2", 10, 27, 3, 856, 228.0, 98, 96),
            ("save1_original.sav", "Story Mode 2", 10, 27, 3, 856, 228.0, 98, 96),
            ("updated_save1.sav", "Story Mode", 10, 27, 3, 856, 228.0, 98, 96),
            ("save2.sav", "Story Mode", 10, 27, 3, 888, 282.0, 100, 98),
            ("save3.sav", "Story Mode 2", 4, 10, 4, 60, 40.0, 30, 0),
            ("save4.sav", "Speedrun 2", 1, 1, 4, 339, 85.0, 27, 35),
            ("save6.sav", "Speedrun", 9, 4, 0, 311, 100.0, 32, 47),
        ];

        #[test]
        fn real_saves_match_known_in_game_values() {
            let Some(dir) = dir() else {
                eprintln!("local_saves: no save directory found, skipping");
                return;
            };
            for (file, mode, ch, town, diff, hp, mp, map, item) in EXPECTED {
                let path = dir.join(file);
                if !path.exists() {
                    eprintln!("local_saves: {file} not found, skipping");
                    continue;
                }
                let d = parse_save_file(&path).unwrap_or_else(|e| panic!("{file}: {e}"));
                assert_eq!(d.mode, Some(mode), "{file} mode");
                assert_eq!(d.chapter, Some(ch), "{file} chapter");
                assert_eq!(d.town_progress, Some(town), "{file} town");
                assert_eq!(d.difficulty.raw, Some(diff), "{file} difficulty");
                assert_eq!(d.hp, Some(hp), "{file} hp");
                assert_eq!(d.mp, Some(mp), "{file} mp");
                assert_eq!(d.map_completion, Some(map), "{file} map");
                assert_eq!(d.item_completion, Some(item), "{file} item");
                assert!(d.warnings.is_empty(), "{file} warnings: {:?}", d.warnings);
            }
        }

        #[test]
        fn original_and_updated_save1_differ_only_in_rules() {
            let Some(dir) = dir() else { return };
            let (a, b) = (dir.join("save1_original.sav"), dir.join("updated_save1.sav"));
            if !a.exists() || !b.exists() {
                eprintln!("local_saves: save1 pair not found, skipping");
                return;
            }
            let (o, u) = (parse_save_file(&a).unwrap(), parse_save_file(&b).unwrap());
            assert_eq!(o.rules.raw, Some(1));
            assert_eq!(u.rules.raw, Some(0));
            assert_eq!(o.hp, u.hp);
            assert_eq!(o.mp, u.mp);
            assert_eq!(o.difficulty, u.difficulty);
            assert_eq!(o.chapter, u.chapter);
        }
    }
}
