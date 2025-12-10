export interface Image {
  id: number;
  filename: string;
  prompt: string;
  width: number;
  height: number;
}

export interface ApiResponse {
  images: Image[];
  total: number;
  page: number;
}

export type GridSize = 'small' | 'medium' | 'large';

export type SortMode = 'newest' | 'random_block' | 'random_shuffle';

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
  gridSize: GridSize;
}
