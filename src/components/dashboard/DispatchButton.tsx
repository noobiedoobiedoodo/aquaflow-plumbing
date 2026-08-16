'use client';

import { Button } from '@/components/ui/button';
import { useDispatchStore } from './dispatchStore';

export function DispatchButton({ job }: { job: any }) {
  const openModal = useDispatchStore((state) => state.openModal);

  return (
    <Button 
      onClick={() => openModal(job)}
      className="w-full bg-primary-blue/20 hover:bg-primary-blue text-white border border-primary-blue/50 transition-colors"
    >
      Dispatch Technician
    </Button>
  );
}
