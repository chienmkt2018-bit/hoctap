import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { closeDatabase, connectDatabase, getDatabaseStatus } from './database.js';
import { createAccessToken, getJwtSecret, hashPassword, requireAuthentication, verifyPassword } from './auth.js';
import { ProgressModel } from './models/Progress.js';
import { UserModel } from './models/User.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header include server-to-server health checks.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '100kb' }));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' } },
});

function databaseUnavailable(response: express.Response): void {
  response.status(503).json({
    error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is not available. Try again later.' },
  });
}

function validPassword(password: unknown): password is string {
  return typeof password === 'string' &&
    password.length >= 10 &&
    password.length <= 128 &&
    Buffer.byteLength(password, 'utf8') <= 72;
}

function validEmail(email: unknown): email is string {
  return typeof email === 'string' &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toProgressResponse(progress: {
  totalXp: number;
  completedLessonIds: number[];
  bestXpByLesson: Map<string, number>;
  questStatuses: Map<string, 'done' | 'active' | 'locked'>;
  updatedAt?: Date;
}) {
  return {
    progress: {
      totalXp: progress.totalXp,
      completedLessonIds: progress.completedLessonIds,
      bestXpByLesson: Object.fromEntries(progress.bestXpByLesson.entries()),
      questStatuses: Object.fromEntries(progress.questStatuses.entries()),
      updatedAt: progress.updatedAt?.toISOString() ?? new Date().toISOString(),
    },
  };
}

app.get('/api/v1/health', (_request, response) => {
  const database = getDatabaseStatus();
  const databaseRequiredButUnavailable = database !== 'connected' && database !== 'not_configured';
  response.status(databaseRequiredButUnavailable ? 503 : 200).json({
    status: databaseRequiredButUnavailable ? 'degraded' : 'ok',
    service: 'hoc-tap-quest-api',
    version: process.env.npm_package_version ?? '0.2.0',
    database,
  });
});

app.get('/', (_request, response) => {
  response.status(200).json({
    service: 'hoc-tap-quest-api',
    health: '/api/v1/health',
    apiDocs: 'docs/openapi.yaml',
  });
});

app.post('/api/v1/auth/register', authRateLimit, async (request, response, next) => {
  try {
    if (getDatabaseStatus() !== 'connected') return databaseUnavailable(response);
    const secret = getJwtSecret();
    if (!secret) {
      response.status(503).json({
        error: { code: 'AUTH_NOT_CONFIGURED', message: 'Set a JWT_SECRET of at least 32 bytes in the server environment.' },
      });
      return;
    }

    const body: unknown = request.body;
    if (!isRecord(body) || !validEmail(body.email) || !validPassword(body.password)) {
      response.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Provide a valid email and a password of 10–128 characters (maximum 72 UTF-8 bytes).',
        },
      });
      return;
    }

    const email = body.email.trim().toLowerCase();
    const passwordHash = await hashPassword(body.password);
    try {
      const user = await UserModel.create({ email, passwordHash });
      const userId = user.id as string;
      response.status(201).json({
        token: createAccessToken(userId, secret),
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: { id: userId, email: user.email },
      });
    } catch (error) {
      if (isRecord(error) && error.code === 11000) {
        response.status(409).json({
          error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists.' },
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/auth/login', authRateLimit, async (request, response, next) => {
  try {
    if (getDatabaseStatus() !== 'connected') return databaseUnavailable(response);
    const secret = getJwtSecret();
    if (!secret) {
      response.status(503).json({
        error: { code: 'AUTH_NOT_CONFIGURED', message: 'Authentication is not configured on this server.' },
      });
      return;
    }

    const body: unknown = request.body;
    if (!isRecord(body) || !validEmail(body.email) || typeof body.password !== 'string' ||
        body.password.length > 128 || Buffer.byteLength(body.password, 'utf8') > 72) {
      response.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Provide a valid email and password.' },
      });
      return;
    }

    const user = await UserModel.findOne({ email: body.email.trim().toLowerCase() }).select('+passwordHash');
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      response.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' },
      });
      return;
    }

    const userId = user.id as string;
    response.status(200).json({
      token: createAccessToken(userId, secret),
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: { id: userId, email: user.email },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/auth/me', requireAuthentication, async (_request, response, next) => {
  try {
    if (getDatabaseStatus() !== 'connected') return databaseUnavailable(response);
    const user = await UserModel.findById(response.locals.userId).select('email');
    if (!user) {
      response.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'The account for this token no longer exists.' },
      });
      return;
    }
    response.status(200).json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/progress', requireAuthentication, async (_request, response, next) => {
  try {
    if (getDatabaseStatus() !== 'connected') return databaseUnavailable(response);
    const learnerId = response.locals.userId as string;
    const progress = await ProgressModel.findOneAndUpdate(
      { learnerId },
      { $setOnInsert: { learnerId } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    if (!progress) return databaseUnavailable(response);
    response.status(200).json(toProgressResponse(progress));
  } catch (error) {
    next(error);
  }
});

app.put('/api/v1/progress', requireAuthentication, async (request, response, next) => {
  try {
    if (getDatabaseStatus() !== 'connected') return databaseUnavailable(response);
    const body: unknown = request.body;
    if (!isRecord(body) ||
        Object.keys(body).some((key) => !['completedLessonIds', 'questStatuses'].includes(key)) ||
        !Array.isArray(body.completedLessonIds) ||
        body.completedLessonIds.length > 500 ||
        !body.completedLessonIds.every((id) => Number.isSafeInteger(id) && (id as number) > 0) ||
        new Set(body.completedLessonIds).size !== body.completedLessonIds.length ||
        !isRecord(body.questStatuses) ||
        Object.keys(body.questStatuses).length > 100 ||
        !Object.entries(body.questStatuses).every(([key, value]) =>
          /^[a-zA-Z0-9_-]{1,128}$/.test(key) &&
          ['done', 'active', 'locked'].includes(String(value))
        )) {
      response.status(400).json({
        error: {
          code: 'INVALID_PROGRESS',
          message: 'Progress must contain unique positive lesson IDs and valid quest statuses only.',
        },
      });
      return;
    }

    const learnerId = response.locals.userId as string;
    const progress = await ProgressModel.findOneAndUpdate(
      { learnerId },
      {
        $set: {
          completedLessonIds: body.completedLessonIds as number[],
          questStatuses: body.questStatuses,
        },
        $setOnInsert: { learnerId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    if (!progress) return databaseUnavailable(response);
    response.status(200).json(toProgressResponse(progress));
  } catch (error) {
    next(error);
  }
});

app.use((_request, response) => {
  response.status(404).json({
    error: { code: 'NOT_FOUND', message: 'API endpoint not found.' },
  });
});

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof SyntaxError) {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } });
    return;
  }
  if (error instanceof Error && error.message === 'Origin is not allowed by CORS') {
    response.status(403).json({ error: { code: 'CORS_ORIGIN_DENIED', message: 'This origin is not allowed.' } });
    return;
  }
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' } });
};

app.use(errorHandler);

async function shutdown(signal: string) {
  console.log(`Received ${signal}; closing database connection.`);
  await closeDatabase();
  process.exit(0);
}

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

// A missing or unavailable database must not prevent local frontend work or CI builds.
void connectDatabase().catch(() => undefined);

app.listen(port, () => {
  console.log(`HOC TAP QUEST API listening on port ${port}`);
});
