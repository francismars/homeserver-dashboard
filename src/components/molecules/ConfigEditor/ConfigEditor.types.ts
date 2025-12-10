export type ConfigEditorProps = {
  configToml: string | null;
  checksum?: string;
  isLoading?: boolean;
  isSaving?: boolean;
  error?: Error | null;
  onSave: (configToml: string, checksum?: string) => Promise<void>;
  onReset?: () => void;
  className?: string;
};

