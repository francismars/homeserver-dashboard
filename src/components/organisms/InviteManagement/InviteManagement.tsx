'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Info, Copy, Check, QrCode, X, Gift, Plus } from 'lucide-react';
import { copyToClipboard } from '@/libs/utils';
import { QRCodeSVG } from 'qrcode.react';

export interface InviteManagementProps {
  invites: string[];
  onGenerate: () => Promise<void>;
  isGenerating?: boolean;
  signupCodesTotal?: number;
  signupCodesUnused?: number;
  isStatsLoading?: boolean;
  homeserverPubkey?: string;
}

export function InviteManagement({
  invites,
  onGenerate,
  isGenerating,
  signupCodesTotal,
  signupCodesUnused,
  isStatsLoading,
  homeserverPubkey,
}: InviteManagementProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedUrlIndex, setCopiedUrlIndex] = useState<number | null>(null);
  const [expandedInviteIndex, setExpandedInviteIndex] = useState<number | null>(null);

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

  const generateSignupUrl = (inviteCode: string): string | null => {
    if (!homeserverPubkey) return null;
    return `pubkyauth://signup?hs=${encodeURIComponent(homeserverPubkey)}&st=${encodeURIComponent(inviteCode)}`;
  };

  const handleCopyUrl = async (inviteCode: string, index: number) => {
    const url = generateSignupUrl(inviteCode);
    if (!url) return;
    try {
      await copyToClipboard({ text: url });
      setCopiedUrlIndex(index);
      setTimeout(() => setCopiedUrlIndex(null), 2000);
    } catch {
      // Handle copy error silently
    }
  };

  const handleGenerate = async () => {
    await onGenerate();
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">Invite Management</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Create invite codes for new users. Statistics are shown below.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating}
            title="New invite"
            aria-label="New invite"
          >
            {isGenerating ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <div className="mx-6 h-px bg-border/60" />

      <CardContent className="space-y-6 pt-4">
        {/* Invite Statistics */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Invite statistics</h3>
            {!hasStats && (
              <Badge variant="outline" className="border-dashed text-xs font-normal">
                <Info className="mr-1 h-3 w-3" />
                Unavailable
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <div className="text-2xl font-bold tabular-nums">
                {isStatsLoading ? <Skeleton className="mx-auto h-7 w-10" /> : (totalGenerated ?? '—')}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Total generated</div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <div className="text-2xl font-bold tabular-nums">
                {isStatsLoading ? <Skeleton className="mx-auto h-7 w-10" /> : (totalUsed ?? '—')}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Used</div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <div className="text-2xl font-bold tabular-nums">
                {isStatsLoading ? <Skeleton className="mx-auto h-7 w-10" /> : (totalUnused ?? '—')}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Unused</div>
            </div>
          </div>
        </div>

        {/* Generated invites */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-foreground">Invite codes</h3>
          {invites.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-12 px-4 text-center">
              <Gift className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No invite codes yet</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Create an invite code to share with someone. They can use it in the Pubky Ring app to join this
                homeserver.
              </p>
              <Button onClick={handleGenerate} disabled={isGenerating} size="sm" className="mt-4">
                {isGenerating ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create invite
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map((invite, index) => {
                const signupUrl = generateSignupUrl(invite);
                const isExpanded = expandedInviteIndex === index;
                return (
                  <div key={index} className="rounded-lg border bg-muted/40 p-3 sm:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {invites.length > 1 && (
                          <span className="mb-1 block text-xs font-medium text-muted-foreground">
                            Invite {index + 1}
                          </span>
                        )}
                        <code className="font-mono text-xs break-all sm:text-sm sm:break-normal">
                          {invite}
                        </code>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant={copiedIndex === index ? 'secondary' : 'ghost'}
                          size="icon"
                          onClick={() => handleCopy(invite, index)}
                          className="h-8 w-8 shrink-0"
                          title={copiedIndex === index ? 'Copied' : 'Copy code'}
                        >
                          {copiedIndex === index ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        {signupUrl && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setExpandedInviteIndex(isExpanded ? null : index)}
                            className="h-8 w-8"
                            title={isExpanded ? 'Hide QR Code' : 'Show QR Code'}
                          >
                            {isExpanded ? (
                              <X className="h-4 w-4" />
                            ) : (
                              <QrCode className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded QR Code / Signup URL Section */}
                    {isExpanded && signupUrl && (
                      <div className="mt-4 rounded-lg border bg-muted/30 p-4">
                        <p className="mb-3 text-xs font-medium text-muted-foreground">
                          Share invite — scan with Pubky Ring or copy the link
                        </p>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                          <div className="flex flex-col items-center gap-2 shrink-0">
                            <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
                              <QRCodeSVG value={signupUrl} size={160} level="M" />
                            </div>
                            <span className="text-xs text-muted-foreground">QR code</span>
                          </div>
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                              <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">
                                {signupUrl}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyUrl(invite, index)}
                                className="h-8 shrink-0 gap-1.5"
                                title={copiedUrlIndex === index ? 'Copied' : 'Copy URL'}
                              >
                                {copiedUrlIndex === index ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                                <span className="text-xs">
                                  {copiedUrlIndex === index ? 'Copied' : 'Copy URL'}
                                </span>
                              </Button>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopy(invite, index)}
                              className="text-xs"
                            >
                              {copiedIndex === index ? (
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                              ) : (
                                <Copy className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              {copiedIndex === index ? 'Code copied' : 'Copy code only'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
