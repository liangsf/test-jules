import { vi } from 'vitest';

export const checkText = vi.fn(async (text: string, language: string = 'auto') => {
  console.log('[Mock] checkText called with:', text, language);
  // Return a basic, empty LanguageToolResponse structure
  return Promise.resolve({
    software: {
      name: 'LanguageTool',
      version: 'mocked',
      buildDate: new Date().toISOString(),
      apiVersion: 1,
      premium: false,
      premiumHint: '',
      status: '',
    },
    warnings: {
      incompleteResults: false,
    },
    language: {
      name: 'English',
      code: 'en-US',
      detectedLanguage: {
        name: 'English',
        code: 'en-US',
        confidence: 1.0,
      },
    },
    matches: [], // No matches by default in mock
  });
});
