'use client';

import { useState } from 'react';
import { addJobPart } from '@/app/actions/tech';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Wrench, Plus, DollarSign } from 'lucide-react';

export function PartsTab({ job }: { job: any }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const canEdit = job.status === 'WORKING';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !unitCost) return;

    setIsAdding(true);
    try {
      await addJobPart(job.id, name, quantity, parseFloat(unitCost));
      toast.success('Part added');
      setName('');
      setQuantity(1);
      setUnitCost('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsAdding(false);
    }
  };

  const totalCost = job.parts.reduce((acc: number, p: any) => acc + (p.quantity * p.unitCost), 0);

  return (
    <div className="space-y-6">
      {canEdit && (
        <form onSubmit={handleAdd} className="glass p-4 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-2">Record Material</h3>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Part description (e.g. 1/2 Copper Pipe)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-secondary-bg/50 border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-blue"
              required
            />
            
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  className="w-full bg-secondary-bg/50 border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-blue"
                  required
                />
              </div>
              <div className="flex-[2] relative">
                <DollarSign className="absolute left-3 top-3.5 w-4 h-4 text-muted-text" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Unit Cost"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full bg-secondary-bg/50 border border-border rounded-lg pl-9 pr-4 py-3 text-white focus:outline-none focus:border-primary-blue"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={isAdding} className="w-full font-bold">
              <Plus className="w-4 h-4 mr-2" /> Add Part
            </Button>
          </div>
        </form>
      )}

      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider">Recorded Parts</h3>
          <span className="text-primary-blue font-bold">${totalCost.toFixed(2)}</span>
        </div>
        
        {job.parts.length === 0 ? (
          <div className="text-center p-6 border border-dashed border-border/50 rounded-xl">
            <Wrench className="w-6 h-6 text-muted-text mx-auto mb-2" />
            <p className="text-muted-text text-sm">No parts recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {job.parts.map((part: any) => (
              <div key={part.id} className="glass p-3 rounded-lg border border-border/50 flex justify-between items-center">
                <div>
                  <div className="font-bold text-white text-sm">{part.name}</div>
                  <div className="text-xs text-muted-text">{part.quantity} x ${part.unitCost.toFixed(2)}</div>
                </div>
                <div className="font-bold text-white">
                  ${(part.quantity * part.unitCost).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
