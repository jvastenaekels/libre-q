import { create } from 'zustand';

interface UIState {
    zoomedCard: { id: number; text: string } | null;
    setZoomedCard: (card: { id: number; text: string } | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
    zoomedCard: null,
    setZoomedCard: (zoomedCard) => set({ zoomedCard }),
}));
