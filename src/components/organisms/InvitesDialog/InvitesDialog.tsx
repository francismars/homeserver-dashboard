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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check, Plus, Key, Info } from 'lucide-react';
import { copyToClipboard } from '@/libs/utils';

// Mock invite stats
const MOCK_INVITE_STATS = {
  totalGenerated: 12,
  totalUsed: 8,
  totalUnused: 4,
  usersByInvite: [
    { inviteCode: 'INV-2024-001', userCount: 3 },
    { inviteCode: 'INV-2024-002', userCount: 2 },
    { inviteCode: 'INV-2024-003', userCount: 2 },
    { inviteCode: 'INV-2024-004', userCount: 1 },
  ],
};

interface InvitesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invites: string[];
  onGenerate: () => Promise<void>;
  isGenerating?: boolean;
}

export function InvitesDialog({ open, onOpenChange, invites, onGenerate, isGenerating }: InvitesDialogProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (invite: string, index: number) => {
    try {
      await copyToClipboard({ text: invite });
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Handle copy error silently
    }
  };

  const handleGenerate = async () => {
    await onGenerate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Invite Management
          </DialogTitle>
          <DialogDescription>Generate signup tokens and view invite statistics</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {/* Generated Invites */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Generated Invites</CardTitle>
                  <CardDescription>Recently generated signup tokens</CardDescription>
                </div>
                <Button onClick={handleGenerate} disabled={isGenerating} size="sm">
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
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No invite codes generated yet. Click &quot;Generate&quot; to create one.
                </p>
              ) : (
                <div className="space-y-2">
                  {invites.map((invite, index) => (
                    <div key={index} className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
                      <code className="flex-1 font-mono text-sm">{invite}</code>
                      <Button variant="ghost" size="sm" onClick={() => handleCopy(invite, index)} className="ml-2">
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

          {/* Mock Stats Section */}
          <Card className="border-2 border-dashed border-muted-foreground/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Invite Statistics</CardTitle>
                <Badge variant="outline" className="border-dashed text-xs font-normal">
                  <Info className="mr-1 h-3 w-3" />
                  Mock
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground/70 italic">
                Statistics require backend tracking of invite usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground/70 italic">
                    {MOCK_INVITE_STATS.totalGenerated}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground/70 italic">Total Generated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground/70 italic">
                    {MOCK_INVITE_STATS.totalUsed}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground/70 italic">Used</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground/70 italic">
                    {MOCK_INVITE_STATS.totalUnused}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground/70 italic">Unused</div>
                </div>
              </div>
              <div className="mt-4 border-t border-dashed border-muted-foreground/20 pt-4">
                <div className="mb-2 text-xs font-medium text-muted-foreground/70 italic">Users by Invite:</div>
                <div className="space-y-1">
                  {MOCK_INVITE_STATS.usersByInvite.map((item) => (
                    <div key={item.inviteCode} className="flex justify-between text-xs text-muted-foreground/70 italic">
                      <span className="font-mono">{item.inviteCode}:</span>
                      <span>{item.userCount} users</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
