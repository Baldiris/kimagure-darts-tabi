import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath,URL} from 'node:url';
export default defineConfig({base:'./',plugins:[react()],resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},build:{outDir:'docs',emptyOutDir:true},server:{host:'0.0.0.0',allowedHosts:['terminal.local']}});
