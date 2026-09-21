const { S3Client } = require('@aws-sdk/client-s3');

let cachedClient = null;

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const region = process.env.R2_BUCKET_REGION || 'auto';

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    region,
    endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '',
    isConfigured: Boolean(accountId && accessKeyId && secretAccessKey && bucketName),
  };
}

function getR2Client() {
  const config = getR2Config();
  if (!config.isConfigured) {
    const error = new Error('R2 no esta configurado.');
    error.status = 503;
    throw error;
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return cachedClient;
}

module.exports = {
  getR2Client,
  getR2Config,
};
