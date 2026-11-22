import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        idleLoop: resolve(import.meta.dirname, 'experiments/idle-loop/index.html'),
        fleetBattle: resolve(import.meta.dirname, 'experiments/fleet-collection/battle/index.html'),
        dogfight: resolve(import.meta.dirname, 'experiments/fleet-collection/dogfight/index.html'),
        duel: resolve(import.meta.dirname, 'experiments/fleet-collection/duel/index.html'),
        reboot: resolve(import.meta.dirname, 'experiments/fleet-collection/reboot/index.html'),
      },
    },
  },
})
