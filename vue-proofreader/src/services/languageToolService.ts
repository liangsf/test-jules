export interface LanguageToolMatch {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: Array<{ value: string }>;
  context: {
    text: string;
    offset: number;
    length: number;
  };
  rule: {
    id: string;
    description: string;
    issueType: string;
    category: {
      id: string;
      name: string;
    };
  };
}

export interface LanguageToolResponse {
  software: {
    name: string;
    version: string;
    buildDate: string;
    apiVersion: number;
    premium: boolean;
    premiumHint: string;
    status: string;
  };
  warnings: {
    incompleteResults: boolean;
  };
  language: {
    name: string;
    code: string;
    detectedLanguage: {
      name: string;
      code: string;
      confidence: number;
    };
  };
  matches: LanguageToolMatch[];
}

const API_URL = "https://api.languagetool.org/v2/check";

export async function checkText(
  text: string,
  language: string = "auto",
): Promise<LanguageToolResponse> {
  const params = new URLSearchParams();
  params.append("text", text);
  params.append("language", language);
  // Add more parameters as needed, e.g., disabledRules, enabledRules, etc.
  // params.append('disabledRules', 'MORFOLOGIK_RULE_EN_US');

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `LanguageTool API error: ${response.status} ${response.statusText} - ${errorData}`,
      );
    }

    return (await response.json()) as LanguageToolResponse;
  } catch (error) {
    console.error("Error calling LanguageTool API:", error);
    throw error;
  }
}
