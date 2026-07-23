import React from 'react';
import { Download, Radio } from 'lucide-react';

interface HeaderProps {
  onExport: () => void;
  onAir: () => void;
  isExporting?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onExport, onAir, isExporting }) => {
  return (
    <header className="w-full px-10 py-6 grid grid-cols-3 items-center">
      {/* Left Action - Empty now as Import is removed */}
      <div className="flex justify-start pointer-events-auto">
      </div>

      {/* Center Title */}
      <div className="flex justify-center pointer-events-none">
        <h1 
          className="text-[36px] font-black tracking-normal leading-none"
          style={{ color: '#BCBCBC' }}
        >
          Visual Parameter
        </h1>
      </div>

      {/* Right Action */}
      <div className="flex justify-end pointer-events-auto items-center gap-4">
        <button 
            onClick={onAir}
            className="flex items-center gap-3 px-6 py-2 rounded-sm transition-all border border-red-500 bg-white text-red-500 hover:bg-red-50"
        >
          <Radio size={14} className="animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest">On Air</span>
        </button>

        <button 
            onClick={onExport}
            disabled={isExporting}
            className={`flex items-center gap-3 px-6 py-2 rounded-sm transition-all border ${isExporting ? 'bg-zinc-400 border-zinc-400 cursor-not-allowed' : 'bg-zinc-900 hover:bg-black border-zinc-900'} text-white`}
        >
          <Download size={14} className={isExporting ? 'animate-bounce' : ''} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {isExporting ? 'Rendering' : 'Download'}
          </span>
        </button>
      </div>
    </header>
  );
};

export default Header;