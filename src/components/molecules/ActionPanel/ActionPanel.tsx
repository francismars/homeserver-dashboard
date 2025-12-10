'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/libs/utils';
import type { ActionPanelProps } from './ActionPanel.types';

export function ActionPanel({
  title,
  description,
  actionLabel,
  confirmLabel,
  confirmMessage,
  placeholder,
  inputType = 'text',
  isLoading,
  error,
  onAction,
  className,
  destructive = false,
}: ActionPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = async () => {
    if (!inputValue.trim()) return;
    try {
      await onAction(inputValue.trim());
      setInputValue('');
      setIsOpen(false);
    } catch (err) {
      // Error handled by parent
    }
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error.message || 'Action failed'}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="action-input">{placeholder}</Label>
          <Input
            id="action-input"
            type={inputType}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                setIsOpen(true);
              }
            }}
          />
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant={destructive ? 'destructive' : 'default'} disabled={!inputValue.trim() || isLoading}>
              {actionLabel}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Action</DialogTitle>
              <DialogDescription>{confirmMessage || `Are you sure you want to ${actionLabel.toLowerCase()}?`}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                <strong>Input:</strong> <code className="rounded bg-muted px-2 py-1 font-mono">{inputValue}</code>
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                variant={destructive ? 'destructive' : 'default'}
                onClick={handleConfirm}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Processing...
                  </>
                ) : (
                  confirmLabel || 'Confirm'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

