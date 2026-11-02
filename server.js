require("dotenv").config();

const express = require("express");
const cors = require("cors");

const contactRoute = require("./src/routes/contact.js");
const providers = require("./src/config/aiProviders");
const chatbotRoutes = require("./src/routes/chatbotRoutes");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://portfolio-amna-abbas.vercel.app",
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));


app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

app.get("/", (req, res) => {
  res.send("Portfolio API is running.");
});

app.use("/api/chatbot", chatbotRoutes);
app.use("/api/contact", contactRoute);

Object.entries(providers).forEach(([key, provider]) => {
  console.log(
    `${provider.name}: ${provider.enabled ? "Configured" : "Not configured"}`
  );
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

module.exports = app;