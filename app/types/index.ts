export interface Image {
  id: number;
  filename: string;
  filepath: string;
  width: number | null;
  height: number | null;
  created_at: string | null;
  prompt: string | null;
  negative_prompt: string | null;

  filesize?: number | null;
  imported_at?: number | null;
  source?: string | null;
  model_base_id?: number | null;
  model_base?: string | null;  // 模型基底名称（从关联查询获取）
  style?: string | null;
  style_ref?: string | null;   // 风格参照/LoRA名称
  blurhash?: string | null;
  dominant_color?: string | null;
  like_count?: number;
  favorite?: number;
}

export interface ApiResponse {
  images: Image[];
  total: number;
  page: number;
}

export type GridSize = 'small' | 'medium' | 'large';

export type SortMode = 'newest' | 'random_block' | 'random_shuffle' | 'date_desc';

export interface DeleteConfirmation {
  show: boolean;
  type: 'single' | 'batch' | null;
  triggerRect?: DOMRect | null;
}

export interface ImageCardProps {
  img: Image;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: (id: number) => void;
  onImageClick: (img: Image) => void;
  onToggleLiked?: (id: number) => void;
  onDownload?: (id: number, filename: string) => void;
  onDelete?: (id: number, e: React.MouseEvent) => void;
  isAdmin?: boolean;
  loadHighRes?: boolean;
}
