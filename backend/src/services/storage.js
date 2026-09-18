import { Client } from 'minio'
import { config } from '../config.js'

export const minioClient = new Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey
})

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(config.minio.bucket)
  if (!exists) {
    await minioClient.makeBucket(config.minio.bucket)
    // Politique publique pour les covers et previews
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${config.minio.bucket}/covers/*`]
      }]
    })
    await minioClient.setBucketPolicy(config.minio.bucket, policy)
    console.log(`✅ Bucket "${config.minio.bucket}" créé`)
  }
}

export async function uploadFile(key, stream, size, contentType) {
  await minioClient.putObject(config.minio.bucket, key, stream, size, { 'Content-Type': contentType })
  return key
}

export async function getSignedUrl(key, expiry = 3600) {
  return minioClient.presignedGetObject(config.minio.bucket, key, expiry)
}

export async function getStream(key) {
  return minioClient.getObject(config.minio.bucket, key)
}

export async function getPartialStream(key, start, length) {
  return minioClient.getPartialObject(config.minio.bucket, key, start, length)
}

export async function getStat(key) {
  return minioClient.statObject(config.minio.bucket, key)
}
