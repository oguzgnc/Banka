import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Docker'ın portu dışarı açmasını sağlar
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true, // Windows ve Docker arasındaki dosya senkronizasyonu için kritik
    }
  }
})