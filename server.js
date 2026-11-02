require("dotenv").config();

const express = require("express");
const cors = require("cors");
const contactRoute = require("../backend/src/routes/contact.js");
const providers = require("./src/config/aiProviders");
const chatbotRoutes = require("./src/routes/chatbotRoutes");


const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
  })
);

app.use(express.json({ limit: "10kb" }));

app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.get("/", (req, res) => {
  res.send("Portfolio contact API is running.");
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