# Local AI Gallery

![Next.js](https://img.shields.io/badge/Next.js-16.0-black) ![React](https://img.shields.io/badge/React-19.0-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-cyan) ![SQLite](https://img.shields.io/badge/SQLite-Better--Sqlite3-green)

A high-performance, immersive gallery application designed for browsing and managing locally generated AI images (Stable Diffusion, Midjourney, etc.). Built with Next.js App Router and SQLite.

## ✨ Features

- **🚀 High Performance Masonry Layout**
  - CSS Columns based waterfall flow.
  - Adaptive column count (2/4/6) for all devices.
  - Zero-layout-shift rendering with aspect-ratio placeholders.

- **🔍 Advanced Filtering & Search**
  - Real-time search by prompt or filename (with debouncing).
  - **Resolution Filters**: Filter images by Low, Medium, High, or Ultra quality.
  - **Shuffle Mode**: Randomize your gallery to rediscover hidden gems.

- **🖼️ Immersive Viewing Experience**
  - **Super Modal**: Detailed view with metadata and prompt inspection.
  - **Fullscreen Mode**: Distraction-free, edge-to-edge image viewing.
  - **Keyboard Navigation**: Use `Arrow` keys to browse and `Esc` to close.
  - **Smooth Animations**: Elegant fade-in effects for images and UI transitions.

- **⚡ Optimized Backend**
  - Read-only SQLite integration for fast metadata retrieval.
  - Server-side image resizing on-the-fly using `sharp`.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: SQLite (`better-sqlite3`)
- **Icons**: `lucide-react`
- **Utils**: `use-debounce`, `react-intersection-observer`

## 📂 Directory Structure

```
my-image-gallery/
├── app/
│   ├── api/
│   │   ├── image/        # Image streaming & resizing API
│   │   └── images/list/  # Metadata listing API (Search/Sort/Filter)
│   ├── globals.css       # Tailwind directives
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main Gallery UI (Masonry, Modal, Logic)
├── docs/                 # Documentation (PRD, etc.)
├── public/               # Static assets
└── images.db             # SQLite database file (placed in project root or parent)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- An `images.db` SQLite database containing your image metadata.
- Local images accessible by the application.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd my-image-gallery
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Database Setup:**
    Ensure your `images.db` is correctly placed.
    *   By default, the API looks for `images.db` in the parent directory (`../images.db`) or current root (`./images.db`) depending on configuration in `app/api/images/list/route.ts`.

4.  **Run Development Server:**
    ```bash
    npm run dev
    ```

5.  **Open Browser:**
    Navigate to `http://localhost:3000` to view your gallery.

## 🎮 Controls

| Key / Action | Function |
| :--- | :--- |
| **Click Image** | Open Detail Modal |
| **Click (in Modal)** | Toggle Fullscreen Mode |
| **Arrow Left** | Previous Image |
| **Arrow Right** | Next Image |
| **Esc** | Exit Fullscreen / Close Modal |
| **Random Button** | Shuffle Gallery Order |

## 📄 License

MIT
