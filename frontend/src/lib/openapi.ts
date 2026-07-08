import apiSpec from '../../../backend/docs/openapi.json';

export type OpenApiSpec = {
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  paths?: Record<string, Record<string, any>>;
};

const spec = apiSpec as OpenApiSpec;

export function getApiMetadata() {
  return {
    title: spec.info?.title ?? 'prototype CRM API',
    version: spec.info?.version ?? '0.1.0',
    description: spec.info?.description ?? 'Spec OpenAPI consumida pelo front-end',
  };
}

export function getEndpointList() {
  return Object.entries(spec.paths ?? {}).map(([path, methods]) => {
    const operation = methods?.get ?? methods?.post ?? methods?.put ?? methods?.delete;
    return {
      path,
      method: Object.keys(methods ?? {})[0]?.toUpperCase() ?? 'GET',
      summary: operation?.summary ?? 'Endpoint da API',
    };
  });
}
