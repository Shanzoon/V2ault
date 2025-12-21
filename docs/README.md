# Local AI Gallery

![Next.js](https://img.shields.io/badge/Next.js-16.0-black) ![React](https://img.shields.io/badge/React-19.0-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-cyan) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)

A high-performance, immersive gallery application designed for browsing and managing AI images. Built with Next.js App Router, PostgreSQL and Alibaba Cloud OSS.

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
  - PostgreSQL for reliable metadata storage.
  - Alibaba Cloud OSS for image storage.
  - Server-side image resizing on-the-fly using `sharp`.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL
- **Cloud Storage**: Alibaba Cloud OSS
- **Icons**: `lucide-react`
- **Utils**: `use-debounce`, `react-intersection-observer`

## 📂 Directory Structure

```
V2ault/
├── app/
│   ├── api/
│   │   ├── auth/         # Authentication API
│   │   ├── image/        # Image streaming & resizing API
│   │   └── images/       # Metadata listing API (Search/Sort/Filter)
│   ├── components/       # React components
│   ├── hooks/            # Custom hooks
│   ├── lib/              # Utilities and database
│   ├── globals.css       # Tailwind directives
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main Gallery UI
├── docs/                 # Documentation (PRD, etc.)
├── scripts/              # Database scripts
└── public/               # Static assets
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Alibaba Cloud OSS bucket

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd V2ault
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Environment Setup:**
    Copy `.env.local.example` to `.env.local` and configure:
    - `DATABASE_URL`: PostgreSQL connection string
    - `OSS_*`: Alibaba Cloud OSS credentials

4.  **Initialize Database:**
    ```bash
    pnpm db:init
    ```

5.  **Run Development Server:**
    ```bash
    pnpm dev
    ```

6.  **Open Browser:**
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
