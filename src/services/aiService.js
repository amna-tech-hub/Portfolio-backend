
const aiProviders = require("../config/aiProviders");  //just configure the models
const portfolioKnowledge = require("../data/portfolioKnowledge.json");

// Provider priority
// Provider priority
const PROVIDER_ORDER = [
    "groq", "gemini",
     "openrouter"];
//prompt giving by adding my own info
const buildSystemPrompt = () => {
  const instructions = portfolioKnowledge.chatbotInstructions.rules
    .map((rule) => `- ${rule}`)
    .join("\n");

  return `
You are ${portfolioKnowledge.profile.name}'s professional portfolio assistant.

Your job is to answer questions about her professional profile.

STRICT RULES:
${instructions}

IMPORTANT:
- Treat the portfolio data below as your source of truth.
- Never invent missing information.
- If a recruiter asks something not present in the data, say you don't have that information.
- Be friendly, helpful, and professional.
- Keep answers concise and easy to understand.
RESPONSE FORMATTING RULES:

1. Always use proper Markdown formatting.
2. Start longer answers with a clear heading using ##.
3. Use **bold** for important words and technology names.
4. Use bullet points for lists.
5. Use Markdown tables only when comparing structured information.
6. Keep paragraphs short and easy to read.
7. Add proper spacing between headings, paragraphs and lists.
8. Avoid unnecessary introductions and repeated information.
9. For simple questions, give short and direct answers.
10. Never show raw Markdown formatting instructions to the visitor.

PORTFOLIO KNOWLEDGE BASE:
${JSON.stringify(portfolioKnowledge, null, 2)}
`;
};

// Validate conversation messages
const validateMessages = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Messages must be a non-empty array.");
  }

  return messages.slice(-10).map((message) => {
    if (
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      throw new Error("Invalid conversation message.");
    }

    return {
      role: message.role,
      content: message.content.trim()
    };
  });
};

// Read Server-Sent Events from a provider
const readSSE = async (response, onData) => {
  const decoder = new TextDecoder();
  let buffer = "";

  const processLine = async (line) => {
    line = line.trim();

    if (!line.startsWith("data:")) return;

    const data = line.slice(5).trim();

    if (!data || data === "[DONE]") return;

    try {
      await onData(JSON.parse(data));
    } catch (error) {
      if (error.isProviderError) throw error;

      throw new Error("Unable to parse AI streaming response.");
    }
  };

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      await processLine(line);
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    await processLine(buffer);
  }
};

// Extract error details 
const getProviderError = async (response, providerName) => {
  const body = await response.text();

  let message = body;

  try {
    const parsed = JSON.parse(body);
    message =
      parsed.error?.message ||
      parsed.message ||
      body;
  } catch {
    // Keep the original response body
  }

  const error = new Error(
    `${providerName} failed (${response.status}): ${message.slice(0, 250)}`
  );

  error.isProviderError = true;

  return error;
};

// OpenAI-compatible providers: Groq and Hugging Face
const streamOpenAIProvider = async (
  provider,
  messages,
  systemPrompt,
  onToken
) => {
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        ...messages
      ],
      temperature: 0.4,
      max_tokens: 500,
      stream: true
    })
  });

  if (!response.ok) {
    throw await getProviderError(response, provider.name);
  }

  if (!response.body) {
    throw new Error(`${provider.name} returned no response stream.`);
  }

  let receivedText = false;

  await readSSE(response, async (data) => {
    const content = data.choices?.[0]?.delta?.content;

    if (typeof content === "string" && content.length > 0) {
      receivedText = true;
      await onToken(content);
    }
  });

  if (!receivedText) {
    throw new Error(`${provider.name} returned an empty response.`);
  }
};

// Convert chat history into Gemini format
const convertToGeminiContents = (messages) => {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }]
  }));
};

// Gemini streaming provider
const streamGeminiProvider = async (
  provider,
  messages,
  systemPrompt,
  onToken
) => {
  const url =
    `${provider.endpoint}/${provider.model}:streamGenerateContent?alt=sse`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": provider.apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: convertToGeminiContents(messages),
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 500
      }
    })
  });

  if (!response.ok) {
    throw await getProviderError(response, provider.name);
  }

  if (!response.body) {
    throw new Error("Gemini returned no response stream.");
  }

  let receivedText = false;

  await readSSE(response, async (data) => {
    const parts = data.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (typeof part.text === "string" && part.text.length > 0) {
        receivedText = true;
        await onToken(part.text);
      }
    }
  });

  if (!receivedText) {
    throw new Error("Gemini returned an empty response.");
  }
};

// Main service function
const streamPortfolioAnswer = async ({ messages, onToken }) => {
  const validMessages = validateMessages(messages);

  if (typeof onToken !== "function") {
    throw new Error("onToken callback is required.");
  }

  const systemPrompt = buildSystemPrompt();

  const errors = [];

  for (const providerKey of PROVIDER_ORDER) {
    const provider = aiProviders[providerKey];

    if (!provider || !provider.enabled) {
      console.log(`${providerKey} is not configured. Skipping.`);
      continue;
    }

    let receivedText = false;

    try {
      console.log(`Trying ${provider.name}...`);

      const tokenCallback = async (token) => {
        receivedText = true;
        await onToken(token);
      };

      if (providerKey === "gemini") {
        await streamGeminiProvider(
          provider,
          validMessages,
          systemPrompt,
          tokenCallback
        );
      } else {
        await streamOpenAIProvider(
          provider,
          validMessages,
          systemPrompt,
          tokenCallback
        );
      }

      console.log(`${provider.name} completed successfully.`);

      return {
        success: true,
        provider: provider.name
      };

    } catch (error) {
      console.error(`${provider.name} failed:`, error.message);

      // Once text has been sent, switching providers could
      // produce a duplicated or inconsistent answer.
      if (receivedText) {
        throw error;
      }

      errors.push({
        provider: provider.name,
        message: error.message
      });

      console.log("Trying the next provider...");
    }
  }

  const finalError = new Error(
    "All AI providers are currently unavailable."
  );

  finalError.providerErrors = errors;

  throw finalError;
};

module.exports = {
  streamPortfolioAnswer
};
