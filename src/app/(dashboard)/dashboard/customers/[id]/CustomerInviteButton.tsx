'use client';

import { useState } from 'react';
import { Send, Loader2, CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendCustomerPortalInvitation } from '@/app/actions/customers';
import { toast } from 'sonner';

export function CustomerInviteButton({ customerId, customerEmail }: { customerId: string; customerEmail: string }) {
  const [isSending, setIsSending] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);

  const handleSendInvite = async () => {
    setIsSending(true);
    const res = await sendCustomerPortalInvitation(customerId);
    setIsSending(false);

    if (res.success && res.magicLinkUrl) {
      setInvitationUrl(res.magicLinkUrl);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(res.magicLinkUrl);
      }
      toast.success(`Portal link generated & copied to clipboard for ${customerEmail}!`);
    } else {
      toast.error(res.error || 'Failed to send invitation');
    }
  };

  const copyInviteLink = () => {
    if (invitationUrl) {
      navigator.clipboard.writeText(invitationUrl);
      toast.success('Magic link copied to clipboard!');
    }
  };

  return (
    <div className="flex items-center gap-2">
      {invitationUrl ? (
        <Button
          onClick={copyInviteLink}
          variant="secondary"
          size="sm"
          className="border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1.5"
        >
          <Copy className="w-3.5 h-3.5" /> Copy Portal Link
        </Button>
      ) : (
        <Button
          onClick={handleSendInvite}
          disabled={isSending}
          size="sm"
          className="bg-primary-blue hover:bg-blue-600 text-white flex items-center gap-1.5 shadow-md"
        >
          {isSending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" /> Send Portal Invite
            </>
          )}
        </Button>
      )}
    </div>
  );
}
