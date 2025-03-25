import express from "express";
import { crawlWebsite } from "./lib/crawler";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
// @ts-ignore
app.post("/api/crawl", async (req, res) => {
  try {
    const { url, maxPages } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const result = await crawlWebsite(url, maxPages || 1000);
    res.json(result);
  } catch (error) {
    console.error("Crawl error:", error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Failed to crawl website" });
    }
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
