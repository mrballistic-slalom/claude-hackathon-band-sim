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

function writeSSE(stream: any, eventType: string, data: any): void {
  stream.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const handler = awslambda.streamifyResponse(
  async (event: any, responseStream: any, _context: any) => {
    const metadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    };

    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    try {
      const body = JSON.parse(event.body || '{}');
      const path = event.rawPath || event.requestContext?.http?.path || '';

      if (event.requestContext?.http?.method === 'OPTIONS') {
        responseStream.end();
        return;
      }

      const sseFn = (eventType: string, data: any) => writeSSE(responseStream, eventType, data);

      if (path.includes('/api/generate')) {
        await handleGenerate(body as GenerateRequest, sseFn);
      } else if (path.includes('/api/escalate')) {
        await handleEscalate(body as EscalateRequest, sseFn);
      } else {
        writeSSE(responseStream, 'error', { message: 'Unknown route' });
      }
    } catch (err: any) {
      writeSSE(responseStream, 'error', { message: err.message || 'Internal error' });
    }

    responseStream.end();
  }
);
