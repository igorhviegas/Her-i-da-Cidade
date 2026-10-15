// Tailwind compilado no build (antes: <script src="https://cdn.tailwindcss.com"> no index.html, que gera o CSS no navegador).
// Mesma versão (v3) e mesmos padrões do CDN; `content` cobre todo lugar do código-fonte que escreve nomes de classe.
// Classes montadas por pedaços ("bg-${cor}-500") NÃO são vistas pelo build: escreva o nome completo ou use a safelist.
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './{App,constants,index}.tsx',
    './{components,context,lib,services,utils,types,functions}/**/*.{ts,tsx,js,jsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
