import "dotenv/config";
import express from "express";
import compression from "compression";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { initTelegram } from "./bot/index.js";
import { startScheduler } from "./scheduler/dailyJob.js";
import apiRouter from "./api/index.js";
import { connectDB } from "./config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🚀 Starting application...");

const app = express();
app.use(compression());
app.use(cors());

app.use(express.static(path.join(__dirname, "../public")));
app.use("/api", apiRouter);
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  initTelegram();
  startScheduler();
  app.listen(PORT, () => console.log(`🌍 Web Server & API listening on port ${PORT}`));
});
