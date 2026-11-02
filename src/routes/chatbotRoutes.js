
const express = require("express");

const {
  chatWithPortfolio
} = require("../controllers/chatbotController");

const router = express.Router();

router.post("/", chatWithPortfolio);

module.exports = router;
