
const isConfigured = (key, model) => {
  return Boolean(
    key &&
    model &&
    !key.startsWith("your_") &&
    !key.includes("...")
  );
};

const aiProviders = {
  groq: {
    name: "Groq",
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL,
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    enabled: isConfigured(
      process.env.GROQ_API_KEY,
      process.env.GROQ_MODEL
    )
  },

  gemini: {
    name: "Gemini",
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    enabled: isConfigured(
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_MODEL
    )
  },

  openrouter: {
    name: "OpenRouter",
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL,
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    enabled: isConfigured(process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_MODEL)
  }
};

module.exports = aiProviders;
