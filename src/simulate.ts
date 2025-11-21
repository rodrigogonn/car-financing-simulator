import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from './constants/env';
import {
  SimulationInput,
  SimulationResult,
  SimpleSimulation,
  Scenario,
  ScenarioType,
} from './schemas/simulation';

class SimulationStepError extends Error {
  public readonly step: string;
  public readonly causeError: unknown;
  constructor(step: string, causeError: unknown) {
    super(`Erro ao ${step}`);
    this.step = step;
    this.causeError = causeError;
  }
}

async function ensureArtifactsDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

function now(): string {
  const d = new Date();
  return d.toISOString();
}

function log(message: string, error?: unknown): void {
  if (error) {
    console.log(`[${now()}] ${message}`, error);
  } else {
    console.log(`[${now()}] ${message}`);
  }
}

async function saveDebug(
  page: Page,
  artifactsDir: string,
  name: string
): Promise<void> {
  const safe = name.replace(/[^\w.-]+/g, '_');
  log(`Salvando debug: ${safe}`);
  await page.screenshot({
    path: join(artifactsDir, `${safe}.png`),
    fullPage: true,
  });
  const html = await page.content();
  await writeFile(join(artifactsDir, `${safe}.html`), html, 'utf-8');
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function parseBRL(value: string): number {
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/[R$]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

async function typeWithMask(
  locator: ReturnType<Page['locator']>,
  value: string
): Promise<void> {
  log(`Digitando com máscara "${value}"...`);
  await locator.click();
  await locator.press('Control+A').catch(() => {});
  await locator.press('Backspace').catch(() => {});
  for (const ch of value) {
    await locator.type(ch, { delay: 30 });
  }
}

async function performLogin(
  page: Page,
  cpf: string,
  senha: string
): Promise<void> {
  log('Iniciando fluxo de login...');
  const currentUrl = page.url();
  if (!currentUrl.includes('/originacaolojista/login')) {
    await page.goto('https://c6auto.com.br/originacaolojista/login', {
      waitUntil: 'load',
    });
  }
  const iniciar = page.getByRole('button', { name: 'Iniciar Login' });
  if (await iniciar.count().then((c) => c > 0)) {
    await iniciar.click();
  }
  const usernameCombined = page.locator(
    'input[name="username"], #username, input[autocomplete="username"]'
  );
  await usernameCombined.first().waitFor({ state: 'visible', timeout: 30_000 });
  await usernameCombined.first().fill(cpf, { timeout: 10_000 });

  const passwordCombined = page.locator(
    'input[name="password"], #password, input[type="password"], input[autocomplete="current-password"], input[autocomplete="password"]'
  );
  await passwordCombined.first().waitFor({ state: 'visible', timeout: 30_000 });
  await passwordCombined.first().fill(senha, { timeout: 10_000 });

  const acessarBtn = page.getByRole('button', { name: /Acessar/i }).first();
  if (await acessarBtn.count().then((c) => c > 0)) {
    await Promise.all([
      acessarBtn.click(),
      page.waitForLoadState('load').catch(() => {}),
    ]);
  } else {
    throw new Error('Não foi possível localizar o botão "Acessar".');
  }
}

async function waitForPostLogin(page: Page): Promise<void> {
  await page.waitForURL(
    (url) =>
      url.hostname === 'c6auto.com.br' &&
      url.href.includes('/originacaolojista'),
    { timeout: 60_000 }
  );
}

async function waitForDashboard(page: Page): Promise<void> {
  const deadlineMs = Date.now() + 60_000;

  while (true) {
    const urlOk = page.url().includes('/originacaolojista/shopkeeper-panel');
    const hasCreateButton = await page
      .getByRole('button', { name: /Criar uma nova proposta/i })
      .first()
      .isVisible()
      .catch(() => false);
    if (urlOk && hasCreateButton) {
      await page.waitForLoadState('networkidle').catch(() => {});
      return;
    }
    if (Date.now() > deadlineMs) break;
    await page.waitForTimeout(300);
  }
  throw new Error('Dashboard não carregou dentro do tempo esperado.');
}

async function fillPreAnalysisForm(
  page: Page,
  input: SimulationInput
): Promise<void> {
  await page
    .getByText('1 de 3')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });

  await typeWithMask(
    page.getByRole('textbox', { name: /CPF/i }).first(),
    input.customerCpf
  );
  await typeWithMask(
    page.getByRole('textbox', { name: /Celular/i }).first(),
    input.customerPhone
  );
  await typeWithMask(
    page.getByRole('textbox', { name: /Data de Nascimento/i }).first(),
    input.customerBirthDate
  );

  const ufCombo = page
    .getByRole('combobox', { name: /UF de licenciamento/i })
    .first();
  await ufCombo.click();
  await page
    .getByRole('option', { name: input.licensingState })
    .first()
    .click();

  await typeWithMask(
    page.getByRole('textbox', { name: /Placa/i }).first(),
    input.plate
  );

  const valorVeiculoStr = formatBRL(input.vehiclePrice);
  const valorEntradaStr = formatBRL(input.desiredDownPayment);
  await typeWithMask(
    page.getByRole('textbox', { name: /Valor do Veículo/i }).first(),
    valorVeiculoStr
  );
  await typeWithMask(
    page.getByRole('textbox', { name: /Valor de entrada/i }).first(),
    valorEntradaStr
  );

  const simularBtn = page.getByRole('button', { name: /^Simular$/i }).first();
  await simularBtn.waitFor({ state: 'visible', timeout: 20_000 });
  await simularBtn.click();
}

async function waitForSimulationOrDenial(
  page: Page
): Promise<'denied' | 'proceed' | 'error'> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const denial = await page
      .getByRole('heading', { name: /Proposta não atende requisitos/i })
      .first()
      .isVisible()
      .catch(() => false);
    if (denial) return 'denied';
    const step2Visible = await page
      .getByText('2 de 3')
      .first()
      .isVisible()
      .catch(() => false);
    const urlIsSimulation = page
      .url()
      .includes('/originacaolojista/simulation');
    if (step2Visible || urlIsSimulation) return 'proceed';
    await page.waitForTimeout(300);
  }
  return 'error';
}

async function waitForSimulationResults(page: Page): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const entradaValor = await page
      .getByRole('textbox', { name: /Entrada/i })
      .first()
      .inputValue()
      .then((t) => parseBRL(t.trim()))
      .catch(() => 0);

    const minHeadingVisible = await page
      .getByRole('heading', { name: /Valor de entrada abaixo do mínimo/i })
      .first()
      .isVisible()
      .catch(() => false);

    const planButtonVisible = await page
      .getByRole('button', { name: /\d+\s*x\s*de\s*R\$/i })
      .first()
      .isVisible()
      .catch(() => false);

    let financiamentoValor = 0;
    const financiamentoLabel = page.getByText(/^Financiamento$/i).first();
    if (await financiamentoLabel.count().then((c) => c > 0)) {
      const parente = financiamentoLabel.locator('xpath=ancestor::*[1]');
      const parTxt = await parente.innerText().catch(() => '');
      const fMatch = parTxt.match(/R\$\s*[\d.,]+/);
      if (fMatch) financiamentoValor = parseBRL(fMatch[0]);
    }
    if (
      entradaValor > 0 &&
      (minHeadingVisible || planButtonVisible || financiamentoValor > 0)
    ) {
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(300);
      return;
    }
    await page.waitForTimeout(350);
  }
}

async function extractSimulation(page: Page): Promise<SimpleSimulation> {
  const entradaInput = page.getByRole('textbox', { name: /Entrada/i }).first();
  const entradaText = (await entradaInput.inputValue()).trim();
  const downPayment = parseBRL(entradaText);

  let indicator: ScenarioType = ScenarioType.REQUESTED;
  const contextoEntrada = entradaInput.locator('xpath=ancestor::*[1]');
  const ctxTxt = await contextoEntrada.innerText().catch(() => '');
  if (/m[ií]nimo/i.test(ctxTxt)) indicator = ScenarioType.MINIMUM;
  else if (/sugerido/i.test(ctxTxt)) indicator = ScenarioType.SUGGESTED;
  else if (/m[áa]ximo/i.test(ctxTxt)) indicator = ScenarioType.MAXIMUM;

  let planoButtons = page.getByRole('button', { name: /\d+\s*x\s*de\s*R\$/i });
  if (!(await planoButtons.count().catch(() => 0))) {
    planoButtons = page.locator('button').filter({ hasText: /x de R\$/i });
  }
  const plans: Array<{ label: string }> = [];
  const count = await planoButtons.count();
  for (let i = 0; i < count; i += 1) {
    const label = (await planoButtons.nth(i).innerText()).trim();
    plans.push({ label });
  }
  return {
    downPayment,
    downPaymentIndicator: indicator,
    plans,
  };
}

async function closeMinEntryInfoIfVisible(page: Page): Promise<void> {
  const start = Date.now();
  const maxWait = 5_000;
  while (Date.now() - start < maxWait) {
    const entendi = page.getByRole('button', { name: /ENTENDI/i }).first();
    if (await entendi.isVisible().catch(() => false)) {
      log('Fechando aviso com "ENTENDI"...');
      await entendi.click().catch(() => {});
      const modal = page.locator('app-modal-input-value');
      await modal.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(200);
      return;
    }
    const closeIcon = page
      .locator(
        'app-modal-input-value [aria-label="Close"], app-modal-input-value .close, app-modal-input-value [class*="close"]'
      )
      .first();
    if (await closeIcon.isVisible().catch(() => false)) {
      log('Fechando aviso com ícone de fechar...');
      await closeIcon.click().catch(() => {});
      const modal = page.locator('app-modal-input-value');
      await modal.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(200);
      return;
    }
    await page.waitForTimeout(200);
  }
}

async function adjustEntryToMinimumIfNeeded(
  page: Page,
  pretendedEntry: number
): Promise<void> {
  log('Verificando necessidade de ajuste da entrada para o mínimo...');
  const entradaBox = page.getByRole('textbox', { name: /Entrada/i }).first();
  const entradaText = (await entradaBox.inputValue()).trim();
  const entradaAtual = parseBRL(entradaText);
  if (entradaAtual <= pretendedEntry) {
    log('Ajuste não necessário.');
    return;
  }
  log('Clicando marcador mínimo...');
  const minMarker = page
    .locator('.marker.min-marker, .min-marker, [class*="min-marker"]')
    .first();
  if (await minMarker.count().then((c) => c > 0)) {
    const beforeText = (await entradaBox.inputValue()).trim();
    await minMarker.click({ force: true }).catch(async () => {
      await page.evaluate(() => {
        /* eslint-disable no-undef */
        const sel = '.marker.min-marker, .min-marker, [class*="min-marker"]';
        const m = document.querySelector(sel);
        if (!m) return;
        m.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        m.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        m.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        /* eslint-enable no-undef */
      });
    });
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const novoTextLoop = (await entradaBox.inputValue()).trim();
      const ctxTxt = await entradaBox
        .locator('xpath=ancestor::*[1]')
        .innerText()
        .catch(() => '');
      if (novoTextLoop !== beforeText || /m[ií]nimo/i.test(ctxTxt)) break;
      await page.waitForTimeout(150);
    }
  } else {
    log('Marcador mínimo não encontrado. Reinformando valor pretendido...');
    await typeWithMask(entradaBox, formatBRL(pretendedEntry));
  }
  const novoText = (await entradaBox.inputValue()).trim();
  const novoValor = parseBRL(novoText);
  log(`Entrada após ajuste: ${formatBRL(novoValor)}`);
}

export async function simulate(
  input: SimulationInput,
  simulationId: string
): Promise<SimulationResult> {
  const headless = env.HEADLESS;
  const artifactsDir = join('artifacts', simulationId);
  let context: BrowserContext | null = null;
  let browser: Browser | null = null;
  let page: Page | null = null;
  const startedAtMs = Date.now();
  let currentStep = 'inicialização';
  try {
    await ensureArtifactsDir(artifactsDir);
    browser = await chromium.launch({ headless });
    context = await browser.newContext();
    await context.grantPermissions(['geolocation'], {
      origin: 'https://c6auto.com.br',
    });
    try {
      await context.setGeolocation({
        latitude: -23.55052,
        longitude: -46.633308,
      });
    } catch {
      // ignore
    }
    page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(25_000);

    try {
      currentStep = 'login no portal';
      await performLogin(page, env.C6AUTO_CPF, env.C6AUTO_SENHA);
      currentStep = 'aguardar pós-login';
      await waitForPostLogin(page);
      currentStep = 'carregar dashboard';
      await waitForDashboard(page);
    } catch (e) {
      throw new SimulationStepError(currentStep, e);
    }

    const criarBtn = page
      .getByRole('button', { name: /Criar uma nova proposta/i })
      .first();
    try {
      currentStep = 'abrir criação de proposta';
      if (await criarBtn.count().then((c) => c > 0)) {
        await criarBtn.click();
      }
      currentStep = 'preencher pré-análise';
      await fillPreAnalysisForm(page, input);
      currentStep = 'aguardar avanço para simulação ou negativa';
      const gate = await waitForSimulationOrDenial(page);
      if (gate === 'denied') {
        return {
          approved: false,
          scenarios: [],
          reason: 'Proposta não atende requisitos',
          elapsedMs: Date.now() - startedAtMs,
        };
      }
      if (gate === 'error') {
        throw new Error('Timeout aguardando simulação ou negativa');
      }
      currentStep = 'aguardar resultados iniciais';
      await waitForSimulationResults(page);
    } catch (e) {
      throw new SimulationStepError(currentStep, e);
    }

    const suggested = await extractSimulation(page);

    const scenarios: Scenario[] = [];
    // Sempre usa o indicador retornado na extração como cenário principal
    scenarios.push({ type: suggested.downPaymentIndicator, data: suggested });

    // Ajuste para mínimo somente se o desejado for menor e ainda não estivermos no mínimo
    if (
      input.desiredDownPayment < suggested.downPayment &&
      suggested.downPaymentIndicator !== ScenarioType.MINIMUM
    ) {
      try {
        currentStep = 'fechar aviso de mínimo (se visível)';
        await closeMinEntryInfoIfVisible(page);
        currentStep = 'ajustar entrada ao mínimo';
        await adjustEntryToMinimumIfNeeded(page, input.desiredDownPayment);
        currentStep = 'aguardar resultados após ajuste';
        await waitForSimulationResults(page);
      } catch (e) {
        throw new SimulationStepError(currentStep, e);
      }
      const minimum = await extractSimulation(page);
      scenarios.push({ type: ScenarioType.MINIMUM, data: minimum });
    }

    return {
      approved: true,
      scenarios,
      elapsedMs: Date.now() - startedAtMs,
    };
  } catch (error) {
    // Log detalhado preservando o erro original
    if (page) {
      try {
        await saveDebug(page, artifactsDir, '99-error-final');
      } catch {
        // ignore
      }
    }
    // Normaliza para erro com etapa quando possível
    if (error instanceof SimulationStepError) {
      throw error;
    }
    throw new SimulationStepError(currentStep, error);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}
