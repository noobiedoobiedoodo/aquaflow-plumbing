'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export function RealTimeListener() {
  const router = useRouter();

  useEffect(() => {
    const eventSource = new EventSource('/api/realtime');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'NEW_TASKS') {
          toast(`New ${data.tasks.length} task(s) received`);
          router.refresh(); // Refresh Server Components!
        }
        
      } catch (err) {
        // Parse error
      }
    };

    eventSource.onerror = () => {
      console.warn("SSE connection lost. Reconnecting...");
      eventSource.close();
      // Reconnect logic usually handled natively by EventSource, but we can manage retries if needed.
    };

    return () => {
      eventSource.close();
    };
  }, [router]);

  return null; // Headless component
}
