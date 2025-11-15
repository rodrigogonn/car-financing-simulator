import 'dotenv/config';

function required(name: string): string {
  const variable = process.env[name];
  if (!variable) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return variable;
}

function getBoolean(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const normalized = raw.trim().toLowerCase();
  const truthy: ReadonlySet<string> = new Set(['1', 'true', 'yes', 'on']);
  const falsy: ReadonlySet<string> = new Set(['0', 'false', 'no', 'off']);
  if (truthy.has(normalized)) return true;
  if (falsy.has(normalized)) return false;
  return defaultValue;
}

export function basicEncode(userPass: string): string {
  if (!userPass) return '';
  const b64 = Buffer.from(userPass, 'utf8').toString('base64');
  return `Basic ${b64}`;
}

export const env = {
  PORT: Number(process.env.PORT || 4001),
  // Credenciais do portal
  C6AUTO_CPF: required('C6AUTO_CPF'),
  C6AUTO_SENHA: required('C6AUTO_SENHA'),
  // Execução do Playwright
  HEADLESS: getBoolean('HEADLESS', true),
  // Auth Basic esperado para chamadas ao simulador (formato user:pass no .env, aqui já encodado como header "Basic ...")
  SERVICE_BASIC_AUTH: basicEncode(process.env.SERVICE_BASIC_AUTH || ''),
  // Auth Basic para chamar o backend no callback (formato user:pass no .env, aqui já encodado)
  BACKEND_BASIC_AUTH: basicEncode(process.env.BACKEND_BASIC_AUTH || ''),
};
