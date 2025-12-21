# V2ault

一个现代化的本地图片库管理应用，基于 Next.js 构建，支持图片浏览、搜索、上传和管理。

## 功能特性

### 图片浏览
- 响应式瀑布流布局，支持三种网格尺寸（小/中/大）
- 图片详情弹窗，支持缩放和拖拽切换
- 移动端优化的滑动浏览体验
- BlurHash 占位符，优化加载体验
- 智能图片预加载

### 搜索与筛选
- 全文搜索（支持 Prompt、文件名、路径）
- 分辨率筛选（Medium / High / Ultra）
- 模型基底筛选（SD系列、Flux.1、Midjourney、GPT-image 1.5 等）
- 风格分类筛选（2D / 3D / Real）
- 收藏筛选
- 排序方式：最新 / 随机

### 图片管理
- 上传图片（自动转换为 WebP 无损格式）
- 两阶段上传交互：小型选择弹窗 → 完整编辑界面（丝滑过渡动画）
- 上传时支持：
  - 键盘导航（方向键、Delete 删除、Ctrl+A 全选）
  - 批量选择（Ctrl+点击多选、Shift+范围选）
  - 元数据一键复制到其他图片
  - 拖拽排序缩略图
  - 字段联动（风格大类变更自动清空不匹配的具体风格）
  - 必填字段未填时缩略图红点提示
  - 大量图片加载进度条
- 单张/批量删除（移入回收站）
- 回收站管理（恢复/永久删除）
- 全局编辑图片元数据（模型基底、风格大类、具体风格、风格参考、Prompt）
- 点赞收藏功能
- 批量下载（ZIP 打包）

### 多选功能
- **框选操作**：在空白区域拖拽鼠标框选多张图片
- **自动滚动**：框选时鼠标靠近边缘自动滚动
- **批量操作**：
  - 批量下载（ZIP 打包）
  - 批量点赞
  - 批量删除（移入回收站）
  - 批量修改模型基底
  - 批量修改风格分类
- **选中限制**：最多同时选中 200 张图片
- **退出方式**：按 Esc、点击 X 按钮、或点击空白处

### 权限控制
- 管理员/访客模式
- 访客模式下上传和删除按钮自动禁用
- 基于 Cookie 的认证机制

### 快捷键

#### 主界面
| 快捷键 | 功能 |
|--------|------|
| `Q` | 切换视图 |
| `←` `→` | 上一张/下一张图片 |
| `Esc` | 关闭弹窗/退出多选模式 |
| `Delete` | 删除选中图片 |

#### 多选模式
| 快捷键 | 功能 |
|--------|------|
| 拖拽空白区域 | 框选多张图片 |
| 点击空白处 | 退出多选模式 |
| `Esc` | 退出多选模式 |
| `Delete` | 删除选中图片 |

#### 上传弹窗
| 快捷键 | 功能 |
|--------|------|
| `←` `→` `↑` `↓` | 缩略图导航 |
| `Ctrl+A` | 全选/取消全选 |
| `Ctrl+点击` | 多选切换 |
| `Shift+点击` | 范围选择 |
| `Delete` / `Backspace` | 删除选中图片 |
| `Esc` | 关闭弹窗 |

## 技术栈

- **前端**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **动画**: Framer Motion
- **数据库**: PostgreSQL
- **云存储**: 阿里云 OSS
- **图片处理**: Sharp, BlurHash
- **UI 组件**: Lucide Icons, Swiper, Sonner

## 快速开始

### 环境要求
- Node.js 18+
- pnpm / npm / yarn

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd V2ault

# 安装依赖
pnpm install

# 复制环境变量配置
cp .env.local.example .env.local
```

### 配置

编辑 `.env.local` 文件：

```bash
# PostgreSQL 数据库连接字符串
DATABASE_URL=postgresql://user:password@host:5432/v2ault

# 阿里云 OSS 配置
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket-name
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
# OSS_ENDPOINT=  # 可选，自定义 endpoint

# 上传大小限制（字节，默认 20MB）
UPLOAD_MAX_SIZE=20971520

# 管理员密码
ADMIN_PASSWORD=your_secure_password
```

### 初始化数据库

```bash
# 初始化 PostgreSQL 数据库表结构
pnpm db:init
```

### 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

### 生产构建

```bash
pnpm build
pnpm start
```

## 项目结构

```
V2ault/
├── app/
│   ├── api/              # API 路由
│   │   ├── auth/         # 认证 API
│   │   ├── image/        # 图片服务
│   │   ├── images/       # 图片列表/上传/删除
│   │   ├── styles/       # 风格列表 API
│   │   └── trash/        # 回收站 API
│   ├── components/       # React 组件
│   │   └── upload/       # 上传模块子组件
│   ├── hooks/            # 自定义 Hooks
│   ├── lib/              # 工具函数
│   │   └── __tests__/    # 单元测试
│   ├── types/            # TypeScript 类型定义
│   ├── page.tsx          # 主页面
│   └── trash/            # 回收站页面
├── scripts/              # 数据库脚本
│   ├── init-db.ts        # 初始化数据库
│   └── scan-images.ts    # 扫描图片
└── public/               # 静态资源
```

## 数据库结构

`images` 表主要字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| filename | TEXT | 文件名 |
| filepath | TEXT | 文件路径 |
| prompt | TEXT | 图片 Prompt |
| width | INTEGER | 宽度 |
| height | INTEGER | 高度 |
| filesize | INTEGER | 文件大小 |
| model_base | TEXT | 模型基底（SD系列/Flux.1/Midjourney 等）|
| source | TEXT | 风格大类（2D/3D/Real）|
| style | TEXT | 具体风格标签 |
| style_ref | TEXT | 风格参考/LoRA 名称 |
| blurhash | TEXT | BlurHash 占位符 |
| dominant_color | TEXT | 主色调 |
| like_count | INTEGER | 点赞数 |
| created_at | DATETIME | 创建时间 |

## 开发命令

```bash
pnpm dev          # 启动开发服务器
pnpm build        # 生产构建
pnpm start        # 启动生产服务器
pnpm lint         # 代码检查
pnpm test         # 运行测试
pnpm db:init      # 初始化数据库
```

## 更新日志

### 2024-12-22

#### 新功能
- **回收站系统**：删除的图片先移入回收站，支持恢复或永久删除
- **上传失败详情**：上传状态栏显示失败文件名和具体原因

#### 优化
- **图片缓存策略**：修复本地与 Vercel 图片显示不一致问题（OSS 签名 URL 缓存时间从 1 年调整为 30 分钟）
- **上传刷新逻辑**：修复上传完成后图片列表不自动刷新的问题
- **文件类型限制**：前端限制只允许上传图片（JPG/PNG/WebP/BMP/TIFF），不支持 GIF

#### 重构
- **UploadModal 组件拆分**：将 1266 行的单体组件拆分为 7 个独立模块
  - `useUploadModal.ts` - 状态管理和业务逻辑（653 行）
  - `UploadDropZone.tsx` - 拖拽选择区（77 行）
  - `ThumbnailGrid.tsx` - 缩略图网格（180 行）
  - `MetadataEditor.tsx` - 元数据编辑表单（223 行）
  - `UploadEditView.tsx` - 编辑界面容器（266 行）
  - `CloseConfirmDialog.tsx` - 关闭确认弹窗（72 行）
  - `UploadModal.tsx` - 主组件（239 行）

#### 安全
- 修复 Token 验证时序攻击漏洞（使用 timingSafeEqual）
- 修复密码验证时序攻击漏洞

#### 测试
- 新增 47 个单元测试（认证模块 27 个，数据库模块 20 个）
- 测试覆盖率达到核心模块 100%

## 许可证

MIT
