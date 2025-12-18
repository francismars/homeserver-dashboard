export type WebDavFile = {
  href: string;
  displayName: string;
  contentType: string;
  contentLength?: number;
  lastModified?: string;
  isCollection: boolean;
  path: string;
};

export type WebDavDirectory = {
  path: string;
  files: WebDavFile[];
};

export type WebDavServiceDeps = {
  baseUrl: string;
  username: string;
  password: string;
};

export type WebDavError = {
  message: string;
  status: number;
};
