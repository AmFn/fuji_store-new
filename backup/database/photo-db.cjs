const Database = require('better-sqlite3');

const MIGRATIONS = [
  {
    version: 1,
    name: 'create_photos_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS photos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL UNIQUE,
          hash TEXT NOT NULL,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          mtime_ms INTEGER NOT NULL,
          size_bytes INTEGER NOT NULL,
          thumbnail_path_200 TEXT NOT NULL,
          thumbnail_path_800 TEXT NOT NULL,
          is_favorite INTEGER NOT NULL DEFAULT 0,
          is_hidden INTEGER NOT NULL DEFAULT 0,
          rating INTEGER NOT NULL DEFAULT 0,
          tags_json TEXT NOT NULL DEFAULT '[]',
          updated_at INTEGER NOT NULL
        );
      `);
    },
  },
  {
    version: 2,
    name: 'create_photo_indexes',
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_photos_path ON photos(path);
        CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
      `);
    },
  },
];

class PhotoDatabase {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.#initMigrations();
    this.#runMigrations();
    this.#prepareStatements();
  }

  #initMigrations() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `);
  }

  #runMigrations() {
    const appliedRows = this.db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all();
    const appliedVersions = new Set(appliedRows.map((row) => row.version));

    for (const migration of MIGRATIONS) {
      if (appliedVersions.has(migration.version)) continue;
      const run = this.db.transaction(() => {
        migration.up(this.db);
        this.db
          .prepare('INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, Date.now());
      });
      run();
    }
  }

  #prepareStatements() {
    this.stmts = {
      upsertPhoto: this.db.prepare(`
        INSERT INTO photos (
          path, hash, width, height, created_at, mtime_ms, size_bytes,
          thumbnail_path_200, thumbnail_path_800, is_favorite, is_hidden, rating, tags_json, updated_at
        ) VALUES (
          @path, @hash, @width, @height, @created_at, @mtime_ms, @size_bytes,
          @thumbnail_path_200, @thumbnail_path_800, @is_favorite, @is_hidden, @rating, @tags_json, @updated_at
        )
        ON CONFLICT(path) DO UPDATE SET
          hash = excluded.hash,
          width = excluded.width,
          height = excluded.height,
          created_at = excluded.created_at,
          mtime_ms = excluded.mtime_ms,
          size_bytes = excluded.size_bytes,
          thumbnail_path_200 = excluded.thumbnail_path_200,
          thumbnail_path_800 = excluded.thumbnail_path_800,
          is_favorite = excluded.is_favorite,
          is_hidden = excluded.is_hidden,
          rating = excluded.rating,
          tags_json = excluded.tags_json,
          updated_at = excluded.updated_at
      `),
      getPhotoByPath: this.db.prepare('SELECT * FROM photos WHERE path = ?'),
      deletePhotoByPath: this.db.prepare('DELETE FROM photos WHERE path = ?'),
      countPhotos: this.db.prepare('SELECT COUNT(*) AS total FROM photos'),
      getPhotosPage: this.db.prepare(`
        SELECT id, path, hash, width, height, created_at, thumbnail_path_200, thumbnail_path_800,
               is_favorite, is_hidden, rating, tags_json
        FROM photos
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `),
      currentSchemaVersion: this.db.prepare('SELECT MAX(version) AS version FROM schema_migrations'),
    };
  }

  normalizePatch(input) {
    return {
      ...input,
      is_favorite: input.is_favorite ?? 0,
      is_hidden: input.is_hidden ?? 0,
      rating: input.rating ?? 0,
      tags_json: input.tags_json ?? '[]',
    };
  }

  upsertPhoto(photo) {
    this.stmts.upsertPhoto.run(this.normalizePatch(photo));
  }

  getPhotoByPath(photoPath) {
    return this.stmts.getPhotoByPath.get(photoPath);
  }

  deletePhotoByPath(photoPath) {
    this.stmts.deletePhotoByPath.run(photoPath);
  }

  countPhotos() {
    const row = this.stmts.countPhotos.get();
    return row?.total ?? 0;
  }

  getPhotosPage(page, pageSize) {
    const safePage = Math.max(page, 1);
    const safeSize = Math.max(pageSize, 1);
    const offset = (safePage - 1) * safeSize;
    return this.stmts.getPhotosPage.all(safeSize, offset);
  }

  getSchemaVersion() {
    return this.stmts.currentSchemaVersion.get()?.version ?? 0;
  }

  close() {
    this.db.close();
  }
}

module.exports = { PhotoDatabase, MIGRATIONS };
