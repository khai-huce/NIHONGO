import { createApp } from './app.js';
import { readConfig } from './config/env.js';

try {
  const config = readConfig();
  const api = createApp(config);
  const host = config.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  const server = api.app.listen(config.PORT, host, () => {
    console.log(`NIHONGO API listening on ${host}:${config.PORT}`);
    if (!config.GOOGLE_CLIENT_ID) console.log('Google sign-in is not configured; email sign-in is available.');
  });
  server.on('error', async error => {
    console.error('Unable to start API:', 'code' in error ? error.code : error.name);
    await api.close();
    process.exitCode = 1;
  });
  const shutdown = () => {
    server.close(() => { void api.close().then(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to start API');
  process.exitCode = 1;
}
