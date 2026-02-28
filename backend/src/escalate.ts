import { EscalateRequest } from './types';

export async function handleEscalate(
  input: EscalateRequest,
  writeSSE: (eventType: string, data: any) => void
): Promise<void> {
  // Implemented in Task 8
  writeSSE('done', {});
}
