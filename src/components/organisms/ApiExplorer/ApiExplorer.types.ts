export type ApiExplorerProps = {
  adminBaseUrl: string;
  clientBaseUrl?: string;
  metricsBaseUrl?: string;
  adminToken?: string;
};

export type ApiEndpoint = {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'HEAD' | 'PROPFIND' | 'MKCOL' | 'MOVE' | 'COPY';
  path: string;
  description: string;
  server: 'admin' | 'client' | 'metrics';
  requiresBody?: boolean;
  exampleBody?: string;
  requiresAuth?: boolean;
};

export type EndpointGroup = {
  server: 'admin' | 'client' | 'metrics';
  name: string;
  description: string;
  baseUrl: string;
  endpoints: ApiEndpoint[];
};
