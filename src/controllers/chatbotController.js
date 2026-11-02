
const {
  streamPortfolioAnswer
} = require("../services/aiService");

const chatWithPortfolio = async (req, res) => {
  try {
    const { messages } = req.body;

    // Validate request
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid message."
      });
    }

    // Limit conversation size
    if (messages.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Conversation is too long."
      });
    }

    // Validate message content
    const validRoles = ["user", "assistant"];

    for (const message of messages) {
      if (
        !message ||
        !validRoles.includes(message.role) ||
        typeof message.content !== "string" ||
        !message.content.trim() ||
        message.content.length > 2000
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid message format."
        });
      }
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    res.flushHeaders();

    // Send individual chunks to frontend
    const result = await streamPortfolioAnswer({
      messages,

      onToken: (token) => {
        if (res.destroyed) {
          throw new Error("Client disconnected.");
        }

        res.write(
          `data: ${JSON.stringify({
            type: "token",
            content: token
          })}\n\n`
        );
      }
    });

    // Tell frontend the response is complete
    if (!res.destroyed) {
      res.write(
        `data: ${JSON.stringify({
          type: "done",
          provider: result.provider
        })}\n\n`
      );

      res.end();
    }

  } catch (error) {
    console.error("Chatbot Controller Error:", error.message);

    // If headers were already sent, return an SSE error
    if (res.headersSent) {
      if (!res.destroyed && !res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            message: "Unable to generate a response. Please try again."
          })}\n\n`
        );

        res.end();
      }

      return;
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong with the AI assistant."
    });
  }
};

module.exports = {
  chatWithPortfolio
};
