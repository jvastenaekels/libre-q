import { create } from 'zustand';

interface UIState {
    hoveredCard: { id: number; text: string } | null;
    activeCard: { id: number; text: string } | null;
    selectedCard: { id: number; text: string } | null;
    setHoveredCard: (card: { id: number; text: string } | null) => void;
    setActiveCard: (card: { id: number; text: string } | null) => void;
    setSelectedCard: (card: { id: number; text: string } | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
    hoveredCard: null,
    activeCard: null,
    selectedCard: null,
    setHoveredCard: (hoveredCard) => set({ hoveredCard }),
    setActiveCard: (activeCard) => set({ activeCard }),
    setSelectedCard: (selectedCard) => set({ selectedCard }),
}));
