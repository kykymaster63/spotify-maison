import 'dotenv/config'

export const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  db: {
    url: process.env.DATABASE_URL || 'postgres://spotify:spotify123@localhost:5432/spotify_maison'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
    bucket: process.env.MINIO_BUCKET || 'spotify-maison',
    useSSL: false
  }
}
