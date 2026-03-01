// Declare Lambda streaming globals (available at runtime, not in TS types)
declare const awslambda: {
  streamifyResponse: (handler: (event: any, responseStream: any, context: any) => Promise<void>) => any;
  HttpResponseStream: {
    from: (stream: any, metadata: any) => any;
  };
};

import { handleGenerate } from './generate';
import { handleEscalate } from './escalate';
import { GenerateRequest, EscalateRequest } from './types';
import { validateGenerateRequest, validateEscalateRequest } from './validation';

const MAX_BODY_SIZE = 65536; // 64KB
const ORIGIN_VERIFY_SECRET = process.env.ORIGIN_VERIFY_SECRET || '';

/** Derive allowed origin from request. Accepts *.cloudfront.net origins; falls back to localhost. */
function getAllowedOrigin(requestOrigin: string | undefined): string {
  if (requestOrigin && /^https:\/\/[a-z0-9]+\.cloudfront\.net$/.test(requestOrigin)) {
    return requestOrigin;
  }
  return 'https://localhost';
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/**
 * Writes a Server-Sent Event (SSE) to the response stream.
 * @param stream - The Lambda response stream to write to.
 * @param eventType - The SSE event type (e.g., "agent_message", "error", "done").
 * @param data - The data payload, serialized as JSON.
 */
function writeSSE(stream: any, eventType: string, data: any): void {
  stream.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Lambda streaming response handler. Routes incoming requests to the appropriate
 * handler (/api/generate or /api/escalate) and streams SSE responses back to the client.
 */
export const handler = awslambda.streamifyResponse(
  async (event: any, responseStream: any, _context: any) => {
    const method = event.requestContext?.http?.method || '';
    const path = event.rawPath || event.requestContext?.http?.path || '';
    const allowedOrigin = getAllowedOrigin(event.headers?.origin);

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 204,
        headers: {
          ...SECURITY_HEADERS,
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
      responseStream.end();
      return;
    }

    // Verify request comes from CloudFront via secret header
    if (ORIGIN_VERIFY_SECRET && event.headers?.['x-origin-verify'] !== ORIGIN_VERIFY_SECRET) {
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 403,
        headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json' },
      });
      responseStream.write(JSON.stringify({ message: 'Forbidden' }));
      responseStream.end();
      return;
    }

    // Enforce POST method for all API endpoints
    if (method !== 'POST') {
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 405,
        headers: {
          ...SECURITY_HEADERS,
          'Content-Type': 'application/json',
          'Allow': 'POST, OPTIONS',
          'Access-Control-Allow-Origin': allowedOrigin,
        },
      });
      responseStream.write(JSON.stringify({ message: 'Method not allowed' }));
      responseStream.end();
      return;
    }

    // Body size guard
    if (event.body && event.body.length > MAX_BODY_SIZE) {
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 413,
        headers: {
          ...SECURITY_HEADERS,
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowedOrigin,
        },
      });
      responseStream.write(JSON.stringify({ message: 'Request body too large' }));
      responseStream.end();
      return;
    }

    const metadata = {
      statusCode: 200,
      headers: {
        ...SECURITY_HEADERS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    };

    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    try {
      const body = JSON.parse(event.body || '{}');

      const sseFn = (eventType: string, data: any) => writeSSE(responseStream, eventType, data);

      if (path === '/api/generate') {
        const validationError = validateGenerateRequest(body);
        if (validationError) {
          writeSSE(responseStream, 'error', { message: 'Bad request' });
          responseStream.end();
          return;
        }
        await handleGenerate(body as GenerateRequest, sseFn);
      } else if (path === '/api/escalate') {
        const validationError = validateEscalateRequest(body);
        if (validationError) {
          writeSSE(responseStream, 'error', { message: 'Bad request' });
          responseStream.end();
          return;
        }
        await handleEscalate(body as EscalateRequest, sseFn);
      } else {
        writeSSE(responseStream, 'error', { message: 'Unknown route' });
      }
    } catch (err: any) {
      console.error('Handler error:', err);
      writeSSE(responseStream, 'error', { message: 'Internal server error' });
    }

    responseStream.end();
  }
);
