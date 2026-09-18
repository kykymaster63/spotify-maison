import { Queue, Worker } from 'bullmq'
import { config } from '../config.js'

const connection = { url: config.redis.url }

export const downloadQueue = new Queue('downloads', { connection })

export function createDownloadWorker(processor) {
  return new Worker('downloads', processor, {
    connection,
    concurrency: 2
  })
}
