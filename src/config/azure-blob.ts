import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { config } from './index';

function getBlobServiceClient(): BlobServiceClient {
  if (!config.AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured');
  }
  return BlobServiceClient.fromConnectionString(config.AZURE_STORAGE_CONNECTION_STRING);
}

export function getTransportDocsContainer(): ContainerClient {
  return getBlobServiceClient().getContainerClient(config.AZURE_STORAGE_CONTAINER_TRANSPORT);
}

export function getSignedCopiesContainer(): ContainerClient {
  return getBlobServiceClient().getContainerClient(config.AZURE_STORAGE_CONTAINER_SIGNED);
}

export function getAuditReportsContainer(): ContainerClient {
  return getBlobServiceClient().getContainerClient('audit-reports');
}
