# SimpleCut - Modern Video Editor

SimpleCut is a lightweight, powerful video editing application built with Electron, React, and Vite. It features a modern, "CapCut-like" interface designed for speed and ease of use.

## Features

###  Timeline Editing
- **Multi-Track Support**: Layer videos, audio, and text.
- **Drag & Drop**: Easily arrange clips on the timeline.
- **Smart Snapping**: Clips align automatically (magnetic timeline feel).
- **Zoom & Scroll**: Fluid navigation with pixel-perfect precision.

###  Performance
- **Proxy Generation**: Automatically creates low-res proxies for smooth playback of 4K/high-bitrate footage.
- **Smart Caching**: Thumbnails and waveforms are cached for instant loading.
- **Hardware Acceleration**: Utilizes FFmpeg for efficient media processing.

###  Creative Tools
- **Keyframe Animation**: Animate properties like position, scale, and opacity.
- **Split & Trim**: Precise cutting tools.
- **Text Overlays**: Add dynamic text with customizable fonts and styles.
- **Filters**: Apply visual effects to your clips.

###  Export
- **High-Quality Output**: Export to MP4 with customizable resolution and frame rates.
- **Fast Rendering**: Optimized FFmpeg pipeline.

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/simple-cut.git
   cd simple-cut
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

Start the development server:
```bash
npm run dev
```

### Building for Production

Build the executable for your OS:
```bash
npm run build
```

## Tech Stack
- **Frontend**: React, TypeScript, Vite
- **Backend**: Electron, Node.js
- **Media Processing**: FFmpeg (fluent-ffmpeg, ffmpeg-static)
- **Styling**: CSS Modules, Modern CSS Variables

## License
MIT
