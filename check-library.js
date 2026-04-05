import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkLibrary() {
  try {
    // Import the LibraryManager
    const { LibraryManager } = await import('./main/libraryManager.js');
    
    // Create LibraryManager instance
    const libraryManager = await LibraryManager.create({
      dbPath: path.join(__dirname, 'database', 'photos.db'),
      thumbnailDir: path.join(__dirname, 'cache', 'thumbnails'),
    });
    
    // Check photos
    console.log('Checking photos...');
    const photos = await libraryManager.getPhotos(1, 10);
    console.log('Total photos:', photos.total);
    console.log('Sample photos:');
    console.table(photos.items);
    
    // Check folders
    console.log('\nChecking folders...');
    const folders = await libraryManager.getAllFolders();
    console.log('Total folders:', folders.length);
    console.log('Folders:');
    console.table(folders);
    
    // Stop the library manager
    await libraryManager.stop();
    
  } catch (error) {
    console.error('Error checking library:', error);
  }
}

checkLibrary();
