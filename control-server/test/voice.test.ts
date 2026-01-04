import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiRoutes } from '../src/routes/ai.js';

/**
 * Comprehensive Voice System Tests
 * Tests TTS, STT, Voice Agent, and Realtime Voice APIs
 */

describe('Voice System', () => {
  let app: any;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'sk-test-voice';
    app = Fastify({ logger: false });
    await app.register(aiRoutes);
    await app.ready();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    if (app) await app.close();
  });

  describe('/api/voice-agent', () => {
    it('rejects empty transcript', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/voice-agent',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('transcript is required');
    });

    it('handles transcripts and extracts services', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'Great choice! Setting up Plex and Sonarr.' } }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/voice-agent',
        payload: {
          transcript: 'I want to set up plex and sonarr for my NAS',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.agentResponse).toBeTruthy();
      expect(data.plan).toBeTruthy();
      expect(data.plan.services).toContain('plex');
      expect(data.plan.services).toContain('sonarr');
      expect(data.plan.hosting).toBe('nas');
    });

    it('provides fallback response on API error', async () => {
      // Simulate API key error (key exists but is invalid)
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 })
        )
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/voice-agent',
        payload: {
          transcript: 'Help me with Plex setup',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.meta.usedFallback).toBe(true);
      expect(data.meta.reason).toBe('invalid_api_key');
      expect(data.agentResponse).toBeTruthy();
    });

    it('handles conversation history', async () => {
      const calls: any[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: any, init: any) => {
          calls.push(JSON.parse(init.body));
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: 'Following up on our conversation.' } }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        })
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/voice-agent',
        payload: {
          transcript: 'What about Radarr?',
          history: [
            { role: 'user', content: 'I want Plex' },
            { role: 'assistant', content: 'Great choice!' },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(calls).toHaveLength(1);
      // History should be included in the request
      expect(calls[0].messages.length).toBeGreaterThan(1);
    });
  });

  describe('/api/tts', () => {
    it('rejects empty text', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tts',
        payload: { text: '' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects text that is too long', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tts',
        payload: { text: 'x'.repeat(5000) },
      });
      expect(res.statusCode).toBe(413);
    });

    it('uses OpenAI TTS by default', async () => {
      const calls: any[] = [];
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
        payload: { text: 'Hello world' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-tts-provider']).toBe('openai');
      expect(calls[0].url).toContain('api.openai.com');
    });

    it('handles speed parameter correctly', async () => {
      const calls: any[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: any, init: any) => {
          calls.push(JSON.parse(init.body));
          return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        })
      );

      await app.inject({
        method: 'POST',
        url: '/api/tts',
        payload: { text: 'Hello', speed: 1.5 },
      });

      expect(calls[0].speed).toBe(1.5);
    });

    it('clamps invalid speed values', async () => {
      const calls: any[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: any, init: any) => {
          calls.push(JSON.parse(init.body));
          return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        })
      );

      await app.inject({
        method: 'POST',
        url: '/api/tts',
        payload: { text: 'Hello', speed: 10 }, // Out of range
      });

      // Speed should be undefined (not sent) when out of range
      expect(calls[0].speed).toBeUndefined();
    });
  });

  describe('/api/settings/stt', () => {
    it('returns STT status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/stt',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.hasKey).toBe(true);
      expect(data.model).toBeTruthy();
      expect(data.supportedFormats).toBeInstanceOf(Array);
    });
  });

  describe('/api/settings/tts', () => {
    it('returns TTS status for OpenAI', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/tts',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.provider).toBe('openai');
      expect(data.hasKey).toBe(true);
      expect(data.ttsModel).toBeTruthy();
      expect(data.ttsVoice).toBeTruthy();
    });
  });

  describe('/api/ai/realtime/status', () => {
    it('returns realtime API status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/ai/realtime/status',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.available).toBe(true);
      expect(data.model).toBeTruthy();
      expect(data.features).toBeInstanceOf(Array);
    });
  });

  describe('/api/ai/realtime/ephemeral-key', () => {
    it('handles OpenAI API error gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 })
        )
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/realtime/ephemeral-key',
        payload: {},
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().reason).toBe('invalid_api_key');
    });

    it('generates ephemeral key successfully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(
            JSON.stringify({
              id: 'sess-123',
              client_secret: {
                value: 'ephemeral-key-123',
                expires_at: Date.now() + 60000,
              },
              model: 'gpt-4o-realtime-preview',
              voice: 'cedar',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/realtime/ephemeral-key',
        payload: { voice: 'alloy' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.ephemeralKey).toBe('ephemeral-key-123');
      expect(data.sessionId).toBe('sess-123');
      expect(data.sdpUrl).toContain('api.openai.com');
    });
  });

});

describe('Voice System - Error Handling', () => {
  let app: any;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    app = Fastify({ logger: false });
    await app.register(aiRoutes);
    await app.ready();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    if (app) await app.close();
  });

  it('handles OpenAI rate limiting gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 })
      )
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/voice-agent',
      payload: { transcript: 'Test' },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.meta.usedFallback).toBe(true);
    expect(data.meta.reason).toBe('rate_limited');
  });

  it('handles OpenAI invalid key gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 })
      )
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/voice-agent',
      payload: { transcript: 'Test' },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.meta.usedFallback).toBe(true);
    expect(data.meta.reason).toBe('invalid_api_key');
  });

  it('handles network errors gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network error');
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/voice-agent',
      payload: { transcript: 'Test' },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.meta.usedFallback).toBe(true);
    expect(data.meta.reason).toBe('server_error');
  });
});

describe('Voice System - Concurrent Requests', () => {
  let app: any;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    app = Fastify({ logger: false });
    await app.register(aiRoutes);
    await app.ready();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    if (app) await app.close();
  });

  it('handles multiple concurrent TTS requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    );

    const requests = Array(10)
      .fill(0)
      .map((_, i) =>
        app.inject({
          method: 'POST',
          url: '/api/tts',
          payload: { text: `Hello world ${i}` },
        })
      );

    const results = await Promise.all(requests);
    expect(results.every((r: any) => r.statusCode === 200)).toBe(true);
  });

  it('handles multiple concurrent voice-agent requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Response' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const requests = Array(5)
      .fill(0)
      .map((_, i) =>
        app.inject({
          method: 'POST',
          url: '/api/voice-agent',
          payload: { transcript: `Question ${i}` },
        })
      );

    const results = await Promise.all(requests);
    expect(results.every((r: any) => r.statusCode === 200)).toBe(true);
  });
});
