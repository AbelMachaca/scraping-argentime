// api/index.js
const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
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
  res.send("🚀 Servidor funcionando correctamente");
});

// Endpoint de Scraping con Puppeteer (texto limpio + computedStyle)
app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL requerida" });

  let browser;
  try {
    console.log("🌐 Navegando a:", url);
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    const data = await page.evaluate(() => {
      // 1) Title y bajada solo como texto (sin etiquetas)
      const titleEl =
        document.querySelector(".sc-6ab2981a-2 span") ||
        document.querySelector(".sc-e612944f-4");
      const title = titleEl ? titleEl.textContent.trim() : "No encontrado";

      const bajadaEl =
        document.querySelector(".sc-c214f8c1-16") ||
        document.querySelector(".sc-2af63f48-19");
      const bajada = bajadaEl ? bajadaEl.textContent.trim() : "No encontrado";

      // 2) Imagen desde background-image o <img>
      let imageUrl = null;
      const imageDiv = document.querySelector('[class^="sc-6ab2981a-0"]');
      if (imageDiv) {
        const bg = getComputedStyle(imageDiv).backgroundImage;
        const m = bg.match(/url\(["']?(.*?)["']?\)/);
        if (m) imageUrl = m[1];
      }
      if (!imageUrl) {
        const img = document.querySelector(".sc-e65546dd-2 img");
        const src = img?.getAttribute("src");
        if (src) imageUrl = src.startsWith("http") ? src : window.location.origin + src;
        else imageUrl = "No encontrado";
      }

      // 3) Link actual
      const link = window.location.href;

      return { title, bajada, link, image: imageUrl };
    });

    console.log("✅ Datos extraídos:", data);
    res.json(data);

  } catch (err) {
    console.error("🔥 Error en /scrape:", err);
    res.status(500).json({ error: "Error al obtener datos", details: err.message });
  } finally {
    if (browser) {
      await browser.close();
      console.log("👋 Browser cerrado");
    }
  }
});

// Endpoint para exportar a Excel
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

// Arranque local / Render
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`🚀 Servidor escuchando en :${PORT}`));
}

module.exports = app;
