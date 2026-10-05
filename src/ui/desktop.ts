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

export interface SaveProjectOptions {
  documentId: string;
  suggestedName: string;
  data: string;
  saveAs?: boolean;
}

export interface DesktopProjectFile {
  name: string;
  text: string;
  path: string;
  openToken: string;
}

/** Desktop-generated stdio configuration and the prerequisites for connecting an agent. */
export interface McpConfiguration {
  configuration: string;
  requirements: string[];
  executablePath?: string;
}

declare global {
  interface Window {
    boneStudio?: {
      /** Generate MCP client JSON for the current installation, without exposing local tokens. */
      getMcpConfiguration(): Promise<McpConfiguration>;
      /** Copy the current installation's MCP client JSON using the native clipboard. */
      copyMcpConfiguration(): Promise<void>;
      openProject(options: { documentId: string }): Promise<DesktopProjectFile | null>;
      setProjectSession(options: { documentId: string; openToken?: string }): Promise<void>;
      saveProject(options: SaveProjectOptions): Promise<string | null>;
      importImages(): Promise<import('@/core/types').Asset[]>;
      saveFile(options: SaveFileOptions): Promise<string | null>;
      exportFile(options: SaveFileOptions): Promise<string | null>;
      onAutomationRequest(handler: (request: AutomationRequest) => void): () => void;
      replyAutomation(reply: AutomationReply): void;
    };
  }
}
