// api/index.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const xlsx = require("xlsx");

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// Ruta de prueba
app.get("/", (_req, res) => {
  res.send("🚀 Servidor funcionando correctamente con Axios + Cheerio");
});

// /scrape con axios + cheerio
app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL requerida" });

  try {
    console.log("🌐 Fetching URL:", url);
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(html);

    const titleEl =
      $(".sc-6ab2981a-2 span").first() ||
      $(".sc-e612944f-4").first();
    const title = titleEl.length
      ? titleEl.text().trim()
      : "No encontrado";

    const bajadaEl =
      $(".sc-c214f8c1-16").first() ||
      $(".sc-2af63f48-19").first();
    const bajada = bajadaEl.length
      ? bajadaEl.text().trim()
      : "No encontrado";

    let imageUrl = null;
    const imageDiv = $('[class^="sc-6ab2981a-0"]');
    if (imageDiv.length) {
      const style = imageDiv.attr("style") || "";
      const m = style.match(/background-image:\s*url\(["']?(.*?)["']?\)/i);
      if (m && m[1]) {
        imageUrl = m[1].startsWith("http")
          ? m[1]
          : new URL(m[1], url).href;
      }
    }
    if (!imageUrl) {
      const imgTag = $(".sc-e65546dd-2 img").first();
      const rawSrc = imgTag.attr("src");
      imageUrl = rawSrc
        ? rawSrc.startsWith("http")
          ? rawSrc
          : new URL(rawSrc, url).href
        : "No encontrado";
    }

    const result = { title, bajada, link: url, image: imageUrl };
    console.log("✅ Scrape result:", result);
    res.json(result);

  } catch (err) {
    console.error("🔥 Error en /scrape:", err.message);
    res
      .status(500)
      .json({ error: "Error al obtener datos", details: err.message });
  }
});

// /export-excel igual que antes
app.post("/export-excel", (req, res) => {
  const { data } = req.body;
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: "No hay datos para exportar" });
  }

  const headers = ["", ...data.map((i) => i.nota)];
  const rows = [
    ["TITULO", ...data.map((i) => i.title)],
    ["BAJADA", ...data.map((i) => i.bajada)],
    ["LINK", ...data.map((i) => i.link)],
    ["IMAGEN", ...data.map((i) => i.image)],
  ];

  const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Datos");

  const filePath = "data.xlsx";
  xlsx.writeFile(wb, filePath);
  res.download(filePath, "datos.xlsx", (e) => {
    if (e) {
      console.error("Error enviando Excel:", e);
      res.status(500).end();
    }
  });
});

// Arranque
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () =>
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`)
  );
}

module.exports = app;
