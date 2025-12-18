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
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Check, Plus, Key, Info } from 'lucide-react';
import { copyToClipboard } from '@/libs/utils';

const MOCK_USERS_BY_INVITE = [
  { inviteCode: 'INV-2024-001', userCount: 3 },
  { inviteCode: 'INV-2024-002', userCount: 2 },
  { inviteCode: 'INV-2024-003', userCount: 2 },
  { inviteCode: 'INV-2024-004', userCount: 1 },
] as const;

interface InvitesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invites: string[];
  onGenerate: () => Promise<void>;
  isGenerating?: boolean;
  signupCodesTotal?: number;
  signupCodesUnused?: number;
  isStatsLoading?: boolean;
}

export function InvitesDialog({
  open,
  onOpenChange,
  invites,
  onGenerate,
  isGenerating,
  signupCodesTotal,
  signupCodesUnused,
  isStatsLoading,
}: InvitesDialogProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const hasStats = typeof signupCodesTotal === 'number' && typeof signupCodesUnused === 'number';
  const totalGenerated = hasStats ? signupCodesTotal : undefined;
  const totalUnused = hasStats ? signupCodesUnused : undefined;
  const totalUsed = hasStats ? Math.max(0, signupCodesTotal - signupCodesUnused) : undefined;

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
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Invite Statistics</CardTitle>
                {!hasStats && (
                  <Badge variant="outline" className="border-dashed text-xs font-normal">
                    <Info className="mr-1 h-3 w-3" />
                    Unavailable
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-muted-foreground/70">
                Counts are provided by the homeserver. Per-invite usage breakdown requires additional backend endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {isStatsLoading ? (
                      <Skeleton className="mx-auto h-7 w-12" />
                    ) : (
                      (totalGenerated ?? '—')
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground/70">Total Generated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {isStatsLoading ? <Skeleton className="mx-auto h-7 w-12" /> : (totalUsed ?? '—')}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground/70">Used</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {isStatsLoading ? <Skeleton className="mx-auto h-7 w-12" /> : (totalUnused ?? '—')}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground/70">Unused</div>
                </div>
              </div>
              <div className="mt-4 border-t border-muted-foreground/20 pt-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="text-xs font-medium text-muted-foreground/70">Users by Invite:</div>
                  <Badge variant="outline" className="border-dashed text-xs font-normal">
                    <Info className="mr-1 h-3 w-3" />
                    Soon
                  </Badge>
                </div>
                <div className="space-y-1">
                  {MOCK_USERS_BY_INVITE.map((item) => (
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

