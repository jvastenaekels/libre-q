import React from 'react';
import SortableCard from './SortableCard';

interface CardPileProps {
  type: 'agree' | 'disagree' | 'neutral';
  count: number;
  topCard?: { id: number; text: string };
}

const CardPile: React.FC<CardPileProps> = ({ type, count, topCard }) => {
  // Config based on type
  const config = {
    agree: {
      label: 'Agree',
      borderColor: 'border-green-300',
      bgColor: 'bg-green-50',
    },
    disagree: {
      label: 'Disagree',
      borderColor: 'border-red-300',
      bgColor: 'bg-red-50',
    },
    neutral: {
      label: 'Neutral',
      borderColor: 'border-gray-300',
      bgColor: 'bg-gray-50',
    },
  }[type];

  // If no cards, show empty state placeholder
  const isEmpty = count === 0;

  return (
    <div className="relative w-24 h-32 sm:w-28 sm:h-36 flex flex-col items-center">
      
      {/* 1. Underlying Stack Visuals (Pseudo-depth) */}
      {!isEmpty && (
        <>
            <div className={`absolute top-1 left-1 w-full h-full rounded-lg border ${config.borderColor} bg-white opacity-50 z-0`} />
            <div className={`absolute top-2 left-2 w-full h-full rounded-lg border ${config.borderColor} bg-white opacity-30 z-[-1]`} />
        </>
      )}

      {/* 2. Top Card (Draggable) OR Placeholder */}
      <div className="relative w-full h-full z-10">
          {topCard ? (
              <SortableCard id={topCard.id} text={topCard.text} />
          ) : (
              // Empty State
              <div className={`
                  w-full h-full rounded-lg border-2 border-dashed ${config.borderColor} ${config.bgColor}
                  flex flex-col items-center justify-center gap-2 opacity-50
              `}>
                  <span className="text-xs font-bold uppercase text-gray-400">Empty</span>
              </div>
          )}
      </div>

      {/* 3. Badge */}
      <div className="absolute -top-2 -right-2 z-20 pointer-events-none">
         <div className="bg-slate-800 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow-md min-w-[20px] text-center border border-white">
          {count}
        </div>
      </div>

      {/* Label below */}
      <div className="mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-wide text-gray-500">
         {config.label}
      </div>
    </div>
  );
};

export default CardPile;
