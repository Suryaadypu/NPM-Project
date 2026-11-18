import { createApp } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  throw new Error('PORT must be an integer between 0 and 65535.');
}

const server = createApp().listen(port, '0.0.0.0', () => {
  const address = server.address();
  console.log(`RetryFlow Dashboard listening on http://0.0.0.0:${address.port}`);
});
