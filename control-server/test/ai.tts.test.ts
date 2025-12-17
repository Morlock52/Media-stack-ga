import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiRoutes } from '../src/routes/ai.js';

describe('/api/tts', () => {
  let app: any;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(aiRoutes);
    await app.ready();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (app) await app.close();
  });

  it('rejects missing text', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tts',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns audio for valid requests', async () => {
    const calls: Array<{ url: string; init: any }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/tts',
      payload: { text: 'Hello', openaiKey: 'sk-test' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('audio/mpeg');
    expect(res.headers['x-tts-model']).toBe('gpt-4o-mini-tts');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.openai.com/v1/audio/speech');

    const body = JSON.parse(String(calls[0].init.body));
    expect(body.model).toBe('gpt-4o-mini-tts');
    expect(body.voice).toBeTruthy();
    expect(body.input).toBe('Hello');
    expect(body.response_format).toBe('mp3');
  });

  it('falls back to the configured TTS model when the primary fails', async () => {
    const calls: Array<{ url: string; init: any }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        if (calls.length === 1) {
          return new Response('not found', { status: 404 });
        }
        return new Response(new Uint8Array([9, 9, 9]), { status: 200 });
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/tts',
      payload: { text: 'Hello', openaiKey: 'sk-test' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-tts-model']).toBe('tts-1');
    expect(calls).toHaveLength(2);

    const primaryBody = JSON.parse(String(calls[0].init.body));
    const fallbackBody = JSON.parse(String(calls[1].init.body));
    expect(primaryBody.model).toBe('gpt-4o-mini-tts');
    expect(fallbackBody.model).toBe('tts-1');
  });
});

