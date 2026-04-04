import Database from 'better-sqlite3';

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
  {
    version: 3,
    name: 'create_folders_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          path TEXT,
          parent_id INTEGER,
          include_subfolders INTEGER NOT NULL DEFAULT 1,
          photo_count INTEGER NOT NULL DEFAULT 0,
          last_synced INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
        );
      `);
    },
  },
];

export class PhotoDatabase {
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
    const appliedRows = this.db
      .prepare('SELECT version FROM schema_migrations ORDER BY version ASC')
      .all();
    const appliedVersions = new Set(appliedRows.map((row) => row.version));

    for (const migration of MIGRATIONS) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

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
          thumbnail_path_200, thumbnail_path_800, updated_at
        ) VALUES (
          @path, @hash, @width, @height, @created_at, @mtime_ms, @size_bytes,
          @thumbnail_path_200, @thumbnail_path_800, @updated_at
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
          updated_at = excluded.updated_at
      `),
      getPhotoByPath: this.db.prepare('SELECT * FROM photos WHERE path = ?'),
      deletePhotoByPath: this.db.prepare('DELETE FROM photos WHERE path = ?'),
      countPhotos: this.db.prepare('SELECT COUNT(*) AS total FROM photos'),
      getPhotosPage: this.db.prepare(`
        SELECT id, path, hash, width, height, created_at, thumbnail_path_200, thumbnail_path_800
        FROM photos
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `),
      currentSchemaVersion: this.db.prepare('SELECT MAX(version) AS version FROM schema_migrations'),
      insertFolder: this.db.prepare(`
        INSERT INTO folders (name, path, parent_id, include_subfolders, photo_count, last_synced, created_at, updated_at)
        VALUES (@name, @path, @parent_id, @include_subfolders, @photo_count, @last_synced, @created_at, @updated_at)
      `),
      updateFolder: this.db.prepare(`
        UPDATE folders SET name = @name, path = @path, parent_id = @parent_id, 
        include_subfolders = @include_subfolders, photo_count = @photo_count, 
        last_synced = @last_synced, updated_at = @updated_at
        WHERE id = @id
      `),
      deleteFolder: this.db.prepare('DELETE FROM folders WHERE id = ?'),
      getFolderById: this.db.prepare('SELECT * FROM folders WHERE id = ?'),
      getAllFolders: this.db.prepare('SELECT * FROM folders ORDER BY id'),
    };
  }

  upsertPhoto(photo) {
    this.stmts.upsertPhoto.run(photo);
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

  insertFolder(folder) {
    const now = Date.now();
    const result = this.stmts.insertFolder.run({
      name: folder.name,
      path: folder.path || null,
      parent_id: folder.parentId || null,
      include_subfolders: folder.includeSubfolders ? 1 : 0,
      photo_count: folder.photoCount || 0,
      last_synced: folder.lastSynced || null,
      created_at: now,
      updated_at: now,
    });
    return result.lastInsertRowid;
  }

  updateFolder(folder) {
    this.stmts.updateFolder.run({
      id: folder.id,
      name: folder.name,
      path: folder.path || null,
      parent_id: folder.parentId || null,
      include_subfolders: folder.includeSubfolders ? 1 : 0,
      photo_count: folder.photoCount || 0,
      last_synced: folder.lastSynced || null,
      updated_at: Date.now(),
    });
  }

  deleteFolder(folderId) {
    this.stmts.deleteFolder.run(folderId);
  }

  getFolderById(folderId) {
    return this.stmts.getFolderById.get(folderId);
  }

  getAllFolders() {
    return this.stmts.getAllFolders.all();
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

export { MIGRATIONS };
