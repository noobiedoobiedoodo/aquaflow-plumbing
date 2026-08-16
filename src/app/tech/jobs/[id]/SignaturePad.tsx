'use client';

import { useState, useRef } from 'react';
import { captureSignatureAndComplete } from '@/app/actions/tech';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle, X, PenTool, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import SignatureCanvas from 'react-signature-canvas';

export function SignaturePad({ job, onCancel }: { job: any; onCancel: () => void }) {
  const [signerName, setSignerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  // Completion Checklist State
  const [checks, setChecks] = useState({
    workCompleted: false,
    areaCleaned: false,
    customerInformed: false,
    partsRecorded: false,
  });

  const allChecked = Object.values(checks).every(Boolean);

  const handleClear = () => {
    sigCanvas.current?.clear();
  };

  const handleComplete = async () => {
    if (!allChecked) {
      toast.error('Please complete all checklist items');
      return;
    }

    if (sigCanvas.current?.isEmpty()) {
      toast.error('Customer signature is required');
      return;
    }

    if (!signerName.trim()) {
      toast.error('Signer name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const signatureBlob = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') || '';
      await captureSignatureAndComplete(job.id, signatureBlob, signerName);
      toast.success('Job Successfully Completed!');
      // It will navigate to dashboard because of revalidatePath, or we can handle it via the layout.
    } catch (e: any) {
      toast.error(e.message);
      setIsSubmitting(false);
    }
  };

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24 animate-in slide-in-from-bottom-4 duration-300">
      <header className="p-4 border-b border-border/50 sticky top-0 bg-background/90 backdrop-blur-xl z-10 flex items-center justify-between">
        <h2 className="font-bold text-lg text-white">Complete Job</h2>
        <button onClick={onCancel} className="p-2 bg-white/5 rounded-full text-muted-text hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="p-4 space-y-8 flex-1">
        
        {/* Checklist */}
        <section>
          <h3 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-4">Completion Checklist</h3>
          <div className="space-y-2">
            {[
              { id: 'workCompleted', label: 'All requested work completed' },
              { id: 'areaCleaned', label: 'Work area cleaned and restored' },
              { id: 'customerInformed', label: 'Customer informed of repairs made' },
              { id: 'partsRecorded', label: 'All parts and materials recorded' },
            ].map((item) => {
              const isChecked = checks[item.id as keyof typeof checks];
              return (
                <div 
                  key={item.id} 
                  onClick={() => toggleCheck(item.id as keyof typeof checks)}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                    isChecked ? "bg-success/10 border-success/30 text-white" : "glass border-border/50 text-muted-text"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    isChecked ? "bg-success border-success text-black" : "border-muted-text"
                  )}>
                    {isChecked && <CheckCircle className="w-4 h-4" />}
                  </div>
                  <span className="font-medium text-sm select-none">{item.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Signature Capture */}
        <section className={cn("transition-opacity duration-300", !allChecked ? "opacity-50 pointer-events-none" : "opacity-100")}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-muted-text uppercase tracking-widest">Customer Authorization</h3>
            <button onClick={handleClear} className="text-xs font-bold text-primary-blue uppercase tracking-wider">
              Clear
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="glass rounded-xl border border-border/50 overflow-hidden bg-white/5">
              <SignatureCanvas 
                ref={sigCanvas}
                penColor="white"
                canvasProps={{ className: "w-full h-48 cursor-crosshair touch-none" }}
              />
              <div className="bg-white/5 p-2 text-center border-t border-border/50 flex items-center justify-center gap-2">
                <PenTool className="w-4 h-4 text-muted-text" />
                <span className="text-xs text-muted-text font-medium uppercase tracking-wider">Sign Above</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-text uppercase tracking-wider pl-1">Print Name</label>
              <input
                type="text"
                placeholder="Customer Name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="w-full bg-secondary-bg/50 border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-blue text-lg"
              />
            </div>
            
            <p className="text-xs text-muted-text/70 leading-relaxed text-center px-4">
              By signing above, I acknowledge that the work described has been completed satisfactorily and that I authorize the materials and labor recorded.
            </p>
          </div>
        </section>

      </div>

      <div className="p-4 bg-background/90 backdrop-blur-xl border-t border-border/50 sticky bottom-0">
        <Button 
          onClick={handleComplete} 
          disabled={!allChecked || isSubmitting} 
          className="w-full py-6 text-lg font-bold bg-success hover:bg-success/90 text-white"
        >
          {isSubmitting ? 'Submitting...' : 'Confirm & Complete Job'}
        </Button>
      </div>
    </div>
  );
}
