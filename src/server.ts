import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { env } from './constants/env';
import {
  zCreateSimulationRequest,
  zCreateSimulationAccepted,
  CallbackPayload,
} from './schemas/simulation';
import { simulate } from './simulate';
import { deliverWithRetries } from './lib/callback';
import { serviceBasicAuth } from './middlewares/basicAuth';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/v1/simulations', serviceBasicAuth, async (req, res) => {
    const { input, callbackUrl } = zCreateSimulationRequest.parse(req.body);
    const id = randomUUID();
    const accepted = zCreateSimulationAccepted.parse({ id, status: 'queued' });
    res.status(202).json(accepted);

    async function runBackground(): Promise<void> {
      let payload: CallbackPayload;
      try {
        const result = await simulate(input);
        payload = { id, status: 'succeeded', result };
      } catch (error) {
        console.error('[simulate] erro na simulação:', error);
        const message = error instanceof Error ? error.message : String(error);
        payload = { id, status: 'failed', error: { message } };
      }
      console.log('Resultado da simulação:', payload);
      await deliverWithRetries(callbackUrl, payload, 3, 20_000);
    }
    // fire-and-forget
    void runBackground();
  });

  return app;
}

const app = createApp();
const port = env.PORT;
app.listen(port, () => {
  console.log(`[http] simulador ouvindo em :${port}`);
});
