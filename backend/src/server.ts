import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';

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

app.get('/api/v1/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'hoc-tap-quest-api',
    version: process.env.npm_package_version ?? '0.1.0',
  });
});

app.get('/', (_request, response) => {
  response.status(200).json({
    service: 'hoc-tap-quest-api',
    health: '/api/v1/health',
    apiDocs: 'docs/openapi.yaml',
  });
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

app.listen(port, () => {
  console.log(`HOC TAP QUEST API listening on port ${port}`);
});
