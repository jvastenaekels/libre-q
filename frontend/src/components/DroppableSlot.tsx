import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface DroppableSlotProps {
  id: string; // Format: "col-row"
  isOver?: boolean;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties; 
}

const DroppableSlot: React.FC<DroppableSlotProps> = ({ id, children, className, onClick, style }) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      data-testid={id}
      style={style} // Apply style
      className={`
        rounded border-2 
        flex items-center justify-center 
        transition-colors duration-200
        cursor-pointer 
        ${isOver 
            ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200' 
            : children 
                ? 'bg-white border-transparent shadow-sm' 
                : 'bg-white/40 border-dashed border-slate-400/60 hover:bg-white/60 hover:border-slate-500 transition-all'
        }
        ${className || ''}
      `}
    >
      {children}
    </div>
  );
};

export default DroppableSlot;
