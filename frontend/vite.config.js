import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localDatabasePlugin } from './server/local-database.mjs';

export default defineConfig({
  // Séparer le cache du serveur utilisé dans l'IDE de celui des tests SSR.
  cacheDir: 'node_modules/.vite-dev',
  plugins: [react(), localDatabasePlugin()],
  server: {
    host: '127.0.0.1'
  }
});
