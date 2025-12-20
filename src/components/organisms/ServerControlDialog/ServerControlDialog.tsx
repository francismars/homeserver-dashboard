'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

interface ServerControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: 'restart' | 'shutdown' | null;
}

export function ServerControlDialog({ open, onOpenChange, action }: ServerControlDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!action) {
    return null;
  }

  const handleConfirm = async () => {
    setIsProcessing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsProcessing(false);
    onOpenChange(false);
    // In real implementation, this would call the backend API
  };

  const isRestart = action === 'restart';
  const title = isRestart ? 'Restart Homeserver' : 'Shutdown Homeserver';
  const description = isRestart
    ? 'Are you sure you want to restart the homeserver? All active connections will be terminated and the server will restart. This may take a few moments.'
    : 'Are you sure you want to shutdown the homeserver? All active connections will be terminated and the server will stop. You will need to manually start it again.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-base sm:text-lg">{title}</DialogTitle>
            <Badge variant="outline" className="border-dashed text-xs font-normal">
              <Info className="mr-1 h-3 w-3" />
              Soon
            </Badge>
          </div>
          <DialogDescription className="text-xs sm:text-sm">{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
            <div className="flex-1">
              <p className="text-sm font-medium">{isRestart ? 'Server will restart' : 'Server will shutdown'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isRestart
                  ? 'The homeserver will restart automatically after shutdown.'
                  : 'The homeserver will stop and will not restart automatically.'}
              </p>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground/70 italic">
            This is mock functionality. In production, this would call the backend API to control the homeserver
            process.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button variant={isRestart ? 'default' : 'destructive'} onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span className="hidden sm:inline">{isRestart ? 'Restarting...' : 'Shutting down...'}</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>{isRestart ? 'Restart' : 'Shutdown'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
