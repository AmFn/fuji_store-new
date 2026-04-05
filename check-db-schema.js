import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Open the database
const dbPath = path.join(__dirname, 'database', 'photos.db');
const db = new Database(dbPath);

try {
  // Check photos table schema
  console.log('Photos table schema:');
  const photoSchema = db.prepare(`PRAGMA table_info(photos);`).all();
  console.table(photoSchema);
  
  // Check if both deleted and is_deleted exist
  const hasDeleted = photoSchema.some(col => col.name === 'deleted');
  const hasIsDeleted = photoSchema.some(col => col.name === 'is_deleted');
  
  console.log('\nField existence:');
  console.log('deleted field exists:', hasDeleted);
  console.log('is_deleted field exists:', hasIsDeleted);
  
  // If both exist, check if we can remove is_deleted
  if (hasDeleted && hasIsDeleted) {
    console.log('\nBoth fields exist. Checking if is_deleted can be removed...');
    
    // Check if is_deleted has any non-zero values
    const nonZeroIsDeleted = db.prepare(`
      SELECT COUNT(*) AS count FROM photos WHERE is_deleted != 0;
    `).get();
    
    console.log('Number of photos with is_deleted != 0:', nonZeroIsDeleted?.count || 0);
    
    // Check if deleted and is_deleted have the same values
    const mismatchCount = db.prepare(`
      SELECT COUNT(*) AS count FROM photos WHERE deleted != is_deleted;
    `).get();
    
    console.log('Number of photos with mismatched deleted/is_deleted values:', mismatchCount?.count || 0);
  }
  
} catch (error) {
  console.error('Error checking database schema:', error);
} finally {
  db.close();
}
