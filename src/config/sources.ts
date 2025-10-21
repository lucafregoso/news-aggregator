export enum SourceType {
  RSS = 'RSS',
  YOUTUBE = 'YOUTUBE',
  IMAP = 'IMAP',
}

export interface RSSConfig {
  feedUrl: string;
}

export interface YouTubeConfig {
  channelId: string;
}

export interface IMAPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  folders: string[];
  tls?: boolean;
}

export type SourceConfig = RSSConfig | YouTubeConfig | IMAPConfig;

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  config: SourceConfig;
  active: boolean;
  lastChecked?: Date;
  createdAt: Date;
  updatedAt: Date;
}
