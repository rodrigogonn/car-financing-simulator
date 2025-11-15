import axios from 'axios';
import { env } from '../constants/env';
import { CallbackPayload } from '../schemas/simulation';

async function postCallback(
  url: string,
  payload: CallbackPayload
): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await axios.post(url, payload, {
      headers: { Authorization: env.BACKEND_BASIC_AUTH },
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      return {
        ok: false,
        status: err.response.status,
      };
    }
    return { ok: false, status: 0 };
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function deliverWithRetries(
  url: string,
  payload: CallbackPayload,
  attempts: number,
  delayMs: number
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await postCallback(url, payload);
      console.log(
        `[callback] tentativa ${i + 1} status=${res.status} ok=${res.ok}`
      );
      if (res.ok) return;
    } catch (err) {
      console.error(`[callback] erro na tentativa ${i + 1}`, err);
    }
    if (i < attempts - 1) {
      await sleep(delayMs);
    }
  }
}
