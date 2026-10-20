import mongoose from 'mongoose';

let connectionAttempt: Promise<void> | undefined;

/**
 * Connect to MongoDB when MONGODB_URI is configured.
 * The API can still start without a database for local UI development and CI.
 */
export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.warn('MONGODB_URI is not configured; database features are unavailable.');
    return;
  }

  if (mongoose.connection.readyState === 1) return;
  if (connectionAttempt) return connectionAttempt;

  connectionAttempt = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  }).then(() => {
    console.log('Connected to MongoDB.');
  }).catch((error: unknown) => {
    // Do not print the URI or credentials in connection errors.
    const message = error instanceof Error ? error.message : 'Unknown connection error';
    console.error(`MongoDB connection failed: ${message.replace(uri, '[REDACTED_MONGODB_URI]')}`);
    throw error;
  }).finally(() => {
    connectionAttempt = undefined;
  });

  return connectionAttempt;
}

export function getDatabaseStatus(): 'connected' | 'disconnected' | 'not_configured' | 'connecting' {
  if (!process.env.MONGODB_URI?.trim()) return 'not_configured';
  switch (mongoose.connection.readyState) {
    case 1: return 'connected';
    case 2: return 'connecting';
    default: return 'disconnected';
  }
}

export async function closeDatabase(): Promise<void> {
  await mongoose.disconnect();
}
