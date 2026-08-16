'use client';

import { useState } from 'react';
import { addJobNote } from '@/app/actions/tech';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MessageSquare, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NotesTab({ job }: { job: any }) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<'TECHNICIAN' | 'INTERNAL'>('TECHNICIAN');
  const [isAdding, setIsAdding] = useState(false);

  const canEdit = job.status !== 'COMPLETED' && job.status !== 'CANCELLED';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsAdding(true);
    try {
      await addJobNote(job.id, content, type);
      toast.success('Note added');
      setContent('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {canEdit && (
        <form onSubmit={handleAdd} className="glass p-4 rounded-xl border border-border/50 space-y-4">
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setType('TECHNICIAN')}
              className={cn(
                "flex-1 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors border",
                type === 'TECHNICIAN' ? "bg-primary-blue/20 text-primary-blue border-primary-blue/30" : "border-transparent text-muted-text hover:bg-white/5"
              )}
            >
              Job Note
            </button>
            <button
              type="button"
              onClick={() => setType('INTERNAL')}
              className={cn(
                "flex-1 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors border",
                type === 'INTERNAL' ? "bg-amber-500/20 text-amber-500 border-amber-500/30" : "border-transparent text-muted-text hover:bg-white/5"
              )}
            >
              Internal Only
            </button>
          </div>
          
          <textarea
            rows={3}
            placeholder={type === 'TECHNICIAN' ? "Add a note about the work performed..." : "Private note for dispatchers..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-secondary-bg/50 border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-blue resize-none"
            required
          />
          
          <Button type="submit" disabled={isAdding} className="w-full font-bold">
            <Send className="w-4 h-4 mr-2" /> Post Note
          </Button>
        </form>
      )}

      <div className="space-y-4">
        {job.notes.length === 0 ? (
          <div className="text-center p-6 border border-dashed border-border/50 rounded-xl">
            <MessageSquare className="w-6 h-6 text-muted-text mx-auto mb-2" />
            <p className="text-muted-text text-sm">No notes on this job yet.</p>
          </div>
        ) : (
          job.notes.map((note: any) => {
            const isInternal = note.type === 'INTERNAL';
            const isDispatcher = note.type === 'DISPATCHER';
            
            return (
              <div 
                key={note.id} 
                className={cn(
                  "p-4 rounded-xl border",
                  isInternal ? "bg-amber-500/5 border-amber-500/20" : 
                  isDispatcher ? "bg-water-cyan/5 border-water-cyan/20" : 
                  "glass border-border/50"
                )}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      {note.author.firstName} {note.author.lastName}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                      isInternal ? "bg-amber-500/20 text-amber-500" :
                      isDispatcher ? "bg-water-cyan/20 text-water-cyan" :
                      "bg-white/10 text-muted-text"
                    )}>
                      {note.type}
                    </span>
                  </div>
                  <span className="text-xs text-muted-text">
                    {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', month: 'short', day: 'numeric' }).format(new Date(note.createdAt))}
                  </span>
                </div>
                <p className="text-white/90 text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
