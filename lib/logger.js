// Única saída de console do projeto: a regra quality/no-direct-console fica desligada só aqui.
// Cada método lê `console` na hora da chamada, para continuar compatível com spies/stubs em testes.
export const logger = {
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};
