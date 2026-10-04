export interface AutomationRequest {
  id: string;
  method: string;
  params: unknown;
}

export interface AutomationReply {
  id: string;
  result?: unknown;
  error?: string;
}

export interface SaveFileOptions {
  suggestedName: string;
  data: string;
  encoding?: 'utf8' | 'base64';
  filters?: { name: string; extensions: string[] }[];
}

declare global {
  interface Window {
    boneStudio?: {
      openProject(): Promise<{ name: string; text: string } | null>;
      importImages(): Promise<import('@/core/types').Asset[]>;
      saveFile(options: SaveFileOptions): Promise<string | null>;
      exportFile(options: SaveFileOptions): Promise<string | null>;
      onAutomationRequest(handler: (request: AutomationRequest) => void): () => void;
      replyAutomation(reply: AutomationReply): void;
    };
  }
}
