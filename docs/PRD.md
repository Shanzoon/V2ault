# Local AI Gallery - Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** 2025-12-08  
**Status:** Implemented  

## 1. 产品概述 (Product Overview)

**Local AI Gallery** 是一款高性能、现代化的本地 AI 生成图像管理与浏览工具。旨在为用户提供流畅、沉浸式的图片浏览体验，支持对海量本地 AI 生成图片（如 Stable Diffusion, Midjourney 产出）进行快速检索、筛选和预览。

### 1.1 核心价值
*   **高性能浏览**：针对大量图片的加载与渲染进行极致优化，杜绝卡顿与闪烁。
*   **沉浸式体验**：提供无干扰的全屏浏览模式与便捷的键盘导航。
*   **灵活检索**：支持多维度的排序、搜索及分辨率筛选，帮助用户快速定位灵感。

---

## 2. 用户角色 (User Roles)
*   **AI 创作者/设计师**：需要管理本地生成的成千上万张 AI 图片，寻找 Prompt 灵感或回顾历史作品。

---

## 3. 功能需求 (Functional Requirements)

### 3.1 浏览与布局 (Gallery & Layout)
*   **FR-01 瀑布流布局 (Masonry Layout)**
    *   使用 CSS Columns 实现自适应瀑布流。
    *   响应式列数：Mobile (2列), Tablet (4列), Desktop (6列)。
    *   **关键特性**：防止卡片内部断裂 (`break-inside-avoid`)。
*   **FR-02 无限滚动 (Infinite Scroll)**
    *   基于滚动位置自动加载下一页数据。
    *   底部显示 "Loading more..." 状态指示器。
    *   数据加载完毕显示 "End of Gallery"。
*   **FR-03 占位符与防抖动 (Anti-Flicker)**
    *   利用图片宽高比 (Aspect Ratio) 预先渲染占位容器，防止图片加载时布局跳动。
    *   图片加载完成后执行淡入 (Fade-in) 动画。

### 3.2 筛选与排序 (Filter & Sort)
*   **FR-04 搜索功能**
    *   支持对 `prompt` (提示词) 和 `filename` (文件名) 的模糊搜索。
    *   输入框支持防抖 (Debounce, 500ms)。
    *   搜索结果高亮显示匹配关键词。
*   **FR-05 随机浏览 (Random/Shuffle)**
    *   提供 "Random" 按钮，一键切换至随机排序模式。
    *   点击时触发全屏 Loading 状态，重置当前列表，防止旧数据残留。
*   **FR-06 分辨率筛选 (Resolution Filter)**
    *   提供 Chips 形式的多选筛选栏：
        *   **Low**: < 0.4MP (e.g., < 512x768)
        *   **Medium**: 0.4MP - 1.6MP
        *   **High**: 1.6MP - 2MP
        *   **Ultra**: > 2MP
    *   逻辑：多选 (OR 关系)，与搜索关键词为 AND 关系。

### 3.3 图片详情与交互 (Detail & Interaction)
*   **FR-07 模态框预览 (Super Modal)**
    *   点击列表图片打开模态框。
    *   左侧展示高清大图，右侧展示元数据（文件名、尺寸、路径、Prompt）。
    *   Prompt 区域支持长文本滚动与关键词高亮。
*   **FR-08 沉浸式全屏 (Immersive Fullscreen)**
    *   提供 Expand/Collapse 按钮或点击图片本身切换全屏。
    *   全屏模式下隐藏右侧信息栏，图片铺满屏幕，背景纯黑。
    *   光标交互：普通模式显示 `zoom-in`，全屏模式显示 `zoom-out`。
*   **FR-09 键盘导航 (Keyboard Navigation)**
    *   `ArrowLeft` / `ArrowRight`：切换上一张/下一张图片。
    *   `Escape`：退出全屏（如已全屏）或关闭模态框。

---

## 4. 技术架构 (Technical Architecture)

### 4.1 技术栈
*   **Framework**: Next.js 16 (App Router)
*   **Language**: TypeScript
*   **Database**: SQLite (via `better-sqlite3`) - Read-only mode
*   **Styling**: Tailwind CSS v4
*   **Icons**: Lucide React
*   **Image Optimization**: Sharp (Server-side resizing)

### 4.2 API 设计
*   **GET /api/images/list**
    *   Parameters: `page`, `limit`, `search`, `sort` ('newest' | 'random'), `resolutions` (comma-separated).
    *   Response: `{ images: [], total: number, page: number }`.
*   **GET /api/image**
    *   Parameters: `filepath`, `w` (optional width for resizing).
    *   Function: Stream local file, optional resize using Sharp.

---

## 5. UI/UX 规范 (UI/UX Guidelines)
*   **Theme**: Dark Mode only (bg-gray-950).
*   **Color Palette**: 
    *   Primary: Blue-600 (Active states).
    *   Surface: Gray-900 (Cards, Modals).
    *   Text: White (Primary), Gray-400 (Secondary).
*   **Animations**:
    *   `animate-in fade-in zoom-in duration-500`: 图片卡片进入动画。
    *   `transition-all`: 模态框全屏切换过渡。
*   **Loading States**:
    *   **Global Loading**: 全屏居中大 Spinner (w-16 h-16)。
    *   **Incremental Loading**: 底部胶囊状 Spinner。

---

## 6. 数据逻辑 (Data Logic)
*   **SQL Query Construction**:
    *   动态构建 `WHERE` 子句，组合 Search (`LIKE`) 和 Resolution (`width * height`) 条件。
    *   `sort=random` 使用 `ORDER BY RANDOM()`。
    *   `sort=newest` 使用 `ORDER BY created_at DESC`。
