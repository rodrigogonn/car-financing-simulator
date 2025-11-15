# Simulador de Financiamento – C6 Auto (TypeScript + Playwright + HTTP API)

Este projeto automatiza o acesso ao portal `c6auto` para realizar login e executar uma simulação de financiamento. Agora expõe um endpoint HTTP para criar simulações de forma assíncrona (com callback).

## Requisitos

- Node.js 18+ (recomendado 20+)
- Windows: pode usar Git Bash (shell padrão informado)

## Instalação

```bash
yarn
yarn playwright:install
```

## Configuração

Crie um arquivo `.env` na raiz do projeto com as variáveis:

```bash
C6AUTO_CPF=00000000000
C6AUTO_SENHA=sua_senha_aqui
# true/false (padrão: true). Quando false, abre janela do navegador
HEADLESS=true

# Porta do servidor HTTP do simulador (padrão: 4001)
PORT=4001

# Basic auth no simulador (opcional). Formato: user:pass (NÃO encode)
# SERVICE_BASIC_AUTH=usuario:senha
```

Importante:

- Não salve nem faça commit do seu `.env`.
- Em runtime, as variáveis são lidas via `src/constants/env.ts` (o dotenv é importado ali).
- Artefatos (screenshots/html) são salvos em `artifacts/`.

## Servidor HTTP (API)

Inicie o servidor (modo desenvolvimento):

```bash
yarn dev
```

### Endpoints

- POST `/v1/simulations` (assíncrono)
  - Headers:
    - Authorization: Basic <base64(user:pass)> (se `SERVICE_BASIC_AUTH` definido)
    - Content-Type: application/json
  - Body:
    ```json
    {
      "callbackUrl": "https://seu-backend/integrations/simulator/callback",
      "input": {
        "cpf": "489.237.828-31",
        "celular": "(15) 99999-9999",
        "dataNascimento": "03/07/2000",
        "ufLicenciamento": "SP",
        "placa": "AAA0A00",
        "valorVeiculo": 75000,
        "valorEntradaPretendido": 25000
      }
    }
    ```
  - Resposta: `202 Accepted`
    ```json
    { "id": "uuid", "status": "queued" }
    ```
  - O simulador executa (~40s) e realiza callback (com até 3 tentativas em ~1min):
    ```json
    {
      "id": "uuid",
      "status": "succeeded",
      "result": {
        "approved": true,
        "elapsedMs": 40123,
        "suggested": {
          "valorVeiculo": 75000,
          "entrada": 25000,
          "entradaIndicador": "sugerido",
          "planos": [{ "label": "48x de R$ 1.823,00" }],
          "observacoes": []
        }
      }
    }
    ```
    Em caso de erro:
    ```json
    { "id": "uuid", "status": "failed", "error": { "message": "..." } }
    ```

## Execução direta (debug – opcional)

O arquivo antigo `src/main.ts` pode ser usado como referência de fluxo. O serviço HTTP usa a função `simulate()` (em `src/simulate.ts`) com entradas definidas pela API.

## Checagem de tipos e lint

```bash
yarn typecheck
yarn lint
```

## Como funciona

1. Abre `https://c6auto.com.br/originacaolojista/login`
2. Faz login (CPF/Senha via `.env`)
3. Acessa a área de proposta e preenche a pré-análise
4. Aguarda resultados e extrai planos/observações
5. Retorna via callback o resultado da simulação

## Observações

- Se houver mudanças no site (rótulos dos campos, textos de botões/menus), ajuste os seletores no arquivo `src/simulate.ts`.
- Caso seu ambiente bloqueie a instalação de navegadores do Playwright, verifique as permissões de rede/proxy e rode novamente `yarn playwright:install`.
