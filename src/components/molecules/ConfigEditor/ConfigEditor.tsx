'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/libs/utils';
import type { ConfigEditorProps } from './ConfigEditor.types';

export function ConfigEditor({
  configToml,
  checksum,
  isLoading,
  isSaving,
  error,
  onSave,
  onReset,
  className,
}: ConfigEditorProps) {
  const [localConfig, setLocalConfig] = useState(configToml || '');
  const [hasChanges, setHasChanges] = useState(false);

  // Update local config when prop changes
  React.useEffect(() => {
    if (configToml !== null) {
      setLocalConfig(configToml);
      setHasChanges(false);
    }
  }, [configToml]);

  const handleChange = (value: string) => {
    setLocalConfig(value);
    setHasChanges(value !== (configToml || ''));
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    try {
      await onSave(localConfig, checksum);
      setHasChanges(false);
    } catch (err) {
      // Error handled by parent
    }
  };

  const handleReset = () => {
    setLocalConfig(configToml || '');
    setHasChanges(false);
    onReset?.();
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Configuration Editor</CardTitle>
        <CardDescription>
          Edit your homeserver configuration. Changes are saved with conflict detection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {checksum && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Checksum:</span>
            <code className="rounded bg-muted px-2 py-1 font-mono">{checksum}</code>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message || 'Failed to save configuration'}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Textarea
            value={localConfig}
            onChange={(e) => handleChange(e.target.value)}
            disabled={isLoading || isSaving}
            className="font-mono text-sm min-h-[400px]"
            placeholder="[server]\nport = 8080\n..."
          />
          {hasChanges && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>You have unsaved changes</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleReset} disabled={!hasChanges || isSaving || isLoading}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving || isLoading}>
          {isSaving ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

