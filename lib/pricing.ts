// Per-model pricing as of Nov 2025. USD per 1M tokens.
// Use estimateCost(model, usage) to convert OpenAI usage objects into a
// dollar number we can show in the wizard.

export type ModelRates = {
  inputPerM: number;
  cachedPerM: number;
  outputPerM: number;
};

export const PRICING: Record<string, ModelRates> = {
  "gpt-5.5":         { inputPerM: 5.00, cachedPerM: 0.50, outputPerM: 30.00 },
  "gpt-5.4":         { inputPerM: 2.50, cachedPerM: 0.25, outputPerM: 15.00 },
  "gpt-5.4-mini":    { inputPerM: 0.75, cachedPerM: 0.075, outputPerM: 4.50 },

  "gpt-5":           { inputPerM: 1.25, cachedPerM: 0.125, outputPerM: 10.00 },
  "gpt-5-mini":      { inputPerM: 0.25, cachedPerM: 0.025, outputPerM: 2.00 },
  "gpt-4o":          { inputPerM: 2.50, cachedPerM: 1.25, outputPerM: 10.00 },
  "gpt-4o-mini":     { inputPerM: 0.15, cachedPerM: 0.075, outputPerM: 0.60 },

  // gpt-image-2 is token-priced too. Approximations for studio output.
  "gpt-image-2":     { inputPerM: 5.00, cachedPerM: 1.25, outputPerM: 30.00 },

  // Embeddings.
  "text-embedding-3-large": { inputPerM: 0.13, cachedPerM: 0.13, outputPerM: 0 },
  "text-embedding-3-small": { inputPerM: 0.02, cachedPerM: 0.02, outputPerM: 0 },
};

export type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
};

export function estimateCost(model: string, usage?: Usage): {
  usdTotal: number;
  usdInput: number;
  usdCached: number;
  usdOutput: number;
  rates: ModelRates | null;
} {
  const rates = PRICING[model] ?? null;
  if (!rates || !usage)
    return { usdTotal: 0, usdInput: 0, usdCached: 0, usdOutput: 0, rates };

  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const promptUncached = Math.max(0, (usage.prompt_tokens ?? 0) - cached);
  const completion = usage.completion_tokens ?? 0;

  const usdInput = (promptUncached / 1_000_000) * rates.inputPerM;
  const usdCached = (cached / 1_000_000) * rates.cachedPerM;
  const usdOutput = (completion / 1_000_000) * rates.outputPerM;

  return {
    usdTotal: usdInput + usdCached + usdOutput,
    usdInput,
    usdCached,
    usdOutput,
    rates,
  };
}

export function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.001) return `$${(n * 1_000_000).toFixed(0)} per 1M`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
