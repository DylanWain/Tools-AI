# Electron Desktop Setup

This Next.js app can now run as an Electron desktop application.

## Development

To run the app in Electron during development:

```bash
npm run electron:dev
```

This will:
1. Start the Next.js dev server on port 3000
2. Wait for it to be ready
3. Compile the Electron TypeScript files
4. Launch Electron pointing to localhost:3000

The Electron window will open with DevTools enabled for debugging.

## Building for Production

To create a distributable desktop app:

```bash
npm run electron:build
```

This will:
1. Build the Next.js app for production
2. Compile the Electron TypeScript files
3. Package the app using electron-builder

The packaged app will be in the `release/` directory.

## Quick Start (Compiled App)

To run the compiled Electron app without packaging:

```bash
npm run electron:start
```

This compiles the Electron files and runs the main process directly.

## Architecture

- **Main Process** (`electron/main.ts`): Creates the browser window and manages the app lifecycle
- **Preload Script** (`electron/preload.ts`): Safely exposes APIs to the renderer process
- **Next.js App**: Runs as the renderer process
  - In development: loaded from http://localhost:3000
  - In production: loaded from the bundled static files in `out/`

## Configuration

The electron-builder configuration is in `package.json` under the `build` key. It's configured to build for:
- **macOS**: DMG and ZIP
- **Windows**: NSIS installer and portable executable
- **Linux**: AppImage and DEB package
