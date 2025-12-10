export type InviteListProps = {
  invites: string[];
  onGenerate: () => Promise<void>;
  isGenerating?: boolean;
  className?: string;
};

