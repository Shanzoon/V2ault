'use client';

import { Menu } from 'lucide-react';

interface MobileHeaderProps {
  totalAssets: number;
  onMenuClick: () => void;
  onTitleClick: () => void;
}

export function MobileHeader({ totalAssets, onMenuClick, onTitleClick }: MobileHeaderProps) {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-black/90 backdrop-blur-md border-b border-white/10 z-40 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="p-2 -ml-2 text-gray-400 hover:text-white">
          <Menu className="w-6 h-6" />
        </button>
        <span onClick={onTitleClick} className="font-bold text-lg cursor-pointer">
          <span className="text-blue-600">V</span>
          <span className="text-gray-500">2ault</span>
        </span>
      </div>
      <div className="text-[10px] font-bold text-gray-500 tracking-widest">{totalAssets.toLocaleString()} ASSETS</div>
    </header>
  );
}
