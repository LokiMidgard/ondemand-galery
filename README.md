# On-Demand Gallery

A SvelteKit-based gallery application that displays images and text files with metadata extraction and file upload capabilities.

## Features

- **Gallery Display**: View images and text files in a responsive grid layout
- **File Upload**: Drag and drop or click to upload new files to the gallery
- **Metadata Extraction**: Automatically extracts EXIF data from images including:
  - AI generation parameters (prompts, models, seeds, etc.)
  - Image dimensions and technical details
  - Custom metadata from various sources
- **Thumbnails**: Automatic thumbnail generation for better performance
- **Modal View**: Full-screen view with navigation and detailed metadata
- **Keyboard Navigation**: Arrow keys for navigation, Escape to close
- **Real-time Updates**: Gallery automatically updates when new files are added

## Environment Configuration

The application uses environment variables to configure file paths:

```bash
# Path where gallery files are stored and uploaded files will be saved
GALLERY_PATH=./gallery

# Path where thumbnails are cached  
THUMBNAIL_PATH=./thumbnail
```

Copy `.env.example` to `.env` and adjust paths as needed.

## Supported File Types

- **Images**: .png, .jpg, .jpeg, .gif
- **Videos**: .mp4, .webm (display support)
- **Text**: .md, .txt

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
