const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export const REGRET_SYSTEM_PROMPT = `SYSTEM:
You are a behavioral psychology expert, decision scientist, and honest friend — not a therapist, not a life coach. You have deep knowledge of cognitive biases, prospect theory, affective forecasting, temporal discounting, and regret theory (Kahneman, Gilovich, Landman).

Your job: analyze a decision someone is considering and forecast their regret risk with uncomfortable honesty.

Rules:
- Never moralize or lecture
- Never use phrases like "It's important to..." or "You should consider..."
- Be specific to what they wrote — never give generic advice
- The future-self voice must feel like a real memory, not a fortune cookie
- Surface the bias they are LEAST aware of, not the most obvious one

Return ONLY valid JSON — no markdown, no backticks, no explanation outside the object.

JSON SCHEMA:
{
  "score": integer 0–100,
  "verdict": "Low risk" | "Moderate risk" | "High risk" | "Very high risk",
  "biases": string[],
  "biases_severity": ("low" | "medium" | "high")[],
  "biases_explanation": string[],
  "breakdown": [
    { "label": "Emotional reactivity", "value": integer 0–100 },
    { "label": "Irreversibility", "value": integer 0–100 },
    { "label": "Social pressure", "value": integer 0–100 },
    { "label": "Information gap", "value": integer 0–100 },
    { "label": "Time pressure", "value": integer 0–100 }
  ],
  "future_voice": string (2–3 sentences, first person, past tense, age 70),
  "hidden_question": string (one question, direct, no preamble),
  "mitigations": string[] (2–3 items, concrete actions)
}`;

type AiProvider = "anthropic" | "openai-compatible" | "ollama";

interface ResolvedProvider {
  provider: AiProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export class LlmRateLimitError extends Error {
  waitSeconds: number;
  provider: AiProvider;

  constructor(waitSeconds: number, provider: AiProvider) {
    super("Model provider rate limited");
    this.waitSeconds = waitSeconds;
    this.provider = provider;
  }
}

export class LlmApiError extends Error {
  status: number;
  provider: AiProvider;

  constructor(message: string, status: number, provider: AiProvider) {
    super(message);
    this.status = status;
    this.provider = provider;
  }
}

const parseRetryAfter = (value: string | null, fallback = 20) => {
  const parsed = Number.parseInt(value ?? `${fallback}`, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseProvider = (raw: string | undefined): AiProvider | null => {
  if (!raw) return null;

  const normalized = raw.trim().toLowerCase();
  if (normalized === "anthropic") return "anthropic";
  if (normalized === "openai-compatible" || normalized === "openai_compatible") {
    return "openai-compatible";
  }
  if (normalized === "ollama") return "ollama";

  return null;
};

const resolveProvider = (): ResolvedProvider => {
  const explicitProvider = parseProvider(process.env.AI_PROVIDER);

  if (explicitProvider === "anthropic") {
    return {
      provider: "anthropic",
      model: process.env.ANTHROPIC_MODEL || process.env.AI_MODEL || "claude-sonnet-4-20250514",
      apiKey: process.env.ANTHROPIC_API_KEY
    };
  }

  if (explicitProvider === "openai-compatible") {
    return {
      provider: "openai-compatible",
      model: process.env.AI_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
      baseUrl: process.env.AI_BASE_URL,
      apiKey: process.env.AI_API_KEY
    };
  }

  if (explicitProvider === "ollama") {
    return {
      provider: "ollama",
      model: process.env.OLLAMA_MODEL || process.env.AI_MODEL || "llama3.2:latest",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      model: process.env.ANTHROPIC_MODEL || process.env.AI_MODEL || "claude-sonnet-4-20250514",
      apiKey: process.env.ANTHROPIC_API_KEY
    };
  }

  if (process.env.AI_API_KEY && process.env.AI_BASE_URL) {
    return {
      provider: "openai-compatible",
      model: process.env.AI_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
      baseUrl: process.env.AI_BASE_URL,
      apiKey: process.env.AI_API_KEY
    };
  }

  return {
    provider: "ollama",
    model: process.env.OLLAMA_MODEL || process.env.AI_MODEL || "llama3.2:latest",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
  };
};

const buildDecisionPrompt = (decisionText: string) =>
  `Decision to analyze:\n${decisionText}\n\nFollow the schema exactly.`;

async function* iterateSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let splitIndex = buffer.indexOf("\n\n");
    while (splitIndex !== -1) {
      const eventBlock = buffer.slice(0, splitIndex);
      buffer = buffer.slice(splitIndex + 2);

      const dataText = eventBlock
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");

      if (dataText) {
        yield dataText;
      }

      splitIndex = buffer.indexOf("\n\n");
    }
  }
}

const streamFromAnthropic = async function* (
  decisionText: string,
  resolved: ResolvedProvider
): AsyncGenerator<string> {
  if (!resolved.apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY for AI_PROVIDER=anthropic");
  }

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": resolved.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: resolved.model,
      max_tokens: 1200,
      temperature: 0.35,
      system: REGRET_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildDecisionPrompt(decisionText)
            }
          ]
        }
      ],
      stream: true
    })
  });

  if (response.status === 429) {
    throw new LlmRateLimitError(parseRetryAfter(response.headers.get("retry-after"), 20), "anthropic");
  }

  if (!response.ok) {
    const message = await response.text();
    throw new LlmApiError(message || "Failed to call Anthropic", response.status, "anthropic");
  }

  if (!response.body) {
    throw new LlmApiError("Missing Anthropic streaming response body", 500, "anthropic");
  }

  for await (const dataText of iterateSseData(response.body)) {
    if (dataText === "[DONE]") continue;

    try {
      const parsed = JSON.parse(dataText) as {
        type?: string;
        delta?: { type?: string; text?: string };
        error?: { message?: string };
      };

      if (parsed.type === "error") {
        throw new LlmApiError(parsed.error?.message ?? "Anthropic streaming error", 500, "anthropic");
      }

      if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
        const token = parsed.delta.text ?? "";
        if (token) yield token;
      }
    } catch {
      // Ignore non-JSON metadata lines safely.
    }
  }
};

const streamFromOpenAiCompatible = async function* (
  decisionText: string,
  resolved: ResolvedProvider
): AsyncGenerator<string> {
  if (!resolved.apiKey || !resolved.baseUrl) {
    throw new Error("Missing AI_API_KEY or AI_BASE_URL for AI_PROVIDER=openai-compatible");
  }

  const endpoint = `${resolved.baseUrl.replace(/\/$/, "")}/chat/completions`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${resolved.apiKey}`
    },
    body: JSON.stringify({
      model: resolved.model,
      temperature: 0.35,
      max_tokens: 1200,
      stream: true,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: REGRET_SYSTEM_PROMPT },
        { role: "user", content: buildDecisionPrompt(decisionText) }
      ]
    })
  });

  if (response.status === 429) {
    throw new LlmRateLimitError(
      parseRetryAfter(response.headers.get("retry-after"), 20),
      "openai-compatible"
    );
  }

  if (!response.ok) {
    const message = await response.text();
    throw new LlmApiError(
      message || "Failed to call OpenAI-compatible provider",
      response.status,
      "openai-compatible"
    );
  }

  if (!response.body) {
    throw new LlmApiError("Missing OpenAI-compatible streaming response body", 500, "openai-compatible");
  }

  for await (const dataText of iterateSseData(response.body)) {
    if (dataText === "[DONE]") break;

    try {
      const parsed = JSON.parse(dataText) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };

      const token = parsed.choices?.[0]?.delta?.content;
      if (typeof token === "string" && token.length > 0) {
        yield token;
      }
    } catch {
      // Ignore malformed packets.
    }
  }
};

const streamFromOllama = async function* (
  decisionText: string,
  resolved: ResolvedProvider
): AsyncGenerator<string> {
  if (!resolved.baseUrl) {
    throw new Error("Missing OLLAMA_BASE_URL for AI_PROVIDER=ollama");
  }

  const endpoint = `${resolved.baseUrl.replace(/\/$/, "")}/api/generate`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: resolved.model,
      stream: true,
      prompt: `${REGRET_SYSTEM_PROMPT}\n\n${buildDecisionPrompt(decisionText)}`,
      options: {
        temperature: 0.35,
        num_predict: 1200
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new LlmApiError(message || "Failed to call Ollama", response.status, "ollama");
  }

  if (!response.body) {
    throw new LlmApiError("Missing Ollama streaming response body", 500, "ollama");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newLineIndex = buffer.indexOf("\n");
    while (newLineIndex !== -1) {
      const line = buffer.slice(0, newLineIndex).trim();
      buffer = buffer.slice(newLineIndex + 1);

      if (line) {
        try {
          const parsed = JSON.parse(line) as {
            response?: string;
            error?: string;
          };

          if (parsed.error) {
            throw new LlmApiError(parsed.error, 500, "ollama");
          }

          if (typeof parsed.response === "string" && parsed.response.length > 0) {
            yield parsed.response;
          }
        } catch {
          // Ignore malformed packet.
        }
      }

      newLineIndex = buffer.indexOf("\n");
    }
  }
};

export const getActiveAiProvider = () => resolveProvider().provider;

export const streamForecastJsonTokens = async function* (decisionText: string): AsyncGenerator<string> {
  const resolved = resolveProvider();

  if (resolved.provider === "anthropic") {
    yield* streamFromAnthropic(decisionText, resolved);
    return;
  }

  if (resolved.provider === "openai-compatible") {
    yield* streamFromOpenAiCompatible(decisionText, resolved);
    return;
  }

  yield* streamFromOllama(decisionText, resolved);
};
