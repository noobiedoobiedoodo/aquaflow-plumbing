'use client';

import { create } from 'zustand';

// Simple global state for the modal using Zustand
interface DispatchStore {
  isOpen: boolean;
  selectedJob: any | null;
  openModal: (job: any) => void;
  closeModal: () => void;
}

export const useDispatchStore = create<DispatchStore>((set) => ({
  isOpen: false,
  selectedJob: null,
  openModal: (job) => set({ isOpen: true, selectedJob: job }),
  closeModal: () => set({ isOpen: false, selectedJob: null }),
}));
