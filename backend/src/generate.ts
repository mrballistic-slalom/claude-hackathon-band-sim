import { GenerateRequest } from './types';

export async function handleGenerate(
  input: GenerateRequest,
  writeSSE: (eventType: string, data: any) => void
): Promise<void> {
  // Implemented in Task 7
  writeSSE('done', {});
}
