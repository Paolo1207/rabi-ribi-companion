
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

const AREA_FOLDER: &str =
    r"C:\Program Files (x86)\Steam\steamapps\common\Rabi-Ribi\data\area";

const COLLISION_OFFSET: usize = 0;
const MAP_WIDTH: usize = 500;
const MAP_HEIGHT: usize = 200;
const COLLISION_TILE_COUNT: usize = MAP_WIDTH * MAP_HEIGHT;
const TILES0_OFFSET: usize = 602_704;
const TILES1_OFFSET: usize = 802_704;
const TILES2_OFFSET: usize = 1_002_704;
const TILES3_OFFSET: usize = 1_202_704;
const TILES4_OFFSET: usize = 1_402_704;
const TILES5_OFFSET: usize = 1_602_704;
const TILES6_OFFSET: usize = 1_802_704;
const ROOMTYPE_OFFSET: usize = 400_000;
const ROOMTYPE_TILE_COUNT: usize = 450;
const ROOMCOLOR_OFFSET: usize = 400_900;
const ROOMCOLOR_TILE_COUNT: usize = 450;
const ROOMBG_OFFSET: usize = 401_800;
const ROOMBG_TILE_COUNT: usize = 450;
const GRAPHICS_TILE_COUNT: usize = 100_000;

#[derive(Serialize)]

pub struct MapData {
    pub width: usize,
    pub height: usize,
    pub collision: Vec<i16>,
    pub tiles0: Vec<i16>,
    pub tiles1: Vec<i16>,
    pub tiles2: Vec<i16>,
    pub tiles3: Vec<i16>,
    pub tiles4: Vec<i16>,
    pub tiles5: Vec<i16>,
    pub tiles6: Vec<i16>,
    pub roomtype: Vec<i16>,
    pub roomcolor: Vec<i16>,
    pub roombg: Vec<i16>,
}

#[derive(Serialize)]
pub struct MapFileInfo {
    pub file_name: String,
    pub file_size: usize,
    pub first_nonzero_offset: Option<usize>,
    pub nonzero_bytes: usize,
    pub zero_bytes: usize,
    pub first_nonzero_bytes: Option<String>,
}

/// Inspect a map file without modifying it.
pub fn inspect_map_file(file_name: &str) -> Result<MapFileInfo, String> {
    let valid_name = file_name
        .strip_prefix("area")
        .and_then(|name| name.strip_suffix(".map"))
        .and_then(|number| number.parse::<u32>().ok())
        .is_some();

    if !valid_name {
        return Err("Invalid map filename".to_string());
    }

    let path = PathBuf::from(AREA_FOLDER).join(file_name);
    let data = fs::read(&path)
        .map_err(|error| format!("Unable to read map file: {error}"))?;

    let first_nonzero_offset = data.iter().position(|&byte| byte != 0);

    let first_nonzero_bytes = first_nonzero_offset.map(|offset| {
        data.iter()
            .skip(offset)
            .take(48)
            .map(|byte| format!("{byte:02X}"))
            .collect::<Vec<_>>()
            .join(" ")
    });

    let nonzero_bytes = data.iter().filter(|&&byte| byte != 0).count();

    Ok(MapFileInfo {
        file_name: file_name.to_string(),
        file_size: data.len(),
        first_nonzero_offset,
        nonzero_bytes,
        zero_bytes: data.len() - nonzero_bytes,
        first_nonzero_bytes,
    })
}


/// Read the collision layer from an installed map file.
pub fn read_collision_layer(file_name: &str) -> Result<Vec<i16>, String> {
    let valid_name = file_name
        .strip_prefix("area")
        .and_then(|name| name.strip_suffix(".map"))
        .and_then(|number| number.parse::<u32>().ok())
        .is_some();

    if !valid_name {
        return Err("Invalid map filename".to_string());
    }

    let path = PathBuf::from(AREA_FOLDER).join(file_name);
    let data = fs::read(&path)
        .map_err(|error| format!("Unable to read map file: {error}"))?;

    let required_size = COLLISION_OFFSET + COLLISION_TILE_COUNT * 2;

    if data.len() < required_size {
        return Err("Map file is too small for the collision layer".to_string());
    }

    let collision = data[COLLISION_OFFSET..required_size]
        .chunks_exact(2)
        .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]))
        .collect();

    Ok(collision)
}

/// Read the first graphics layer from an installed map file.
pub fn read_tiles0_layer(file_name: &str) -> Result<Vec<i16>, String> {
    let valid_name = file_name
        .strip_prefix("area")
        .and_then(|name| name.strip_suffix(".map"))
        .and_then(|number| number.parse::<u32>().ok())
        .is_some();

    if !valid_name {
        return Err("Invalid map filename".to_string());
    }

    let path = PathBuf::from(AREA_FOLDER).join(file_name);
    let data = fs::read(&path)
        .map_err(|error| format!("Unable to read map file: {error}"))?;

    let required_size = TILES0_OFFSET + GRAPHICS_TILE_COUNT * 2;

    if data.len() < required_size {
        return Err("Map file is too small for the tiles0 layer".to_string());
    }

    let tiles = data[TILES0_OFFSET..required_size]
        .chunks_exact(2)
        .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]))
        .collect();

    Ok(tiles)
}

/// Read the second graphics layer from an installed map file.
pub fn read_tiles1_layer(file_name: &str) -> Result<Vec<i16>, String> {
    let valid_name = file_name
        .strip_prefix("area")
        .and_then(|name| name.strip_suffix(".map"))
        .and_then(|number| number.parse::<u32>().ok())
        .is_some();

    if !valid_name {
        return Err("Invalid map filename".to_string());
    }

    let path = PathBuf::from(AREA_FOLDER).join(file_name);
    let data = fs::read(&path)
        .map_err(|error| format!("Unable to read map file: {error}"))?;

    let required_size = TILES1_OFFSET + GRAPHICS_TILE_COUNT * 2;

    if data.len() < required_size {
        return Err("Map file is too small for the tiles1 layer".to_string());
    }

    let tiles = data[TILES1_OFFSET..required_size]
        .chunks_exact(2)
        .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]))
        .collect();

    Ok(tiles)
}

/// Read the third graphics layer from an installed map file.
pub fn read_tiles2_layer(file_name: &str) -> Result<Vec<i16>, String> {
    let valid_name = file_name
        .strip_prefix("area")
        .and_then(|name| name.strip_suffix(".map"))
        .and_then(|number| number.parse::<u32>().ok())
        .is_some();

    if !valid_name {
        return Err("Invalid map filename".to_string());
    }

    let path = PathBuf::from(AREA_FOLDER).join(file_name);
    let data = fs::read(&path)
        .map_err(|error| format!("Unable to read map file: {error}"))?;

    let required_size = TILES2_OFFSET + GRAPHICS_TILE_COUNT * 2;

    if data.len() < required_size {
        return Err("Map file is too small for the tiles2 layer".to_string());
    }

    let tiles = data[TILES2_OFFSET..required_size]
        .chunks_exact(2)
        .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]))
        .collect();

    Ok(tiles)
}

/// Read the fourth graphics layer from an installed map file.
pub fn read_tiles3_layer(file_name: &str) -> Result<Vec<i16>, String> {
    let valid_name = file_name
        .strip_prefix("area")
        .and_then(|name| name.strip_suffix(".map"))
        .and_then(|number| number.parse::<u32>().ok())
        .is_some();

    if !valid_name {
        return Err("Invalid map filename".to_string());
    }

    let path = PathBuf::from(AREA_FOLDER).join(file_name);
    let data = fs::read(&path)
        .map_err(|error| format!("Unable to read map file: {error}"))?;

    let required_size = TILES3_OFFSET + GRAPHICS_TILE_COUNT * 2;

    if data.len() < required_size {
        return Err("Map file is too small for the tiles3 layer".to_string());
    }

    let tiles = data[TILES3_OFFSET..required_size]
        .chunks_exact(2)
        .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]))
        .collect();

    Ok(tiles)
}

/// Read the fifth graphics layer from an installed map file.
pub fn read_tiles4_layer(file_name: &str) -> Result<Vec<i16>, String> {
    let valid_name = file_name
        .strip_prefix("area")
        .and_then(|name| name.strip_suffix(".map"))
        .and_then(|number| number.parse::<u32>().ok())
        .is_some();

    if !valid_name {
        return Err("Invalid map filename".to_string());
    }

    let path = PathBuf::from(AREA_FOLDER).join(file_name);
    let data = fs::read(&path)
        .map_err(|error| format!("Unable to read map file: {error}"))?;

    let required_size = TILES4_OFFSET + GRAPHICS_TILE_COUNT * 2;

    if data.len() < required_size {
        return Err("Map file is too small for the tiles4 layer".to_string());
    }

    let tiles = data[TILES4_OFFSET..required_size]
        .chunks_exact(2)
        .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]))
        .collect();

    Ok(tiles)
}

/// Read the sixth graphics layer from an installed map file.
pub fn read_tiles5_layer(file_name: &str) -> Result<Vec<i16>, String> {
    let valid_name = file_name
        .strip_prefix("area")
        .and_then(|name| name.strip_suffix(".map"))
        .and_then(|number| number.parse::<u32>().ok())
        .is_some();

    if !valid_name {
        return Err("Invalid map filename".to_string());
    }

    let path = PathBuf::from(AREA_FOLDER).join(file_name);
    let data = fs::read(&path)
        .map_err(|error| format!("Unable to read map file: {error}"))?;

    let required_size = TILES5_OFFSET + GRAPHICS_TILE_COUNT * 2;

    if data.len() < required_size {
        return Err("Map file is too small for the tiles5 layer".to_string());
    }

    let tiles = data[TILES5_OFFSET..required_size]
        .chunks_exact(2)
        .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]))
        .collect();

    Ok(tiles)
}

/// Read the seventh graphics layer from an installed map file.
pub fn read_tiles6_layer(file_name: &str) -> Result<Vec<i16>, String> {
    let valid_name = file_name
        .strip_prefix("area")
        .and_then(|name| name.strip_suffix(".map"))
        .and_then(|number| number.parse::<u32>().ok())
        .is_some();

    if !valid_name {
        return Err("Invalid map filename".to_string());
    }

    let path = PathBuf::from(AREA_FOLDER).join(file_name);
    let data = fs::read(&path)
        .map_err(|error| format!("Unable to read map file: {error}"))?;

    let required_size = TILES6_OFFSET + GRAPHICS_TILE_COUNT * 2;

    if data.len() < required_size {
        return Err("Map file is too small for the tiles6 layer".to_string());
    }

    let tiles = data[TILES6_OFFSET..required_size]
        .chunks_exact(2)
        .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]))
        .collect();

    Ok(tiles)
}

/// Read the room type layer from an installed map file.
pub fn read_roomtype_layer(file_name: &str) -> Result<Vec<i16>, String> {
    let valid_name = file_name
        .strip_prefix("area")
        .and_then(|name| name.strip_suffix(".map"))
        .and_then(|number| number.parse::<u32>().ok())
        .is_some();

    if !valid_name {
        return Err("Invalid map filename".to_string());
    }

    let path = PathBuf::from(AREA_FOLDER).join(file_name);
    let data = fs::read(&path)
        .map_err(|error| format!("Unable to read map file: {error}"))?;

    let required_size = ROOMTYPE_OFFSET + ROOMTYPE_TILE_COUNT * 2;

    if data.len() < required_size {
        return Err("Map file is too small for the roomtype layer".to_string());
    }

    let roomtype = data[ROOMTYPE_OFFSET..required_size]
        .chunks_exact(2)
        .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]))
        .collect();

    Ok(roomtype)
}

/// Read the room color layer from an installed map file.
pub fn read_roomcolor_layer(file_name: &str) -> Result<Vec<i16>, String> {
    let valid_name = file_name
        .strip_prefix("area")
        .and_then(|name| name.strip_suffix(".map"))
        .and_then(|number| number.parse::<u32>().ok())
        .is_some();

    if !valid_name {
        return Err("Invalid map filename".to_string());
    }

    let path = PathBuf::from(AREA_FOLDER).join(file_name);
    let data = fs::read(&path)
        .map_err(|error| format!("Unable to read map file: {error}"))?;

    let required_size = ROOMCOLOR_OFFSET + ROOMCOLOR_TILE_COUNT * 2;

    if data.len() < required_size {
        return Err("Map file is too small for the roomcolor layer".to_string());
    }

    let roomcolor = data[ROOMCOLOR_OFFSET..required_size]
        .chunks_exact(2)
        .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]))
        .collect();

    Ok(roomcolor)
}

/// Read the room background layer from an installed map file.
pub fn read_roombg_layer(file_name: &str) -> Result<Vec<i16>, String> {
    let valid_name = file_name
        .strip_prefix("area")
        .and_then(|name| name.strip_suffix(".map"))
        .and_then(|number| number.parse::<u32>().ok())
        .is_some();

    if !valid_name {
        return Err("Invalid map filename".to_string());
    }

    let path = PathBuf::from(AREA_FOLDER).join(file_name);
    let data = fs::read(&path)
        .map_err(|error| format!("Unable to read map file: {error}"))?;

    let required_size = ROOMBG_OFFSET + ROOMBG_TILE_COUNT * 2;

    if data.len() < required_size {
        return Err("Map file is too small for the roombg layer".to_string());
    }

    let roombg = data[ROOMBG_OFFSET..required_size]
        .chunks_exact(2)
        .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]))
        .collect();

    Ok(roombg)
}

/// Read all layers from an installed Rabi-Ribi map file.
pub fn read_map_data(file_name: &str) -> Result<MapData, String> {
    Ok(MapData {
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        collision: read_collision_layer(file_name)?,
        tiles0: read_tiles0_layer(file_name)?,
        tiles1: read_tiles1_layer(file_name)?,
        tiles2: read_tiles2_layer(file_name)?,
        tiles3: read_tiles3_layer(file_name)?,
        tiles4: read_tiles4_layer(file_name)?,
        tiles5: read_tiles5_layer(file_name)?,
        tiles6: read_tiles6_layer(file_name)?,
        roomtype: read_roomtype_layer(file_name)?,
        roomcolor: read_roomcolor_layer(file_name)?,
        roombg: read_roombg_layer(file_name)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inspect_installed_area0_map() {
        let result = inspect_map_file("area1.map");

        assert!(result.is_ok(), "Could not inspect area0.map: {:?}", result.err());

        let info = result.unwrap();

        println!("File: {}", info.file_name);
        println!("Size: {} bytes", info.file_size);
        println!("First nonzero offset: {:?}", info.first_nonzero_offset);
        println!("Nonzero bytes: {}", info.nonzero_bytes);
        println!("Zero bytes: {}", info.zero_bytes);
        println!("First nonzero bytes: {:?}", info.first_nonzero_bytes);

        assert!(info.file_size > 0);
    }
    #[test]
fn read_installed_area1_collision_layer() {
    let result = read_collision_layer("area1.map");

    assert!(
        result.is_ok(),
        "Could not read collision layer: {:?}",
        result.err()
    );

    let collision = result.unwrap();

    println!("Collision tile count: {}", collision.len());
    let nonzero_count = collision.iter().filter(|&&value| value != 0).count();

println!("Nonzero collision values: {}", nonzero_count);
println!("First 50 collision values: {:?}", &collision[..50]);
println!("Unique collision values: {:?}", {
    let mut values = collision.clone();
    values.sort_unstable();
    values.dedup();
    values
});

    assert_eq!(collision.len(), COLLISION_TILE_COUNT);
}

#[test]
fn read_installed_area1_tiles0_layer() {
    let result = read_tiles0_layer("area1.map");

    assert!(
        result.is_ok(),
        "Could not read tiles0 layer: {:?}",
        result.err()
    );

    let tiles = result.unwrap();

    let nonzero_count = tiles.iter().filter(|&&value| value != 0).count();

    println!("Tiles0 count: {}", tiles.len());
    println!("Nonzero tiles: {}", nonzero_count);
    let mut unique_tiles = tiles.clone();
unique_tiles.sort_unstable();
unique_tiles.dedup();

println!("Unique tiles0 count: {}", unique_tiles.len());
println!("First 100 unique tile IDs: {:?}", &unique_tiles[..100.min(unique_tiles.len())]);

    assert_eq!(tiles.len(), GRAPHICS_TILE_COUNT);
}

#[test]
fn read_installed_area1_tiles1_layer() {
    let result = read_tiles1_layer("area1.map");

    assert!(
        result.is_ok(),
        "Could not read tiles1 layer: {:?}",
        result.err()
    );

    let tiles = result.unwrap();

    let nonzero_count = tiles.iter().filter(|&&value| value != 0).count();

    let mut unique_tiles = tiles.clone();
    unique_tiles.sort_unstable();
    unique_tiles.dedup();

    println!("Tiles1 count: {}", tiles.len());
    println!("Nonzero tiles: {}", nonzero_count);
    println!("Unique tiles1 count: {}", unique_tiles.len());
    println!(
        "First 100 unique tile IDs: {:?}",
        &unique_tiles[..100.min(unique_tiles.len())]
    );

    assert_eq!(tiles.len(), GRAPHICS_TILE_COUNT);
}

#[test]
fn read_installed_area1_tiles2_layer() {
    let result = read_tiles2_layer("area1.map");

    assert!(
        result.is_ok(),
        "Could not read tiles2 layer: {:?}",
        result.err()
    );

    let tiles = result.unwrap();

    let nonzero_count = tiles.iter().filter(|&&value| value != 0).count();

    let mut unique_tiles = tiles.clone();
    unique_tiles.sort_unstable();
    unique_tiles.dedup();

    println!("Tiles2 count: {}", tiles.len());
    println!("Nonzero tiles: {}", nonzero_count);
    println!("Unique tiles2 count: {}", unique_tiles.len());
    println!(
        "First 100 unique tile IDs: {:?}",
        &unique_tiles[..100.min(unique_tiles.len())]
    );

    assert_eq!(tiles.len(), GRAPHICS_TILE_COUNT);
}

#[test]
fn read_installed_area1_tiles3_layer() {
    let result = read_tiles3_layer("area1.map");

    assert!(
        result.is_ok(),
        "Could not read tiles3 layer: {:?}",
        result.err()
    );

    let tiles = result.unwrap();

    let nonzero_count = tiles.iter().filter(|&&value| value != 0).count();

    let mut unique_tiles = tiles.clone();
    unique_tiles.sort_unstable();
    unique_tiles.dedup();

    println!("Tiles3 count: {}", tiles.len());
    println!("Nonzero tiles: {}", nonzero_count);
    println!("Unique tiles3 count: {}", unique_tiles.len());
    println!(
        "First 100 unique tile IDs: {:?}",
        &unique_tiles[..100.min(unique_tiles.len())]
    );

    assert_eq!(tiles.len(), GRAPHICS_TILE_COUNT);
}

#[test]
fn read_installed_area1_tiles4_layer() {
    let result = read_tiles4_layer("area1.map");

    assert!(
        result.is_ok(),
        "Could not read tiles4 layer: {:?}",
        result.err()
    );

    let tiles = result.unwrap();

    let nonzero_count = tiles.iter().filter(|&&value| value != 0).count();

    let mut unique_tiles = tiles.clone();
    unique_tiles.sort_unstable();
    unique_tiles.dedup();

    println!("Tiles4 count: {}", tiles.len());
    println!("Nonzero tiles: {}", nonzero_count);
    println!("Unique tiles4 count: {}", unique_tiles.len());
    println!(
        "First 100 unique tile IDs: {:?}",
        &unique_tiles[..100.min(unique_tiles.len())]
    );

    assert_eq!(tiles.len(), GRAPHICS_TILE_COUNT);
}

#[test]
fn read_installed_area1_tiles5_layer() {
    let result = read_tiles5_layer("area1.map");

    assert!(
        result.is_ok(),
        "Could not read tiles5 layer: {:?}",
        result.err()
    );

    let tiles = result.unwrap();

    let nonzero_count = tiles.iter().filter(|&&value| value != 0).count();

    let mut unique_tiles = tiles.clone();
    unique_tiles.sort_unstable();
    unique_tiles.dedup();

    println!("Tiles5 count: {}", tiles.len());
    println!("Nonzero tiles: {}", nonzero_count);
    println!("Unique tiles5 count: {}", unique_tiles.len());
    println!(
        "First 100 unique tile IDs: {:?}",
        &unique_tiles[..100.min(unique_tiles.len())]
    );

    assert_eq!(tiles.len(), GRAPHICS_TILE_COUNT);
}

#[test]
fn read_installed_area1_tiles6_layer() {
    let result = read_tiles6_layer("area1.map");

    assert!(
        result.is_ok(),
        "Could not read tiles6 layer: {:?}",
        result.err()
    );

    let tiles = result.unwrap();

    let nonzero_count = tiles.iter().filter(|&&value| value != 0).count();

    let mut unique_tiles = tiles.clone();
    unique_tiles.sort_unstable();
    unique_tiles.dedup();

    println!("Tiles6 count: {}", tiles.len());
    println!("Nonzero tiles: {}", nonzero_count);
    println!("Unique tiles6 count: {}", unique_tiles.len());
    println!(
        "First 100 unique tile IDs: {:?}",
        &unique_tiles[..100.min(unique_tiles.len())]
    );

    assert_eq!(tiles.len(), GRAPHICS_TILE_COUNT);
}

#[test]
fn read_installed_area1_roomtype_layer() {
    let result = read_roomtype_layer("area1.map");

    assert!(
        result.is_ok(),
        "Could not read roomtype layer: {:?}",
        result.err()
    );

    let roomtype = result.unwrap();

    let nonzero_count = roomtype.iter().filter(|&&value| value != 0).count();

    let mut unique_values = roomtype.clone();
    unique_values.sort_unstable();
    unique_values.dedup();

    println!("Roomtype count: {}", roomtype.len());
    println!("Nonzero room types: {}", nonzero_count);
    println!("Unique room types: {:?}", unique_values);

    assert_eq!(roomtype.len(), ROOMTYPE_TILE_COUNT);
}
#[test]
fn read_installed_area1_roomcolor_layer() {
    let result = read_roomcolor_layer("area1.map");

    assert!(
        result.is_ok(),
        "Could not read roomcolor layer: {:?}",
        result.err()
    );

    let roomcolor = result.unwrap();

    let nonzero_count = roomcolor.iter().filter(|&&value| value != 0).count();

    let mut unique_values = roomcolor.clone();
    unique_values.sort_unstable();
    unique_values.dedup();

    println!("Roomcolor count: {}", roomcolor.len());
    println!("Nonzero room colors: {}", nonzero_count);
    println!("Unique room colors: {:?}", unique_values);

    assert_eq!(roomcolor.len(), ROOMCOLOR_TILE_COUNT);
}

#[test]
fn read_installed_area1_roombg_layer() {
    let result = read_roombg_layer("area1.map");

    assert!(
        result.is_ok(),
        "Could not read roombg layer: {:?}",
        result.err()
    );

    let roombg = result.unwrap();

    let nonzero_count = roombg.iter().filter(|&&value| value != 0).count();

    let mut unique_values = roombg.clone();
    unique_values.sort_unstable();
    unique_values.dedup();

    println!("Roombg count: {}", roombg.len());
    println!("Nonzero room backgrounds: {}", nonzero_count);
    println!("Unique room backgrounds: {:?}", unique_values);

    assert_eq!(roombg.len(), ROOMBG_TILE_COUNT);
}

#[test]
fn read_installed_area1_complete_map() {
    let result = read_map_data("area1.map");

    assert!(
        result.is_ok(),
        "Could not read complete map: {:?}",
        result.err()
    );

    let map = result.unwrap();

    println!("Map dimensions: {} x {}", map.width, map.height);
    println!("Collision values: {}", map.collision.len());
    println!("Tiles0 values: {}", map.tiles0.len());
    println!("Tiles1 values: {}", map.tiles1.len());
    println!("Tiles2 values: {}", map.tiles2.len());
    println!("Tiles3 values: {}", map.tiles3.len());
    println!("Tiles4 values: {}", map.tiles4.len());
    println!("Tiles5 values: {}", map.tiles5.len());
    println!("Tiles6 values: {}", map.tiles6.len());
    println!("Roomtype values: {}", map.roomtype.len());
    println!("Roomcolor values: {}", map.roomcolor.len());
    println!("Roombg values: {}", map.roombg.len());

    assert_eq!(map.width, 500);
    assert_eq!(map.height, 200);
    assert_eq!(map.collision.len(), COLLISION_TILE_COUNT);
    assert_eq!(map.tiles0.len(), GRAPHICS_TILE_COUNT);
    assert_eq!(map.tiles1.len(), GRAPHICS_TILE_COUNT);
    assert_eq!(map.tiles2.len(), GRAPHICS_TILE_COUNT);
    assert_eq!(map.tiles3.len(), GRAPHICS_TILE_COUNT);
    assert_eq!(map.tiles4.len(), GRAPHICS_TILE_COUNT);
    assert_eq!(map.tiles5.len(), GRAPHICS_TILE_COUNT);
    assert_eq!(map.tiles6.len(), GRAPHICS_TILE_COUNT);
    assert_eq!(map.roomtype.len(), ROOMTYPE_TILE_COUNT);
    assert_eq!(map.roomcolor.len(), ROOMCOLOR_TILE_COUNT);
    assert_eq!(map.roombg.len(), ROOMBG_TILE_COUNT);
}

}
