'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { acceptOptimizerProposal } from '@/app/actions/optimizer';
import { OptimizationProposal, Technician } from '@prisma/client';

type ProposalWithTech = OptimizationProposal & { proposedTechnician?: Technician };

export function OptimizerClient({ proposals }: { proposals: ProposalWithTech[] }) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  async function handleAccept(proposal: ProposalWithTech) {
    setProcessingId(proposal.id);
    setError(null);
    
    const result = await acceptOptimizerProposal(proposal.id);
    
    if (result.success) {
      setSuccessId(proposal.id);
    } else {
      setError(result.error || 'Failed to apply proposal');
    }
    
    setProcessingId(null);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm border border-red-200 rounded-lg">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {proposals.map(proposal => {
        const isProcessing = processingId === proposal.id;
        const isSuccess = successId === proposal.id;

        return (
          <div key={proposal.id} className={`p-4 border rounded-xl transition-colors ${isSuccess ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-neutral-200 hover:border-blue-300'}`}>
            {isSuccess ? (
              <div className="flex items-center gap-2 text-emerald-700 font-medium">
                <CheckCircle className="h-5 w-5" />
                Proposal Accepted & Scheduled
              </div>
            ) : (
              <>
                <p className="text-sm text-neutral-800 font-medium mb-3">{proposal.reason}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm">
                     <span className="text-neutral-500 line-through decoration-red-400">Orig: {proposal.originalTechnicianId.slice(0,4)}</span>
                     <ArrowRight className="h-4 w-4 text-neutral-400" />
                     <span className="font-semibold text-blue-700">{proposal.proposedTechnician?.firstName || 'New Tech'}</span>
                  </div>
                  
                  <button 
                    onClick={() => handleAccept(proposal)}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center"
                  >
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {isProcessing ? 'Validating...' : 'Accept'}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
