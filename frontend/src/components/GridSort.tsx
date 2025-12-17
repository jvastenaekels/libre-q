import React, { useState, useEffect } from 'react';
import DroppableSlot from './DroppableSlot';
import SortableCard from './SortableCard';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { Check, ZoomIn, ZoomOut, RotateCcw, Hand, X } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useTranslation, Trans } from 'react-i18next';

interface GridSortProps {
  agreeCards: any[];
  disagreeCards: any[];
  neutralCards: any[];
  gridColumns: { score: number; capacity: number }[];
  responses: any;
  renderSlotContent: (col: number, row: number) => React.ReactNode;
  onReset?: () => void;
  selectedCardId?: number | null;
  onCardClick?: (id: number) => void;
  onSlotClick?: (col: number, row: number) => void;
}

type PileType = 'disagree' | 'neutral' | 'agree';

const GridSort: React.FC<GridSortProps> = ({
  agreeCards,
  disagreeCards,
  neutralCards,
  gridColumns,
  renderSlotContent,
  onReset,
  selectedCardId,
  onCardClick,
  onSlotClick
}) => {
  const { t } = useTranslation();
  const [activePile, setActivePile] = useState<PileType>('disagree');
  const [visibleTips, setVisibleTips] = useState({ extremes: true, vertical: true }); // Refactored from showTip
  const [cardDimensions, setCardDimensions] = useState({ width: 160, height: 96 }); // Dynamic Card Sizing
  const getActiveCards = () => {
      switch(activePile) {
          case 'agree': return agreeCards;
          case 'disagree': return disagreeCards;
          case 'neutral': return neutralCards;
          default: return [];
      }
  };
  const activeCards = getActiveCards();

  // ... (Column Tint, Refs, AutoFit Logic remain same) ...
  // Column Tint Helper
  const getColumnTint = (score: number) => {
      if (score <= -3) return 'bg-red-50/50';
      if (score < 0) return 'bg-orange-50/30';
      if (score === 0) return 'bg-slate-50';
      if (score >= 3) return 'bg-green-50/50';
      if (score > 0) return 'bg-emerald-50/30';
      return 'bg-transparent';
  };
  

  const transformRef = React.useRef<any>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Auto-Fit Logic (Robust)
  const performAutoFit = () => {
      if (!transformRef.current || !wrapperRef.current || !contentRef.current) return;

      const wrapper = wrapperRef.current;
      const content = contentRef.current;
      
      // Get dimensions
      const wrapperW = wrapper.clientWidth;
      const wrapperH = wrapper.clientHeight;
      
      // Content size (native, unscaled)
      // We must measure the inner content. scrollWidth should be accurate if not transformed yet, 
      // but react-zoom-pan-pinch wraps it. 
      // Safest is to rely on 'offset' dimensions of the grid container *if* it weren't scaled?
      // Actually, if we use the helper from the library, it handles the math.
      // But let's trust our refs:
      const contentW = content.offsetWidth; // The rigid grid width
      const contentH = content.offsetHeight;
      
      if (contentW === 0 || contentH === 0) return;

      // Check for mobile (lg breakpoint is 1024px)
      const isMobile = window.innerWidth < 1024;

      if (isMobile) {
          // Mobile: 110% of screen width
          // The wrapper might have padding, but usually on mobile it's full width of the 'canvas' area.
          const scale = (wrapperW * 1.10) / contentW;
          
          // Center Horizontally
          // X = (ContainerWidth - ScaledContentWidth) / 2
          const x = (wrapperW - (contentW * scale)) / 2;
          
          // Align Bottom
          // Y = ContainerHeight - ScaledContentHeight - Padding
          // Use a small padding to sit "just above" the bottom edge
          const y = wrapperH - (contentH * scale) - 20;

          transformRef.current.setTransform(x, y, scale, 200);
      } else {
          // Desktop: Original Center Fit logic
          const padding = 64; 
          const availableW = wrapperW - padding;
          const availableH = wrapperH - padding;
    
          const scaleX = availableW / contentW;
          const scaleY = availableH / contentH;
          
          const fitScale = Math.min(scaleX, scaleY, 1.5); 
    
          transformRef.current.centerView(fitScale, 200);
      }
  };

  /* Safe Calculation of Optimal Size */
  const calculateOptimalSize = React.useCallback(() => {
      if (!wrapperRef.current) return;
      const wrapper = wrapperRef.current;
      const W = wrapper.clientWidth;
      const H = wrapper.clientHeight;
      if (W === 0 || H === 0) return;

      const numCols = gridColumns.length;
      if (numCols === 0) return; // Prevent divide by zero

      const maxRows = Math.max(...gridColumns.map(c => c.capacity || 0));
      if (maxRows === 0) return;

      const screenRatio = W / H;
      const gridStructureRatio = maxRows / numCols;
      let targetCardRatio = screenRatio * gridStructureRatio;
      
      // Safety Clamp
      if (!isFinite(targetCardRatio) || isNaN(targetCardRatio)) targetCardRatio = 1.6;
      targetCardRatio = Math.max(0.6, Math.min(targetCardRatio, 3.0));
      
      const targetArea = 160 * 96; 
      let newWidth = Math.sqrt(targetArea * targetCardRatio);
      let newHeight = targetArea / newWidth;

      // Ensure finite values
      if (!isFinite(newWidth)) newWidth = 160;
      if (!isFinite(newHeight)) newHeight = 96;
      
      setCardDimensions(prev => {
          // Strict convergence check to prevent loops (1px delta)
          if (Math.abs(prev.width - newWidth) < 1.5 && Math.abs(prev.height - newHeight) < 1.5) return prev;
          return { width: newWidth, height: newHeight };
      });
  }, [gridColumns]);

  useEffect(() => {
      // Auto-close tips on mobile when a card is selected
      if (selectedCardId && window.innerWidth < 1024) {
          setVisibleTips({ extremes: false, vertical: false });
      }
  }, [selectedCardId]);

  React.useEffect(() => {
      // Initial
      calculateOptimalSize();
      
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      // Debounced Observer
      let rafId: number;
      const observer = new ResizeObserver(() => {
          // Use RAF to throttle to frame rate and prevent sync loops
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
              calculateOptimalSize();
          });
      });
      observer.observe(wrapper);

      return () => {
          observer.disconnect();
          cancelAnimationFrame(rafId);
      };
  }, [calculateOptimalSize]);

  // Separate AutoFit effect
  useEffect(() => {
     // Wait for DOM
     const t = setTimeout(performAutoFit, 50);
     return () => clearTimeout(t);
  }, [cardDimensions]);

  return (
    // MAIN CONTAINER: Flex Column Reverse for Mobile (Deck at bottom), Row for Desktop
    <div className="flex flex-col-reverse lg:flex-row h-full bg-slate-50 w-full max-w-[1920px] mx-auto overflow-hidden">
      
       {/* ---------------------------------------------------------------------------
          PANEL 1: SOURCE INVENTORY (Deck)
          Mobile: Fixed/Sticky Bottom, Horizontal Scroll.
          Desktop: Left Sidebar, Vertical Scroll.
      --------------------------------------------------------------------------- */}
      <div className="
          w-full lg:w-[320px] flex-none 
          bg-white lg:border-r border-t lg:border-t-0 border-gray-200 
          z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] lg:shadow-md 
          flex flex-col
          h-auto lg:h-full 
          transition-all duration-300
          pb-safe
      ">
          
              {/* HEADER & TABS */}
              <div className="flex-none px-2 lg:px-3 pt-2 lg:pt-4 pb-2 border-b border-gray-100 bg-white z-20">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 hidden lg:block">
                      {t('fine.deck.title')}
                  </h3>

              {/* COMPACT TABS */}
              <div className="flex rounded-md overflow-hidden border border-gray-200 w-full mb-1 shadow-sm">
                   <button
                      onClick={() => setActivePile('disagree')}
                      className={`flex-1 py-2 lg:py-1.5 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${activePile === 'disagree' ? 'bg-red-50 text-red-700' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                   >
                     {t('common.disagree')}
                     <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${activePile === 'disagree' ? 'bg-white text-blue-600 shadow-sm' : 'bg-slate-100 text-blue-600'}`}>
                         {disagreeCards.length}
                     </span>
                   </button>
                   <button
                      onClick={() => setActivePile('neutral')}
                      className={`flex-1 py-2 lg:py-1.5 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors border-l border-r border-gray-200 ${activePile === 'neutral' ? 'bg-slate-100 text-slate-800' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                   >
                     {t('common.neutral')}
                     <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${activePile === 'neutral' ? 'bg-white border border-slate-200 text-blue-600' : 'bg-slate-100 text-blue-600'}`}>
                       {neutralCards.length}
                     </span>
                   </button>
                   <button
                      onClick={() => setActivePile('agree')}
                      className={`flex-1 py-2 lg:py-1.5 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${activePile === 'agree' ? 'bg-green-50 text-green-700' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                   >
                     {t('common.agree')}
                     <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${activePile === 'agree' ? 'bg-white text-blue-600 shadow-sm' : 'bg-slate-100 text-blue-600'}`}>
                        {agreeCards.length}
                     </span>
                   </button>
              </div>
          </div>

          {/* THE SOURCE DECK CONTENT */}
          {/* Mobile: Horizontal Scroll (flex-row). Desktop: Vertical Grid (flex-col). */}
          <div className="flex-1 bg-slate-50/50 p-2 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto">
              <SortableContext 
                  items={activeCards.map(c => c.id)} 
                  strategy={rectSortingStrategy}
               >
                  <div className={`
                        ${activeCards.length === 0 
                            ? 'flex w-full h-full justify-center items-center' 
                            : 'flex flex-row lg:grid lg:grid-cols-1 2xl:lg:grid-cols-2 gap-2 lg:gap-3'}
                  `}>
                      {activeCards.length > 0 ? activeCards.map(card => (
                          <div key={card.id} className="min-w-[160px] w-40 h-24 lg:min-w-0 lg:w-full lg:h-28 snap-start">
                              <SortableCard 
                                id={card.id} 
                                text={card.text} 
                                variant="compact" 
                                isSelected={selectedCardId === card.id}
                                onClick={() => onCardClick?.(card.id)}
                            />
                          </div>
                      )) : (
                          <div className="text-center text-slate-300 flex flex-col items-center gap-2">
                              <Check size={24} className="text-green-400" />
                              <span className="text-xs font-medium">{t('fine.deck.all_placed')}</span>
                          </div>
                      )}
                  </div>

               </SortableContext>
          </div>
          
          {/* FOOTER ACTION (Reset) */}
          {onReset && (
              <div className="flex-none p-2 border-t border-gray-100 bg-slate-50/50 hidden lg:flex justify-center">
                  <button 
                      onClick={onReset}
                      className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-wider px-3 py-1.5 rounded hover:bg-red-50"
                  >
                      {t('fine.deck.reset')}
                  </button>
              </div>
          )}
      </div>

       {/* ---------------------------------------------------------------------------
          PANEL 2: THE CANVAS (Interactive Grid)
          Flex-1. Top on Mobile. Right on Desktop.
      --------------------------------------------------------------------------- */}
      <div className="flex-1 h-full bg-slate-50 relative flex flex-col overflow-hidden">
          
           {/* Toolbar Info: Visible on ALL screens now */}
           <div className="py-2 flex-none bg-white border-b border-gray-200 flex items-center justify-center px-4 shadow-sm z-20">
                {/* Mobile Text */}
                <span className="text-sm font-medium text-slate-700 text-center leading-tight lg:hidden">
                   <Trans 
                       i18nKey="fine.toolbar.mobile"
                       components={[
                           <strong className="text-red-600" key="0" />,
                           <strong className="text-green-600" key="1" />
                       ]}
                   />
                </span>
                {/* Desktop Text */}
                <span className="text-sm font-medium text-slate-700 text-center leading-tight hidden lg:inline">
                   <Trans 
                       i18nKey="fine.toolbar.desktop"
                       components={[
                           <strong className="text-red-600" key="0" />,
                           <strong className="text-green-600" key="1" />
                       ]}
                   />
                </span>
           </div>

           <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-100 cursor-grab active:cursor-grabbing" ref={wrapperRef}>
                
                {/* FLOATING CONTROLS (Top Right now for Mobile Compat) */}
                <div className="absolute top-4 right-4 z-50 flex flex-col gap-1 bg-white/90 backdrop-blur p-1.5 rounded-lg border border-slate-200 shadow-md">
                        <button onClick={() => transformRef.current?.zoomIn()} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Zoom In">
                            <ZoomIn size={20} />
                        </button>
                        <button onClick={() => transformRef.current?.zoomOut()} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Zoom Out">
                            <ZoomOut size={20} />
                        </button>
                        <div className="h-px bg-slate-200 my-0.5"></div>
                        <button onClick={performAutoFit} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Fit to Screen">
                            <RotateCcw size={20} />
                        </button>
                </div>

                {/* TIPS CONTAINER */}
                {(visibleTips.extremes || visibleTips.vertical) && (
                    <div className="absolute top-4 left-4 z-40 max-w-[85vw] md:max-w-sm pointer-events-none select-none flex flex-col gap-2">
                        
                        {/* Tip 1: Extremes */}
                        {visibleTips.extremes && (
                            <div className="bg-white/90 backdrop-blur-sm border border-blue-100 shadow-sm rounded-xl p-3 flex gap-2 animate-in fade-in slide-in-from-top-4 duration-700 pr-8 relative pointer-events-none">
                                <span className="text-base select-none">💡</span>
                                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                    {t('fine.tips.extremes')}
                                </p>
                                <button 
                                    onClick={() => setVisibleTips(prev => ({ ...prev, extremes: false }))}
                                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors pointer-events-auto"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        
                        {/* Tip 2: Vertical Order */}
                        {visibleTips.vertical && (
                            <div className="bg-blue-50/90 backdrop-blur-sm border border-blue-100 shadow-sm rounded-xl p-3 flex gap-2 animate-in fade-in slide-in-from-top-6 duration-1000 delay-150 relative pr-8 pointer-events-none">
                                <span className="text-base select-none">ℹ️</span>
                                <p className="text-sm text-blue-800 leading-relaxed font-medium">
                                    {t('fine.tips.vertical')}
                                </p>
                                <button 
                                    onClick={() => setVisibleTips(prev => ({ ...prev, vertical: false }))}
                                    className="absolute top-2 right-2 p-1 text-blue-300 hover:text-blue-500 rounded-full hover:bg-blue-100/50 transition-colors pointer-events-auto"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <TransformWrapper
                    ref={transformRef}
                    initialScale={0.8}
                    minScale={0.1}
                    maxScale={3.0}
                    centerOnInit={false}
                    limitToBounds={false}
                    wheel={{ step: 0.1 }}
                    panning={{ excluded: ['dnd-prevent-pan'] }}
                >
                    {() => (
                        <TransformComponent 
                            wrapperClass="w-full h-full !overflow-hidden" 
                            contentClass="" 
                        >
                            <div 
                                data-testid="grid-container"
                                ref={contentRef}
                                className="flex flex-col items-center gap-8 px-4 py-12"
                            >
                                {/* THE PYRAMID GRID */}
                                <div className="flex flex-row gap-2 items-end flex-nowrap">
                                    {gridColumns.map((col, colIndex) => {
                                    const score = col.score;
                                    const columnTint = getColumnTint(score);

                                    return (
                                        <div key={score} className="flex flex-col gap-2 items-center flex-shrink-0">
                                                
                                                {/* Slots Column */}
                                                <div className="flex flex-col gap-2">
                                                    {Array.from({ length: col.capacity }).map((_, rowIndex) => (
                                                        <DroppableSlot
                                                            key={`${colIndex}-${rowIndex}`}
                                                            id={`slot_${colIndex}_${rowIndex}`}
                                                            onClick={() => onSlotClick?.(colIndex, rowIndex)}
                                                            className={`
                                                                w-[160px] sm:w-[180px] md:w-[200px] 
                                                                h-[96px] sm:h-[110px]
                                                                border-2 border-dashed border-slate-300/80 rounded-xl 
                                                                flex items-center justify-center
                                                                ${columnTint} bg-opacity-40
                                                                transition-all duration-300
                                                                shadow-sm
                                                                ${selectedCardId ? 'animate-pulse ring-2 ring-blue-400/30 cursor-pointer hover:bg-blue-50' : ''}
                                                            `}
                                                        >
                                                            {renderSlotContent(colIndex, rowIndex)}
                                                        </DroppableSlot>
                                                    ))}
                                                </div>

                                                {/* Column Footer */}
                                                <div className="text-slate-400 mt-1">
                                                    <span className="text-lg font-bold leading-none">{score > 0 ? `+${score}` : score}</span>
                                                </div>
                                        </div>
                                    );
                                })}
                                </div>

                                    {/* 2. THE BOTTOM SPECTRUM LEGEND */}
                                    <div className="w-full max-w-[90%] flex flex-col gap-3 pt-4 border-t border-slate-200/50">
                                         {/* Labels */}
                                         <div className="flex justify-between w-full text-sm font-bold uppercase tracking-widest opacity-80 px-2">
                                             <span className="text-red-600">{t('fine.legend.disagree')}</span>
                                             <span className="text-slate-400">{t('fine.legend.neutral')}</span>
                                             <span className="text-green-600">{t('fine.legend.agree')}</span>
                                         </div>
                                         {/* Gradient Bar */}
                                         <div className="w-full h-3 bg-gradient-to-r from-red-500/30 via-slate-200 to-green-500/30 rounded-full relative backdrop-blur-sm">
                                             {/* Center Tick */}
                                             <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-400/50 -translate-x-1/2"></div>
                                             {/* End Ticks */}
                                             <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-400/50"></div>
                                             <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-green-400/50"></div>
                                         </div>
                                    </div>
                                </div>
                        </TransformComponent>
                    )}
                </TransformWrapper>
           </div>
      </div>

    </div>
  );
};

export default GridSort;
