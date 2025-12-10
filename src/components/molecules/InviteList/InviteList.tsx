'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check, Plus } from 'lucide-react';
import { cn } from '@/libs/utils';
import { copyToClipboard } from '@/libs/utils';
import type { InviteListProps } from './InviteList.types';

export function InviteList({
  invites,
  onGenerate,
  isGenerating,
  className,
}: InviteListProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (invite: string, index: number) => {
    try {
      await copyToClipboard({ text: invite });
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      // Handle copy error silently or show toast
    }
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Invite Codes</CardTitle>
            <CardDescription>Generate and manage signup tokens</CardDescription>
          </div>
          <Button onClick={onGenerate} disabled={isGenerating} size="sm">
            {isGenerating ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No invite codes generated yet. Click "Generate" to create one.
          </p>
        ) : (
          <div className="space-y-2">
            {invites.map((invite, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-md border bg-muted/50 p-3"
              >
                <code className="flex-1 font-mono text-sm">{invite}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(invite, index)}
                  className="ml-2"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

