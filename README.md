# Fuji Station

<div align="center">
<img width="1200" height="475" alt="Fuji Station Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

A modern desktop photo management application with Fujifilm Film Simulation Recipe support, built with Electron, React, and Vite.

## Features

- **Photo Management**: Import, organize, and browse your photo collection
- **Film Simulation Recipes**: Create and manage Fujifilm film simulation recipes
- **AI Recognition**: Automatically recognize film recipes from your photos
- **Metadata Support**: Read and display EXIF metadata from Fujifilm RAW and JPEG files
- **Thumbnail Generation**: Automatic thumbnail and preview generation
- **Dark Mode**: Full dark mode support

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS 4
- **Desktop**: Electron 41
- **Database**: SQLite (better-sqlite3)
- **Authentication**: Firebase
- **Animation**: Framer Motion

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

### Run with Electron

```bash
npm start
```

### Build

```bash
npm run build
```

### Rebuild Native Modules

If you encounter native module errors, rebuild them:

```bash
npx electron-rebuild
```

## Project Structure

```
fuji-store-new/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/         # Preload scripts
│   └── renderer/       # React frontend
│       ├── components/  # UI components
│       ├── services/   # Business logic
│       ├── hooks/      # React hooks
│       ├── types/      # TypeScript types
│       └── utils/      # Utilities
├── electron/           # Electron services
├── database/           # Database schema
└── ui/                # UI design reference
```

## License

MIT
