import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
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
    const { id, partnerId, input, callbackUrl } =
      zCreateSimulationRequest.parse(req.body);
    const accepted = zCreateSimulationAccepted.parse({ id, status: 'queued' });
    res.status(202).json(accepted);

    async function runBackground(): Promise<void> {
      let payload: CallbackPayload;
      try {
        const result = await simulate(input, id);
        payload = { id, status: 'succeeded', result };
      } catch (error) {
        console.error('[simulate] erro na simulação:', error);
        const message = error instanceof Error ? error.message : String(error);
        payload = { id, status: 'failed', error: { message } };
        try {
          // tenta enviar screenshot do erro para o backend e incluir failedMediaId
          const filename = '99-error-final.png';
          const local = path.resolve(process.cwd(), 'artifacts', id, filename);
          const fileBuf = await readFile(local);
          // solicitar upload-url
          const { data: signed } = await axios.post<{
            url: string;
            objectName: string;
            expiresAt: number;
          }>(
            new URL('/files/upload-url', env.BACKEND_URL).toString(),
            {
              filename,
              contentType: 'image/png',
              partnerId,
              prefix: `simulations/${id}`,
            },
            {
              headers: { Authorization: env.BACKEND_BASIC_AUTH },
            }
          );
          const uploadUrl = signed.url.startsWith('/')
            ? new URL(signed.url, env.BACKEND_URL).toString()
            : signed.url;
          await axios.put(uploadUrl, fileBuf, {
            headers: { 'Content-Type': 'image/png' },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          });
          const { data: created } = await axios.post<{ id: string }>(
            new URL('/files/confirm', env.BACKEND_URL).toString(),
            { objectName: signed.objectName, partnerId },
            {
              headers: { Authorization: env.BACKEND_BASIC_AUTH },
            }
          );
          if (created.id) {
            payload.failedMediaId = created.id;
          }
        } catch (e) {
          console.warn('[simulate] falha ao enviar screenshot para backend', e);
        }
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
  console.log(`[http] simulador ouvindo em: ${port}`);
});
