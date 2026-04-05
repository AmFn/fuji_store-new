import path from 'node:path';
import fs from 'node:fs/promises';
import Database from 'better-sqlite3';

const DEFAULT_PAGE_SIZE = 120;
const MAX_PAGE_SIZE = 1000;
const SORTABLE_FIELDS = new Set(['created_at', 'updated_at', 'size', 'path', 'id']);

function normalizePath(inputPath) {
  const normalized = path.normalize(inputPath).replace(/\\/g, '/');
  if (process.platform === 'win32') {
    return normalized.toLowerCase();
  }
  return normalized;
}

function toIntBool(value) {
  return value ? 1 : 0;
}

function normalizeFolderParentId(value) {
  if (value === null || value === undefined || value === '' || value === '-1' || value === -1 || value === '0' || value === 0) {
    return -1;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : -1;
}

function normalizePhotoRecord(photo) {
  const now = Date.now();
  const folderIdRaw = photo.folder_id ?? photo.folderId ?? null;
  const folderId = folderIdRaw === null || folderIdRaw === undefined || folderIdRaw === '' ? null : Number(folderIdRaw);
  return {
    path: normalizePath(photo.path),
    hash: photo.hash ?? '',
    folder_id: Number.isFinite(folderId) ? folderId : null,
    size: Number(photo.size ?? 0),
    width: Number(photo.width ?? 0),
    height: Number(photo.height ?? 0),
    created_at: Number(photo.created_at ?? now),
    updated_at: Number(photo.updated_at ?? now),
    thumbnail_status: photo.thumbnail_status ?? 'pending',
    deleted: toIntBool(photo.deleted),
    // 富士相机参数
    film_mode: photo.film_mode ?? null,
    dynamic_range: photo.dynamic_range ?? null,
    color_chrome: photo.color_chrome ?? null,
    color_chrome_blue: photo.color_chrome_blue ?? null,
    color_chrome_red: photo.color_chrome_red ?? null,
    grain_effect: photo.grain_effect ?? null,
    grain_effect_rough: photo.grain_effect_rough ?? null,
    highlight_tone: photo.highlight_tone ?? null,
    shadow_tone: photo.shadow_tone ?? null,
    tone: photo.tone ?? null,
    color: photo.color ?? null,
    sharpness: photo.sharpness ?? null,
    clarity: photo.clarity ?? null,
    noise_reduction: photo.noise_reduction ?? null,
    high_iso_noise_reduction: photo.high_iso_noise_reduction ?? null,
    iso: photo.iso ?? null,
    aperture: photo.aperture ?? null,
    shutter_speed: photo.shutter_speed ?? null,
    exposure_compensation: photo.exposure_compensation ?? null,
    exposure_mode: photo.exposure_mode ?? null,
    metering_mode: photo.metering_mode ?? null,
    white_balance: photo.white_balance ?? null,
    white_balance_mode: photo.white_balance_mode ?? null,
    white_balance_temperature: photo.white_balance_temperature ?? null,
    white_balance_tint: photo.white_balance_tint ?? null,
    focus_mode: photo.focus_mode ?? null,
    focus_area: photo.focus_area ?? null,
    af_point: photo.af_point ?? null,
    flash_fired: photo.flash_fired ?? null,
    flash_mode: photo.flash_mode ?? null,
    lens_model: photo.lens_model ?? null,
    lens_make: photo.lens_make ?? null,
    focal_length: photo.focal_length ?? null,
    focal_length_35mm: photo.focal_length_35mm ?? null,
    camera_model: photo.camera_model ?? null,
    location: photo.location ?? null
  };
}

export class PhotoDatabase {
  static async create(dbPath) {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    const instance = new PhotoDatabase(dbPath);
    instance.#init();
    return instance;
  }

  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.stmts = {};
  }

  #init() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('cache_size = -64000');
    this.db.pragma('temp_store = memory');
    this.db.pragma('mmap_size = 268435456');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        hash TEXT NOT NULL,
        folder_id INTEGER,
        size INTEGER NOT NULL,
        width INTEGER NOT NULL DEFAULT 0,
        height INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        thumbnail_status TEXT NOT NULL DEFAULT 'pending',
        deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
        film_mode TEXT,
        dynamic_range TEXT,
        color_chrome TEXT,
        color_chrome_blue TEXT,
        color_chrome_red TEXT,
        grain_effect TEXT,
        grain_effect_rough TEXT,
        highlight_tone TEXT,
        shadow_tone TEXT,
        tone TEXT,
        color TEXT,
        sharpness TEXT,
        clarity TEXT,
        noise_reduction TEXT,
        high_iso_noise_reduction TEXT,
        iso INTEGER,
        aperture REAL,
        shutter_speed TEXT,
        exposure_compensation REAL,
        exposure_mode TEXT,
        metering_mode TEXT,
        white_balance TEXT,
        white_balance_mode TEXT,
        white_balance_temperature INTEGER,
        white_balance_tint REAL,
        focus_mode TEXT,
        focus_area TEXT,
        af_point TEXT,
        flash_fired INTEGER,
        flash_mode TEXT,
        lens_model TEXT,
        lens_make TEXT,
        focal_length REAL,
        focal_length_35mm INTEGER,
        camera_model TEXT,
        location TEXT
      );

      CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT,
        parent_id INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        folder_type TEXT NOT NULL DEFAULT 'logical' CHECK (folder_type IN ('physical', 'logical')),
        include_subfolders INTEGER NOT NULL DEFAULT 1 CHECK (include_subfolders IN (0, 1)),
        photo_count INTEGER NOT NULL DEFAULT 0,
        last_synced INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#3b82f6',
        owner_id TEXT NOT NULL DEFAULT 'local',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS photo_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(photo_id, tag_id),
        FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        film_mode TEXT,
        white_balance TEXT,
        dynamic_range TEXT,
        sharpness TEXT,
        saturation TEXT,
        contrast TEXT,
        clarity TEXT,
        shadow_tone TEXT,
        highlight_tone TEXT,
        noise_reduction TEXT,
        grain_effect TEXT,
        color_chrome_effect TEXT,
        color_chrome_effect_blue TEXT,
        color TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
        owner_id TEXT NOT NULL DEFAULT 'local',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS photo_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        photo_id INTEGER NOT NULL,
        recipe_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(photo_id, recipe_id),
        FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
      );

    `);

    this.#migrateLegacySchema();
    this.#detectCompatibility();
    this.#ensureIndexes();

    this.stmts.upsertPhoto = this.db.prepare(`
      INSERT INTO photos (
        path, hash, folder_id, size, width, height, created_at, updated_at, thumbnail_status, deleted,
        film_mode, dynamic_range, color_chrome, color_chrome_blue, color_chrome_red,
        grain_effect, grain_effect_rough, highlight_tone, shadow_tone, tone,
        color, sharpness, clarity, noise_reduction, high_iso_noise_reduction,
        iso, aperture, shutter_speed, exposure_compensation, exposure_mode,
        metering_mode, white_balance, white_balance_mode, white_balance_temperature, white_balance_tint,
        focus_mode, focus_area, af_point, flash_fired, flash_mode,
        lens_model, lens_make, focal_length, focal_length_35mm, camera_model, location
      ) VALUES (
        @path, @hash, @folder_id, @size, @width, @height, @created_at, @updated_at, @thumbnail_status, @deleted,
        @film_mode, @dynamic_range, @color_chrome, @color_chrome_blue, @color_chrome_red,
        @grain_effect, @grain_effect_rough, @highlight_tone, @shadow_tone, @tone,
        @color, @sharpness, @clarity, @noise_reduction, @high_iso_noise_reduction,
        @iso, @aperture, @shutter_speed, @exposure_compensation, @exposure_mode,
        @metering_mode, @white_balance, @white_balance_mode, @white_balance_temperature, @white_balance_tint,
        @focus_mode, @focus_area, @af_point, @flash_fired, @flash_mode,
        @lens_model, @lens_make, @focal_length, @focal_length_35mm, @camera_model, @location
      )
      ON CONFLICT(path) DO UPDATE SET
        hash = excluded.hash,
        folder_id = COALESCE(excluded.folder_id, photos.folder_id),
        size = excluded.size,
        width = excluded.width,
        height = excluded.height,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        thumbnail_status = excluded.thumbnail_status,
        deleted = excluded.deleted,
        film_mode = excluded.film_mode,
        dynamic_range = excluded.dynamic_range,
        color_chrome = excluded.color_chrome,
        color_chrome_blue = excluded.color_chrome_blue,
        color_chrome_red = excluded.color_chrome_red,
        grain_effect = excluded.grain_effect,
        grain_effect_rough = excluded.grain_effect_rough,
        highlight_tone = excluded.highlight_tone,
        shadow_tone = excluded.shadow_tone,
        tone = excluded.tone,
        color = excluded.color,
        sharpness = excluded.sharpness,
        clarity = excluded.clarity,
        noise_reduction = excluded.noise_reduction,
        high_iso_noise_reduction = excluded.high_iso_noise_reduction,
        iso = excluded.iso,
        aperture = excluded.aperture,
        shutter_speed = excluded.shutter_speed,
        exposure_compensation = excluded.exposure_compensation,
        exposure_mode = excluded.exposure_mode,
        metering_mode = excluded.metering_mode,
        white_balance = excluded.white_balance,
        white_balance_mode = excluded.white_balance_mode,
        white_balance_temperature = excluded.white_balance_temperature,
        white_balance_tint = excluded.white_balance_tint,
        focus_mode = excluded.focus_mode,
        focus_area = excluded.focus_area,
        af_point = excluded.af_point,
        flash_fired = excluded.flash_fired,
        flash_mode = excluded.flash_mode,
        lens_model = excluded.lens_model,
        lens_make = excluded.lens_make,
        focal_length = excluded.focal_length,
        focal_length_35mm = excluded.focal_length_35mm,
        camera_model = excluded.camera_model,
        location = excluded.location
    `);

    this.stmts.getPhotoByPath = this.db.prepare(`
      SELECT id, path, hash, folder_id, size, width, height, created_at, updated_at, thumbnail_status, deleted,
        film_mode, dynamic_range, color_chrome, color_chrome_blue, color_chrome_red,
        grain_effect, grain_effect_rough, highlight_tone, shadow_tone, tone,
        color, sharpness, clarity, noise_reduction, high_iso_noise_reduction,
        iso, aperture, shutter_speed, exposure_compensation, exposure_mode,
        metering_mode, white_balance, white_balance_mode, white_balance_temperature, white_balance_tint,
        focus_mode, focus_area, af_point, flash_fired, flash_mode,
        lens_model, lens_make, focal_length, focal_length_35mm, camera_model, location
      FROM photos
      WHERE path = ?
    `);

    this.stmts.getPhotoByPaths = this.db.prepare(`
      SELECT path, hash, size, updated_at, deleted
      FROM photos
      WHERE path IN (SELECT value FROM json_each(?))
    `);

    this.stmts.getPhotosSql = `
      SELECT id, path, hash, folder_id, size, width, height, created_at, updated_at, thumbnail_status, deleted,
        film_mode, dynamic_range, color_chrome, color_chrome_blue, color_chrome_red,
        grain_effect, grain_effect_rough, highlight_tone, shadow_tone, tone,
        color, sharpness, clarity, noise_reduction, high_iso_noise_reduction,
        iso, aperture, shutter_speed, exposure_compensation, exposure_mode,
        metering_mode, white_balance, white_balance_mode, white_balance_temperature, white_balance_tint,
        focus_mode, focus_area, af_point, flash_fired, flash_mode,
        lens_model, lens_make, focal_length, focal_length_35mm, camera_model, location
      FROM photos
      WHERE deleted = @deleted
      ORDER BY __ORDER_FIELD__ __ORDER_DIRECTION__
      LIMIT @limit OFFSET @offset
    `;

    this.stmts.countPhotos = this.db.prepare(`
      SELECT COUNT(*) AS total
      FROM photos
      WHERE deleted = ?
    `);

    this.stmts.markDeleted = this.db.prepare(`
      UPDATE photos
      SET deleted = 1, updated_at = @updatedAt
      WHERE path = @path
    `);

    this.stmts.markAllDeletedByPaths = this.db.prepare(`
      UPDATE photos
      SET deleted = 1, updated_at = @updatedAt
      WHERE path IN (SELECT value FROM json_each(@pathsJson))
    `);

    this.stmts.updatePhotoByPath = this.db.prepare(`
      UPDATE photos
      SET
        hash = COALESCE(@hash, hash),
        folder_id = COALESCE(@folder_id, folder_id),
        size = COALESCE(@size, size),
        width = COALESCE(@width, width),
        height = COALESCE(@height, height),
        created_at = COALESCE(@created_at, created_at),
        updated_at = COALESCE(@updated_at, updated_at),
        thumbnail_status = COALESCE(@thumbnail_status, thumbnail_status),
        deleted = COALESCE(@deleted, deleted),
        film_mode = COALESCE(@film_mode, film_mode),
        dynamic_range = COALESCE(@dynamic_range, dynamic_range),
        color_chrome = COALESCE(@color_chrome, color_chrome),
        color_chrome_blue = COALESCE(@color_chrome_blue, color_chrome_blue),
        color_chrome_red = COALESCE(@color_chrome_red, color_chrome_red),
        grain_effect = COALESCE(@grain_effect, grain_effect),
        grain_effect_rough = COALESCE(@grain_effect_rough, grain_effect_rough),
        highlight_tone = COALESCE(@highlight_tone, highlight_tone),
        shadow_tone = COALESCE(@shadow_tone, shadow_tone),
        tone = COALESCE(@tone, tone),
        color = COALESCE(@color, color),
        sharpness = COALESCE(@sharpness, sharpness),
        clarity = COALESCE(@clarity, clarity),
        noise_reduction = COALESCE(@noise_reduction, noise_reduction),
        high_iso_noise_reduction = COALESCE(@high_iso_noise_reduction, high_iso_noise_reduction),
        iso = COALESCE(@iso, iso),
        aperture = COALESCE(@aperture, aperture),
        shutter_speed = COALESCE(@shutter_speed, shutter_speed),
        exposure_compensation = COALESCE(@exposure_compensation, exposure_compensation),
        exposure_mode = COALESCE(@exposure_mode, exposure_mode),
        metering_mode = COALESCE(@metering_mode, metering_mode),
        white_balance = COALESCE(@white_balance, white_balance),
        white_balance_mode = COALESCE(@white_balance_mode, white_balance_mode),
        white_balance_temperature = COALESCE(@white_balance_temperature, white_balance_temperature),
        white_balance_tint = COALESCE(@white_balance_tint, white_balance_tint),
        focus_mode = COALESCE(@focus_mode, focus_mode),
        focus_area = COALESCE(@focus_area, focus_area),
        af_point = COALESCE(@af_point, af_point),
        flash_fired = COALESCE(@flash_fired, flash_fired),
        flash_mode = COALESCE(@flash_mode, flash_mode),
        lens_model = COALESCE(@lens_model, lens_model),
        lens_make = COALESCE(@lens_make, lens_make),
        focal_length = COALESCE(@focal_length, focal_length),
        focal_length_35mm = COALESCE(@focal_length_35mm, focal_length_35mm),
        camera_model = COALESCE(@camera_model, camera_model),
        location = COALESCE(@location, location)
      WHERE path = @path
    `);

    this.stmts.updateThumbnailStatus = this.db.prepare(`
      UPDATE photos
      SET thumbnail_status = @status, updated_at = @updatedAt
      WHERE path = @path
    `);

    this.stmts.getAllActivePaths = this.db.prepare(`
      SELECT path
      FROM photos
      WHERE deleted = 0
    `);

    this.stmts.getRowsMissingOnDisk = this.db.prepare(`
      SELECT id, path
      FROM photos
      WHERE deleted = 0
    `);

    this.stmts.getTimelineGroupPage = this.db.prepare(`
      SELECT
        strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', 'localtime') AS day_key,
        MAX(created_at) AS latest_created_at,
        COUNT(*) AS photo_count
      FROM photos
      WHERE deleted = 0
      GROUP BY day_key
      ORDER BY latest_created_at DESC
      LIMIT ? OFFSET ?
    `);

    this.stmts.countTimelineGroups = this.db.prepare(`
      SELECT COUNT(*) AS total
      FROM (
        SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', 'localtime') AS day_key
        FROM photos
        WHERE deleted = 0
        GROUP BY day_key
      )
    `);

    this.stmts.getPhotosByDay = this.db.prepare(`
      SELECT id, path, hash, folder_id, size, width, height, created_at, updated_at, thumbnail_status, deleted
      FROM photos
      WHERE deleted = 0
        AND strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', 'localtime') = @dayKey
      ORDER BY created_at DESC
      LIMIT @limit OFFSET @offset
    `);

    this.stmts.countPhotosByDay = this.db.prepare(`
      SELECT COUNT(*) AS total
      FROM photos
      WHERE deleted = 0
        AND strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', 'localtime') = ?
    `);

    this.stmts.insertFolder = this.db.prepare(`
      INSERT INTO folders (
        name, path, parent_id, sort_order, folder_type, include_subfolders, photo_count, last_synced, created_at, updated_at
      )
      VALUES (
        @name, @path, @parent_id, @sort_order, @folder_type, @include_subfolders, @photo_count, @last_synced, @created_at, @updated_at
      )
    `);

    this.stmts.updateFolder = this.db.prepare(`
      UPDATE folders
      SET
        name = CASE WHEN @name IS NOT NULL THEN @name ELSE name END,
        path = CASE WHEN @path IS NOT NULL THEN @path ELSE path END,
        parent_id = CASE WHEN @set_parent_id = 1 THEN @parent_id ELSE parent_id END,
        sort_order = CASE WHEN @set_sort_order = 1 THEN @sort_order ELSE sort_order END,
        folder_type = CASE WHEN @folder_type IS NOT NULL THEN @folder_type ELSE folder_type END,
        include_subfolders = CASE WHEN @include_subfolders IS NOT NULL THEN @include_subfolders ELSE include_subfolders END,
        photo_count = CASE WHEN @photo_count IS NOT NULL THEN @photo_count ELSE photo_count END,
        last_synced = CASE WHEN @last_synced IS NOT NULL THEN @last_synced ELSE last_synced END,
        updated_at = @updated_at
      WHERE id = @id
    `);

    this.stmts.deleteFolder = this.db.prepare(`
      DELETE FROM folders WHERE id = ?
    `);

    this.stmts.getAllFolders = this.db.prepare(`
      SELECT
        id, name, path, parent_id, sort_order, folder_type, include_subfolders, photo_count, last_synced, created_at, updated_at
      FROM folders
      ORDER BY parent_id ASC, sort_order ASC, id ASC
    `);

    this.stmts.findPhysicalFolderByPath = this.db.prepare(`
      SELECT id
      FROM folders
      WHERE folder_type = 'physical' AND path = ?
      ORDER BY id ASC
      LIMIT 1
    `);

    this.stmts.findLogicalFolderByNameAndParent = this.db.prepare(`
      SELECT id
      FROM folders
      WHERE folder_type = 'logical'
        AND lower(name) = lower(?)
        AND IFNULL(parent_id, -1) = IFNULL(?, -1)
      ORDER BY id ASC
      LIMIT 1
    `);

    this.stmts.getMaxFolderSortOrderByParent = this.db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM folders
      WHERE parent_id = ?
    `);

    this.stmts.insertTag = this.db.prepare(`
      INSERT INTO tags (name, color, owner_id, created_at, updated_at)
      VALUES (@name, @color, @owner_id, @created_at, @updated_at)
      ON CONFLICT(name) DO UPDATE SET color = @color, updated_at = @updated_at
    `);

    this.stmts.updateTag = this.db.prepare(`
      UPDATE tags SET name = @name, color = @color, updated_at = @updated_at WHERE id = @id
    `);

    this.stmts.deleteTag = this.db.prepare(`DELETE FROM tags WHERE id = ?`);

    this.stmts.getTagById = this.db.prepare(`SELECT * FROM tags WHERE id = ?`);

    this.stmts.getTagByName = this.db.prepare(`SELECT * FROM tags WHERE name = ?`);

    this.stmts.getAllTags = this.db.prepare(`SELECT * FROM tags ORDER BY name ASC`);

    this.stmts.getTagsByOwner = this.db.prepare(`SELECT * FROM tags WHERE owner_id = ? ORDER BY name ASC`);

    this.stmts.insertPhotoTag = this.db.prepare(`
      INSERT OR IGNORE INTO photo_tags (photo_id, tag_id, created_at)
      VALUES (@photo_id, @tag_id, @created_at)
    `);

    this.stmts.deletePhotoTag = this.db.prepare(`
      DELETE FROM photo_tags WHERE photo_id = @photo_id AND tag_id = @tag_id
    `);

    this.stmts.deletePhotoTagsByPhoto = this.db.prepare(`
      DELETE FROM photo_tags WHERE photo_id = ?
    `);

    this.stmts.deletePhotoTagsByTag = this.db.prepare(`
      DELETE FROM photo_tags WHERE tag_id = ?
    `);

    this.stmts.getTagsByPhotoId = this.db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN photo_tags pt ON t.id = pt.tag_id
      WHERE pt.photo_id = ?
      ORDER BY t.name ASC
    `);

    this.stmts.getPhotosByTagId = this.db.prepare(`
      SELECT p.* FROM photos p
      INNER JOIN photo_tags pt ON p.id = pt.photo_id
      WHERE pt.tag_id = ? AND p.deleted = 0
      ORDER BY p.created_at DESC
    `);

    this.stmts.insertRecipe = this.db.prepare(`
      INSERT INTO recipes (
        name, description, film_mode, white_balance, dynamic_range, sharpness, saturation,
        contrast, clarity, shadow_tone, highlight_tone, noise_reduction, grain_effect,
        color_chrome_effect, color_chrome_effect_blue, color, is_favorite, owner_id, created_at, updated_at
      ) VALUES (
        @name, @description, @film_mode, @white_balance, @dynamic_range, @sharpness, @saturation,
        @contrast, @clarity, @shadow_tone, @highlight_tone, @noise_reduction, @grain_effect,
        @color_chrome_effect, @color_chrome_effect_blue, @color, @is_favorite, @owner_id, @created_at, @updated_at
      )
    `);

    this.stmts.updateRecipe = this.db.prepare(`
      UPDATE recipes SET
        name = @name, description = @description, film_mode = @film_mode, white_balance = @white_balance,
        dynamic_range = @dynamic_range, sharpness = @sharpness, saturation = @saturation,
        contrast = @contrast, clarity = @clarity, shadow_tone = @shadow_tone, highlight_tone = @highlight_tone,
        noise_reduction = @noise_reduction, grain_effect = @grain_effect,
        color_chrome_effect = @color_chrome_effect, color_chrome_effect_blue = @color_chrome_effect_blue,
        color = @color, is_favorite = @is_favorite, updated_at = @updated_at
      WHERE id = @id
    `);

    this.stmts.deleteRecipe = this.db.prepare(`DELETE FROM recipes WHERE id = ?`);

    this.stmts.getRecipeById = this.db.prepare(`SELECT * FROM recipes WHERE id = ?`);

    this.stmts.getAllRecipes = this.db.prepare(`SELECT * FROM recipes ORDER BY name ASC`);

    this.stmts.getRecipesByOwner = this.db.prepare(`SELECT * FROM recipes WHERE owner_id = ? ORDER BY name ASC`);

    this.stmts.insertPhotoRecipe = this.db.prepare(`
      INSERT OR IGNORE INTO photo_recipes (photo_id, recipe_id, created_at)
      VALUES (@photo_id, @recipe_id, @created_at)
    `);

    this.stmts.deletePhotoRecipe = this.db.prepare(`
      DELETE FROM photo_recipes WHERE photo_id = @photo_id AND recipe_id = @recipe_id
    `);

    this.stmts.deletePhotoRecipesByPhoto = this.db.prepare(`
      DELETE FROM photo_recipes WHERE photo_id = ?
    `);

    this.stmts.deletePhotoRecipesByRecipe = this.db.prepare(`
      DELETE FROM photo_recipes WHERE recipe_id = ?
    `);

    this.stmts.getRecipesByPhotoId = this.db.prepare(`
      SELECT r.* FROM recipes r
      INNER JOIN photo_recipes pr ON r.id = pr.recipe_id
      WHERE pr.photo_id = ?
      ORDER BY r.name ASC
    `);

    this.stmts.getPhotosByRecipeId = this.db.prepare(`
      SELECT p.* FROM photos p
      INNER JOIN photo_recipes pr ON p.id = pr.photo_id
      WHERE pr.recipe_id = ? AND p.deleted = 0
      ORDER BY p.created_at DESC
    `);

    this.#migrateTagsFromJson();
  }

  #detectCompatibility() {
    const photoCols = this.db.prepare("PRAGMA table_info(photos)").all();
    const set = new Set(photoCols.map((c) => c.name));
    this.compat = {
      hasTagsJson: set.has('tags_json'),
      hasMetadataJson: set.has('metadata_json'),
      hasFavorite: set.has('is_favorite'),
      hasHidden: set.has('is_hidden'),
      hasRating: set.has('rating'),
    };
  }

  #ensureIndexes() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_photos_path ON photos(path);
      CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_photos_hash ON photos(hash);
      CREATE INDEX IF NOT EXISTS idx_photos_updated_at ON photos(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_photos_deleted ON photos(deleted);
      CREATE INDEX IF NOT EXISTS idx_photos_folder_id ON photos(folder_id);
      CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
      CREATE INDEX IF NOT EXISTS idx_tags_owner_id ON tags(owner_id);
      CREATE INDEX IF NOT EXISTS idx_photo_tags_photo_id ON photo_tags(photo_id);
      CREATE INDEX IF NOT EXISTS idx_photo_tags_tag_id ON photo_tags(tag_id);
      CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes(name);
      CREATE INDEX IF NOT EXISTS idx_recipes_owner_id ON recipes(owner_id);
      CREATE INDEX IF NOT EXISTS idx_photo_recipes_photo_id ON photo_recipes(photo_id);
      CREATE INDEX IF NOT EXISTS idx_photo_recipes_recipe_id ON photo_recipes(recipe_id);
    `);

    const folderCols = this.db.prepare("PRAGMA table_info(folders)").all();
    const folderSet = new Set(folderCols.map((c) => c.name));
    if (folderSet.has('folder_type')) {
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_folders_type ON folders(folder_type)');
    }
    if (folderSet.has('parent_id')) {
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id)');
    }
    if (folderSet.has('sort_order')) {
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_folders_parent_sort ON folders(parent_id, sort_order)');
    }
    if (folderSet.has('path')) {
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path)');
    }
  }

  #migrateLegacySchema() {
    const folderColsBefore = this.db.prepare("PRAGMA table_info(folders)").all();
    if (folderColsBefore.length > 0) {
      const folderColSetBefore = new Set(folderColsBefore.map((c) => c.name));
      const folderFks = this.db.prepare('PRAGMA foreign_key_list(folders)').all();
      const hasParentForeignKey = folderFks.some((fk) => fk.from === 'parent_id');

      if (hasParentForeignKey) {
        const now = Date.now();
        const idExpr = folderColSetBefore.has('id') ? 'id' : 'NULL';
        const nameExpr = folderColSetBefore.has('name') ? 'name' : "''";
        const pathExpr = folderColSetBefore.has('path') ? 'path' : 'NULL';
        const parentExpr = folderColSetBefore.has('parent_id') ? 'COALESCE(NULLIF(parent_id, 0), -1)' : '-1';
        const typeExpr = folderColSetBefore.has('folder_type')
          ? "COALESCE(folder_type, CASE WHEN path IS NULL OR path = '' THEN 'logical' ELSE 'physical' END)"
          : "CASE WHEN path IS NULL OR path = '' THEN 'logical' ELSE 'physical' END";
        const includeExpr = folderColSetBefore.has('include_subfolders') ? 'COALESCE(include_subfolders, 1)' : '1';
        const photoCountExpr = folderColSetBefore.has('photo_count') ? 'COALESCE(photo_count, 0)' : '0';
        const lastSyncedExpr = folderColSetBefore.has('last_synced') ? 'last_synced' : 'NULL';
        const createdExpr = folderColSetBefore.has('created_at') ? `COALESCE(created_at, ${now})` : `${now}`;
        const updatedExpr = folderColSetBefore.has('updated_at') ? `COALESCE(updated_at, ${now})` : `${now}`;

        this.db.exec('PRAGMA foreign_keys = OFF');
        this.db.exec('BEGIN TRANSACTION');
        try {
          this.db.exec('ALTER TABLE folders RENAME TO folders__old');
          this.db.exec(`
            CREATE TABLE folders (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              path TEXT,
              parent_id INTEGER,
              sort_order INTEGER NOT NULL DEFAULT 0,
              folder_type TEXT NOT NULL DEFAULT 'logical' CHECK (folder_type IN ('physical', 'logical')),
              include_subfolders INTEGER NOT NULL DEFAULT 1 CHECK (include_subfolders IN (0, 1)),
              photo_count INTEGER NOT NULL DEFAULT 0,
              last_synced INTEGER,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
          `);
          this.db.exec(`
            INSERT INTO folders (
              id, name, path, parent_id, sort_order, folder_type, include_subfolders, photo_count, last_synced, created_at, updated_at
            )
            SELECT
              ${idExpr},
              ${nameExpr},
              ${pathExpr},
              ${parentExpr},
              0,
              ${typeExpr},
              ${includeExpr},
              ${photoCountExpr},
              ${lastSyncedExpr},
              ${createdExpr},
              ${updatedExpr}
            FROM folders__old
          `);
          this.db.exec('DROP TABLE folders__old');
          this.db.exec('PRAGMA foreign_keys = ON');
          this.db.exec('COMMIT');
        } catch (error) {
          this.db.exec('ROLLBACK');
          throw error;
        } finally {
          this.db.exec('PRAGMA foreign_keys = ON');
        }
      }
    }

    const photoCols = this.db.prepare("PRAGMA table_info(photos)").all();
    const photoSet = new Set(photoCols.map((c) => c.name));

    if (!photoSet.has('deleted')) {
      this.db.exec('ALTER TABLE photos ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0');
      if (photoSet.has('is_deleted')) {
        this.db.exec('UPDATE photos SET deleted = COALESCE(is_deleted, 0)');
      }
    }
    if (!photoSet.has('thumbnail_status')) {
      this.db.exec("ALTER TABLE photos ADD COLUMN thumbnail_status TEXT NOT NULL DEFAULT 'pending'");
    }
    if (!photoSet.has('tags_json')) {
      this.db.exec("ALTER TABLE photos ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'");
    }
    if (!photoSet.has('metadata_json')) {
      this.db.exec("ALTER TABLE photos ADD COLUMN metadata_json TEXT DEFAULT '{}'");
    }
    if (!photoSet.has('is_favorite')) {
      this.db.exec('ALTER TABLE photos ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0');
    }
    if (!photoSet.has('is_hidden')) {
      this.db.exec('ALTER TABLE photos ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0');
    }
    if (!photoSet.has('rating')) {
      this.db.exec('ALTER TABLE photos ADD COLUMN rating INTEGER NOT NULL DEFAULT 0');
    }
    if (!photoSet.has('width')) {
      this.db.exec('ALTER TABLE photos ADD COLUMN width INTEGER NOT NULL DEFAULT 0');
    }
    if (!photoSet.has('height')) {
      this.db.exec('ALTER TABLE photos ADD COLUMN height INTEGER NOT NULL DEFAULT 0');
    }
    if (!photoSet.has('folder_id')) {
      this.db.exec('ALTER TABLE photos ADD COLUMN folder_id INTEGER');
    }

    // 添加富士相机参数相关的列
    const fujiColumns = [
      'film_mode TEXT',
      'dynamic_range TEXT',
      'color_chrome TEXT',
      'color_chrome_blue TEXT',
      'color_chrome_red TEXT',
      'grain_effect TEXT',
      'grain_effect_rough TEXT',
      'highlight_tone TEXT',
      'shadow_tone TEXT',
      'tone TEXT',
      'color TEXT',
      'sharpness TEXT',
      'clarity TEXT',
      'noise_reduction TEXT',
      'high_iso_noise_reduction TEXT',
      'iso INTEGER',
      'aperture REAL',
      'shutter_speed TEXT',
      'exposure_compensation REAL',
      'exposure_mode TEXT',
      'metering_mode TEXT',
      'white_balance TEXT',
      'white_balance_mode TEXT',
      'white_balance_temperature INTEGER',
      'white_balance_tint REAL',
      'focus_mode TEXT',
      'focus_area TEXT',
      'af_point TEXT',
      'flash_fired INTEGER',
      'flash_mode TEXT',
      'lens_model TEXT',
      'lens_make TEXT',
      'focal_length REAL',
      'focal_length_35mm INTEGER',
      'camera_model TEXT',
      'location TEXT'
    ];

    for (const columnDef of fujiColumns) {
      const columnName = columnDef.split(' ')[0];
      if (!photoSet.has(columnName)) {
        this.db.exec(`ALTER TABLE photos ADD COLUMN ${columnDef}`);
      }
    }

    const folderCols = this.db.prepare("PRAGMA table_info(folders)").all();
    const folderSet = new Set(folderCols.map((c) => c.name));
    if (folderSet.size > 0) {
      if (folderSet.has('parent_id')) {
        // 统一根目录语义：-1 代表根目录
        this.db.exec('UPDATE folders SET parent_id = -1 WHERE parent_id IS NULL OR parent_id = 0');
      }
      if (!folderSet.has('folder_type')) {
        this.db.exec("ALTER TABLE folders ADD COLUMN folder_type TEXT NOT NULL DEFAULT 'logical'");
        if (folderSet.has('path')) {
          this.db.exec("UPDATE folders SET folder_type = CASE WHEN path IS NULL OR path = '' THEN 'logical' ELSE 'physical' END");
        }
      }
      if (!folderSet.has('sort_order')) {
        this.db.exec('ALTER TABLE folders ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
      }
      if (!folderSet.has('include_subfolders')) {
        this.db.exec('ALTER TABLE folders ADD COLUMN include_subfolders INTEGER NOT NULL DEFAULT 1');
      }
      if (!folderSet.has('photo_count')) {
        this.db.exec('ALTER TABLE folders ADD COLUMN photo_count INTEGER NOT NULL DEFAULT 0');
      }
      if (!folderSet.has('last_synced')) {
        this.db.exec('ALTER TABLE folders ADD COLUMN last_synced INTEGER');
      }
      if (!folderSet.has('created_at')) {
        this.db.exec(`ALTER TABLE folders ADD COLUMN created_at INTEGER NOT NULL DEFAULT ${Date.now()}`);
      }
      if (!folderSet.has('updated_at')) {
        this.db.exec(`ALTER TABLE folders ADD COLUMN updated_at INTEGER NOT NULL DEFAULT ${Date.now()}`);
      }
    }
  }

  #migrateTagsFromJson() {
    const tagsTableExists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'").get();
    if (!tagsTableExists) return;

    const photoTagsTableExists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='photo_tags'").get();
    if (!photoTagsTableExists) return;

    const migrationKey = 'tags_json_migrated';
    const migrationDone = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_flags'").get();
    
    if (!migrationDone) {
      this.db.exec(`CREATE TABLE IF NOT EXISTS schema_flags (key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 1)`);
    }

    const alreadyMigrated = this.db.prepare("SELECT value FROM schema_flags WHERE key = ?").get(migrationKey);
    if (alreadyMigrated) return;

    console.log('[DB] Migrating tags from tags_json to tags table...');
    
    const photos = this.db.prepare("SELECT id, tags_json FROM photos WHERE tags_json IS NOT NULL AND tags_json != '[]'").all();
    const now = Date.now();
    
    const migrate = this.db.transaction(() => {
      for (const photo of photos) {
        try {
          const tags = JSON.parse(photo.tags_json || '[]');
          if (!Array.isArray(tags)) continue;
          
          for (const tagName of tags) {
            if (typeof tagName !== 'string' || !tagName.trim()) continue;
            
            const trimmedName = tagName.trim();
            
            this.stmts.insertTag.run({
              name: trimmedName,
              color: '#3b82f6',
              owner_id: 'local',
              created_at: now,
              updated_at: now,
            });
            
            const tag = this.stmts.getTagByName.get(trimmedName);
            if (tag && photo.id) {
              this.stmts.insertPhotoTag.run({
                photo_id: photo.id,
                tag_id: tag.id,
                created_at: now,
              });
            }
          }
        } catch (e) {
          // ignore parse errors
        }
      }
      
      this.db.prepare("INSERT OR REPLACE INTO schema_flags (key, value) VALUES (?, 1)").run(migrationKey);
    });
    
    migrate();
    console.log(`[DB] Migrated tags from ${photos.length} photos`);
  }

  async upsertPhoto(photo) {
    const payload = normalizePhotoRecord(photo);
    this.stmts.upsertPhoto.run(payload);
    return payload.path;
  }

  async upsertPhotosBatch(photos) {
    if (!Array.isArray(photos) || photos.length === 0) {
      return 0;
    }

    const write = this.db.transaction((items) => {
      for (const item of items) {
        this.stmts.upsertPhoto.run(normalizePhotoRecord(item));
      }
      return items.length;
    });

    return write(photos);
  }

  async getPhotoByPath(filePath) {
    return this.stmts.getPhotoByPath.get(normalizePath(filePath)) ?? null;
  }

  async getPhotoSignaturesByPaths(paths) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return new Map();
    }

    const normalizedPaths = paths.map(normalizePath);
    const rows = this.stmts.getPhotoByPaths.all(JSON.stringify(normalizedPaths));
    const map = new Map();
    for (const row of rows) {
      map.set(row.path, row);
    }
    return map;
  }

  async getPhotos(page = 1, pageSize = DEFAULT_PAGE_SIZE, options = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE));
    const includeDeleted = Boolean(options.includeDeleted);
    const sortBy = SORTABLE_FIELDS.has(options.sortBy) ? options.sortBy : 'created_at';
    const sortDirection = String(options.sortDirection || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sql = this.stmts.getPhotosSql
      .replace('__ORDER_FIELD__', sortBy)
      .replace('__ORDER_DIRECTION__', sortDirection);
    
    // 打印SQL语句
    console.log('SQL Query:', sql);
    console.log('Parameters:', {
      deleted: includeDeleted ? 1 : 0,
      limit: safePageSize,
      offset: (safePage - 1) * safePageSize,
    });
    
    const stmt = this.db.prepare(sql);

    const rows = stmt.all({
      deleted: includeDeleted ? 1 : 0,
      limit: safePageSize,
      offset: (safePage - 1) * safePageSize,
    });
    
    // 打印查询结果
    console.log('Query Result:', {
      total: rows.length,
      page: safePage,
      pageSize: safePageSize,
    });
    
    const total = this.stmts.countPhotos.get(includeDeleted ? 1 : 0)?.total ?? 0;

    return {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.ceil(total / safePageSize),
      items: rows,
    };
  }

  async markPhotoDeleted(filePath) {
    const result = this.stmts.markDeleted.run({
      updatedAt: Date.now(),
      path: normalizePath(filePath),
    });
    return result.changes;
  }

  async markPhotosDeleted(paths) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return 0;
    }
    const normalizedPaths = paths.map(normalizePath);
    const result = this.stmts.markAllDeletedByPaths.run({
      updatedAt: Date.now(),
      pathsJson: JSON.stringify(normalizedPaths),
    });
    return result.changes;
  }

  async getAllActivePaths() {
    return this.stmts.getAllActivePaths.all().map((row) => row.path);
  }

  async getRowsForDiskValidation() {
    return this.stmts.getRowsMissingOnDisk.all();
  }

  async getTimelineGroups(page = 1, pageSize = 90) {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(500, Math.max(1, Number(pageSize) || 90));
    const offset = (safePage - 1) * safePageSize;
    const rows = this.stmts.getTimelineGroupPage.all(safePageSize, offset);
    const total = this.stmts.countTimelineGroups.get()?.total ?? 0;
    return {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.ceil(total / safePageSize),
      items: rows,
    };
  }

  async getTimelinePhotosByDay(dayKey, page = 1, pageSize = 80) {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(500, Math.max(1, Number(pageSize) || 80));
    const offset = (safePage - 1) * safePageSize;
    const rows = this.stmts.getPhotosByDay.all({
      dayKey,
      limit: safePageSize,
      offset,
    });
    const total = this.stmts.countPhotosByDay.get(dayKey)?.total ?? 0;
    return {
      dayKey,
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.ceil(total / safePageSize),
      items: rows,
    };
  }

  async createFolder(folder) {
    const now = Date.now();
    const folderType = folder.folder_type || folder.type || (folder.path ? 'physical' : 'logical');
    const normalizedPath = folder.path ? normalizePath(folder.path) : null;
    const parentId = normalizeFolderParentId(folder.parent_id ?? folder.parentId ?? -1);
    const sortOrderRaw = folder.sort_order ?? folder.sortOrder;
    const hasExplicitSortOrder = sortOrderRaw !== undefined && sortOrderRaw !== null && sortOrderRaw !== '';
    const maxSortRow = this.stmts.getMaxFolderSortOrderByParent.get(parentId);
    const nextSortOrder = hasExplicitSortOrder ? Number(sortOrderRaw) : Number(maxSortRow?.max_sort_order ?? 0) + 1;

    if (folderType === 'physical' && normalizedPath) {
      const existing = this.stmts.findPhysicalFolderByPath.get(normalizedPath);
      if (existing?.id) return Number(existing.id);
    }

    if (folderType === 'logical' && folder.name) {
      const existing = this.stmts.findLogicalFolderByNameAndParent.get(folder.name, parentId);
      if (existing?.id) return Number(existing.id);
    }

    const payload = {
      name: folder.name,
      path: normalizedPath,
      parent_id: parentId,
      sort_order: Number.isFinite(nextSortOrder) ? nextSortOrder : 0,
      folder_type: folderType,
      include_subfolders: folder.include_subfolders === undefined
        ? toIntBool(folder.includeSubfolders ?? true)
        : toIntBool(folder.include_subfolders),
      photo_count: Number(folder.photo_count ?? folder.photoCount ?? 0),
      last_synced: folder.last_synced ?? folder.lastSynced ?? null,
      created_at: now,
      updated_at: now,
    };
    const result = this.stmts.insertFolder.run(payload);
    return Number(result.lastInsertRowid);
  }

  async updateFolder(folder) {
    const hasParentId = Object.prototype.hasOwnProperty.call(folder, 'parent_id')
      || Object.prototype.hasOwnProperty.call(folder, 'parentId')
      || Object.prototype.hasOwnProperty.call(folder, 'set_parent_id');
    const hasSortOrder = Object.prototype.hasOwnProperty.call(folder, 'sort_order')
      || Object.prototype.hasOwnProperty.call(folder, 'sortOrder')
      || Object.prototype.hasOwnProperty.call(folder, 'set_sort_order');
    const parentId = normalizeFolderParentId(folder.parent_id ?? folder.parentId ?? -1);
    const sortOrderRaw = folder.sort_order ?? folder.sortOrder ?? 0;
    const sortOrder = Number(sortOrderRaw);

    const payload = {
      id: Number(folder.id),
      name: folder.name ?? null,
      path: folder.path ? normalizePath(folder.path) : null,
      parent_id: parentId,
      set_parent_id: hasParentId ? 1 : 0,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      set_sort_order: hasSortOrder ? 1 : 0,
      folder_type: folder.folder_type ?? folder.type ?? null,
      include_subfolders: folder.include_subfolders === undefined && folder.includeSubfolders === undefined
        ? null
        : toIntBool(folder.include_subfolders ?? folder.includeSubfolders),
      photo_count: folder.photo_count ?? folder.photoCount ?? null,
      last_synced: folder.last_synced ?? folder.lastSynced ?? null,
      updated_at: Date.now(),
    };
    const result = this.stmts.updateFolder.run(payload);
    return result.changes;
  }

  async deleteFolder(folderId) {
    const result = this.stmts.deleteFolder.run(Number(folderId));
    return result.changes;
  }

  async getPhysicalFolderIdByPath(folderPath) {
    const normalized = normalizePath(folderPath);
    const row = this.stmts.findPhysicalFolderByPath.get(normalized);
    return row?.id ? Number(row.id) : null;
  }

  async assignFolderToPath(folderId, folderPath, { includeSubfolders = true, onlyWhenUnassigned = false } = {}) {
    const normalized = normalizePath(folderPath);
    const safeFolderId = Number(folderId);
    if (!Number.isFinite(safeFolderId)) return 0;

    const conditions = ['deleted = 0'];
    const params = {
      folderId: safeFolderId,
      updatedAt: Date.now(),
      folderPath: normalized,
      prefixPath: `${normalized}/%`,
    };

    if (includeSubfolders) {
      conditions.push('(path = @folderPath OR path LIKE @prefixPath)');
    } else {
      conditions.push('path GLOB @directPattern');
      params.directPattern = `${normalized}/*`;
    }

    if (onlyWhenUnassigned) {
      conditions.push('(folder_id IS NULL OR folder_id = 0)');
    }

    const sql = `
      UPDATE photos
      SET folder_id = @folderId, updated_at = @updatedAt
      WHERE ${conditions.join(' AND ')}
    `;

    const result = this.db.prepare(sql).run(params);
    return result.changes;
  }

  async getAllFolders() {
    return this.stmts.getAllFolders.all();
  }

  async updatePhotoByPath(filePath, patch) {
    const folderIdRaw = patch.folder_id ?? patch.folderId ?? null;
    const folderId = folderIdRaw === null || folderIdRaw === undefined || folderIdRaw === '' ? null : Number(folderIdRaw);
    const payload = {
      path: normalizePath(filePath),
      hash: patch.hash ?? null,
      folder_id: Number.isFinite(folderId) ? folderId : null,
      size: patch.size ?? null,
      width: patch.width ?? null,
      height: patch.height ?? null,
      created_at: patch.created_at ?? null,
      updated_at: patch.updated_at ?? Date.now(),
      thumbnail_status: patch.thumbnail_status ?? null,
      deleted: patch.deleted === undefined ? null : toIntBool(patch.deleted),
    };
    const result = this.stmts.updatePhotoByPath.run(payload);
    return result.changes;
  }

  async updateThumbnailStatus(filePath, status) {
    const result = this.stmts.updateThumbnailStatus.run({
      path: normalizePath(filePath),
      status,
      updatedAt: Date.now(),
    });
    return result.changes;
  }

  async updatePhotoMetadata(filePath, patch) {
    const normalized = normalizePath(filePath);
    const parts = [];
    const params = { path: normalized, updated_at: Date.now() };

    if (this.compat.hasFavorite && patch.isFavorite !== undefined) {
      parts.push('is_favorite = @is_favorite');
      params.is_favorite = toIntBool(patch.isFavorite);
    }
    if (this.compat.hasHidden && patch.isHidden !== undefined) {
      parts.push('is_hidden = @is_hidden');
      params.is_hidden = toIntBool(patch.isHidden);
    }
    if (this.compat.hasRating && patch.rating !== undefined) {
      parts.push('rating = @rating');
      params.rating = Number(patch.rating || 0);
    }
    if (this.compat.hasTagsJson && patch.tags !== undefined) {
      parts.push('tags_json = @tags_json');
      params.tags_json = JSON.stringify(Array.isArray(patch.tags) ? patch.tags : []);
    }
    if (patch.folderId !== undefined || patch.folder_id !== undefined) {
      const folderIdRaw = patch.folder_id ?? patch.folderId;
      const folderId = folderIdRaw === null || folderIdRaw === '' ? null : Number(folderIdRaw);
      parts.push('folder_id = @folder_id');
      params.folder_id = Number.isFinite(folderId) ? folderId : null;
    }

    parts.push('updated_at = @updated_at');
    const sql = `UPDATE photos SET ${parts.join(', ')} WHERE path = @path`;
    const result = this.db.prepare(sql).run(params);
    return result.changes;
  }

  async markPhotoDeletedById(id) {
    const result = this.db.prepare('UPDATE photos SET deleted = 1, updated_at = ? WHERE id = ?').run(Date.now(), Number(id));
    return result.changes;
  }

  async deletePhoto(id) {
    return this.markPhotoDeletedById(id);
  }

  async removePhoto(filePath) {
    const normalizedPath = normalizePath(filePath);
    const result = this.db.prepare('UPDATE photos SET deleted = 1, updated_at = ? WHERE path = ?').run(Date.now(), normalizedPath);
    return { success: result.changes > 0, deleted: result.changes };
  }

  async restorePhoto(filePath) {
    const result = this.db.prepare('UPDATE photos SET deleted = 0, updated_at = ? WHERE path = ?').run(Date.now(), normalizePath(filePath));
    return result.changes > 0;
  }

  async clearAllPhotos() {
    const result = this.db.prepare('DELETE FROM photos').run();
    return { deleted: result.changes };
  }

  async clearFolderPhotos(folderId) {
    const result = this.db.prepare('DELETE FROM photos WHERE folder_id = ?').run(Number(folderId));
    return { deleted: result.changes };
  }

  async getPhotoById(id) {
    return this.db.prepare('SELECT * FROM photos WHERE id = ? LIMIT 1').get(Number(id)) ?? null;
  }

  async getAllTags() {
    console.log('[DB] getAllTags called');
    const tags = this.stmts.getAllTags.all();
    console.log('[DB] getAllTags returned:', tags);
    return tags;
  }

  async createTag(tag) {
    console.log('[DB] createTag called with:', tag);
    const now = Date.now();
    
    const existing = this.stmts.getTagByName.get(tag.name);
    if (existing) {
      console.log('[DB] Tag already exists, returning existing:', existing);
      return existing.id;
    }
    
    const result = this.stmts.insertTag.run({
      name: tag.name,
      color: tag.color || '#3b82f6',
      owner_id: tag.owner_id || 'local',
      created_at: now,
      updated_at: now,
    });
    console.log('[DB] createTag result:', result);
    return result.lastInsertRowid;
  }

  async updateTag(tag) {
    const result = this.stmts.updateTag.run({
      id: Number(tag.id),
      name: tag.name,
      color: tag.color || '#3b82f6',
      updated_at: Date.now(),
    });
    return result.changes;
  }

  async deleteTag(tagId) {
    const result = this.stmts.deleteTag.run(Number(tagId));
    return result.changes;
  }

  async getTagById(tagId) {
    return this.stmts.getTagById.get(Number(tagId)) ?? null;
  }

  async getTagByName(name) {
    return this.stmts.getTagByName.get(name) ?? null;
  }

  async getTagsByOwner(ownerId) {
    return this.stmts.getTagsByOwner.all(ownerId);
  }

  async addTagToPhoto(photoId, tagId) {
    console.log('[DB] addTagToPhoto called with:', { photoId, tagId });
    const result = this.stmts.insertPhotoTag.run({
      photo_id: Number(photoId),
      tag_id: Number(tagId),
      created_at: Date.now(),
    });
    console.log('[DB] addTagToPhoto result:', result);
    return result.changes;
  }

  async removeTagFromPhoto(photoId, tagId) {
    const result = this.stmts.deletePhotoTag.run({
      photo_id: Number(photoId),
      tag_id: Number(tagId),
    });
    return result.changes;
  }

  async setPhotoTags(photoId, tagIds) {
    const write = this.db.transaction(() => {
      this.stmts.deletePhotoTagsByPhoto.run(Number(photoId));
      for (const tagId of tagIds) {
        this.stmts.insertPhotoTag.run({
          photo_id: Number(photoId),
          tag_id: Number(tagId),
          created_at: Date.now(),
        });
      }
      return tagIds.length;
    });
    return write();
  }

  async getTagsByPhotoId(photoId) {
    console.log('[DB] getTagsByPhotoId called with:', photoId, 'type:', typeof photoId);
    const tags = this.stmts.getTagsByPhotoId.all(Number(photoId));
    console.log('[DB] getTagsByPhotoId returned:', tags);
    return tags;
  }

  async getPhotosByTagId(tagId, page = 1, pageSize = 120) {
    const offset = (Math.max(1, page) - 1) * Math.max(1, pageSize);
    const photos = this.stmts.getPhotosByTagId.all(Number(tagId));
    return {
      page,
      pageSize,
      total: photos.length,
      totalPages: Math.ceil(photos.length / pageSize),
      items: photos.slice(offset, offset + pageSize),
    };
  }

  async getAllRecipes() {
    return this.stmts.getAllRecipes.all();
  }

  async createRecipe(recipe) {
    const now = Date.now();
    const result = this.stmts.insertRecipe.run({
      name: recipe.name,
      description: recipe.description || null,
      film_mode: recipe.film_mode || recipe.filmMode || null,
      white_balance: recipe.white_balance || recipe.whiteBalance || null,
      dynamic_range: recipe.dynamic_range || recipe.dynamicRange || null,
      sharpness: recipe.sharpness || null,
      saturation: recipe.saturation || null,
      contrast: recipe.contrast || null,
      clarity: recipe.clarity || null,
      shadow_tone: recipe.shadow_tone || recipe.shadowTone || null,
      highlight_tone: recipe.highlight_tone || recipe.highlightTone || null,
      noise_reduction: recipe.noise_reduction || recipe.noiseReduction || null,
      grain_effect: recipe.grain_effect || recipe.grainEffect || null,
      color_chrome_effect: recipe.color_chrome_effect || recipe.colorChromeEffect || null,
      color_chrome_effect_blue: recipe.color_chrome_effect_blue || recipe.colorChromeEffectBlue || null,
      color: recipe.color || null,
      is_favorite: recipe.is_favorite || recipe.isFavorite ? 1 : 0,
      owner_id: recipe.owner_id || recipe.ownerId || 'local',
      created_at: now,
      updated_at: now,
    });
    return result.lastInsertRowid;
  }

  async updateRecipe(recipe) {
    const result = this.stmts.updateRecipe.run({
      id: Number(recipe.id),
      name: recipe.name,
      description: recipe.description || null,
      film_mode: recipe.film_mode || recipe.filmMode || null,
      white_balance: recipe.white_balance || recipe.whiteBalance || null,
      dynamic_range: recipe.dynamic_range || recipe.dynamicRange || null,
      sharpness: recipe.sharpness || null,
      saturation: recipe.saturation || null,
      contrast: recipe.contrast || null,
      clarity: recipe.clarity || null,
      shadow_tone: recipe.shadow_tone || recipe.shadowTone || null,
      highlight_tone: recipe.highlight_tone || recipe.highlightTone || null,
      noise_reduction: recipe.noise_reduction || recipe.noiseReduction || null,
      grain_effect: recipe.grain_effect || recipe.grainEffect || null,
      color_chrome_effect: recipe.color_chrome_effect || recipe.colorChromeEffect || null,
      color_chrome_effect_blue: recipe.color_chrome_effect_blue || recipe.colorChromeEffectBlue || null,
      color: recipe.color || null,
      is_favorite: recipe.is_favorite || recipe.isFavorite ? 1 : 0,
      updated_at: Date.now(),
    });
    return result.changes;
  }

  async deleteRecipe(recipeId) {
    const result = this.stmts.deleteRecipe.run(Number(recipeId));
    return result.changes;
  }

  async getRecipeById(recipeId) {
    return this.stmts.getRecipeById.get(Number(recipeId)) ?? null;
  }

  async getRecipesByOwner(ownerId) {
    return this.stmts.getRecipesByOwner.all(ownerId);
  }

  async addRecipeToPhoto(photoId, recipeId) {
    const result = this.stmts.insertPhotoRecipe.run({
      photo_id: Number(photoId),
      recipe_id: Number(recipeId),
      created_at: Date.now(),
    });
    return result.changes;
  }

  async removeRecipeFromPhoto(photoId, recipeId) {
    const result = this.stmts.deletePhotoRecipe.run({
      photo_id: Number(photoId),
      recipe_id: Number(recipeId),
    });
    return result.changes;
  }

  async setPhotoRecipe(photoId, recipeId) {
    const write = this.db.transaction(() => {
      this.stmts.deletePhotoRecipesByPhoto.run(Number(photoId));
      if (recipeId) {
        this.stmts.insertPhotoRecipe.run({
          photo_id: Number(photoId),
          recipe_id: Number(recipeId),
          created_at: Date.now(),
        });
      }
      return true;
    });
    return write();
  }

  async getRecipesByPhotoId(photoId) {
    return this.stmts.getRecipesByPhotoId.all(Number(photoId));
  }

  async getPhotosByRecipeId(recipeId, page = 1, pageSize = 120) {
    const offset = (Math.max(1, page) - 1) * Math.max(1, pageSize);
    const photos = this.stmts.getPhotosByRecipeId.all(Number(recipeId));
    return {
      page,
      pageSize,
      total: photos.length,
      totalPages: Math.ceil(photos.length / pageSize),
      items: photos.slice(offset, offset + pageSize),
    };
  }

  close() {
    this.db.close();
  }
}

export { normalizePath };
