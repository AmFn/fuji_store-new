import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Open the database
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'database', 'photos.db');
const db = new Database(dbPath);

try {
  // Check if photos table exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='photos';
  `).get();
  
  console.log('Photos table exists:', !!tableExists);
  
  // Count photos
  const photoCount = db.prepare(`
    SELECT COUNT(*) AS count FROM photos WHERE deleted = 0;
  `).get();
  
  console.log('Number of photos (not deleted):', photoCount?.count || 0);
  
  // Get sample photos
  const samplePhotos = db.prepare(`
    SELECT id, path, hash, created_at, thumbnail_status 
    FROM photos 
    WHERE deleted = 0 
    LIMIT 5;
  `).all();
  
  console.log('Sample photos:');
  console.table(samplePhotos);
  
  // Check if folders table exists
  const foldersExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='folders';
  `).get();
  
  console.log('Folders table exists:', !!foldersExists);
  
  // Count folders
  const folderCount = db.prepare(`
    SELECT COUNT(*) AS count FROM folders;
  `).get();
  
  console.log('Number of folders:', folderCount?.count || 0);
  
} catch (error) {
  console.error('Error checking database:', error);
} finally {
  db.close();
}
