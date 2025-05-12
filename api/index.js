// api/index.js
const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");               // o puppeteer-core + chrome-aws-lambda si subes a AWS/Render
const chromium = require("chrome-aws-lambda");
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
app.get("/", (req, res) => {
  res.send("🚀 Servidor funcionando correctamente con Puppeteer");
});

// Endpoint de Scraping con Puppeteer y logs de depuración
app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL requerida" });
  }

  let browser;
  try {
    // 1) Configurar opciones de lanzamiento según entorno
    let launchOptions;
    if (process.env.NODE_ENV === "production") {
      // En producción (Render, Vercel)
      launchOptions = {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
      };
      console.log("🛰️ Launching chrome-aws-lambda");
    } else {
      // En local
      launchOptions = {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      };
      console.log("💻 Launching local puppeteer");
    }
    console.log("🔧 launchOptions:", launchOptions);

    browser = await puppeteer.launch(launchOptions);
    console.log("✅ Browser launched");

    const page = await browser.newPage();
    console.log("✅ Page opened");

    await page.setDefaultNavigationTimeout(60000);
    console.log("⏱️ Navigation timeout set to 60s");

    console.log("🌐 Going to URL:", url);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    console.log("✅ Page loaded");

    const data = await page.evaluate(() => {
      console.log("🔍 In page.evaluate");
      // Texto
      const title =
        document.querySelector(".sc-6ab2981a-2 span")?.innerText.trim() ||
        document.querySelector(".sc-e612944f-4")?.innerText.trim() ||
        "No encontrado";
      const bajada =
        document.querySelector(".sc-c214f8c1-16")?.innerText.trim() ||
        document.querySelector(".sc-2af63f48-19")?.innerText.trim() ||
        "No encontrado";

      // Imagen
      let imageUrl = null;
      const imageDiv = document.querySelector('[class^="sc-6ab2981a-0"]');
      if (imageDiv) {
        const bg = getComputedStyle(imageDiv).backgroundImage;
        if (bg && bg !== "none" && bg.includes("url")) {
          imageUrl = bg.match(/url\(["']?(.*?)["']?\)/)[1];
        }
      }
      if (!imageUrl) {
        const imgTag = document.querySelector(".sc-e65546dd-2 img");
        const rawSrc = imgTag?.getAttribute("src");
        if (rawSrc) {
          imageUrl = rawSrc.startsWith("http")
            ? rawSrc
            : window.location.origin + rawSrc;
        } else {
          imageUrl = "No encontrado";
        }
      }

      // Link
      const link = window.location.href;
      return { title, bajada, link, image: imageUrl };
    });
    console.log("✅ Data extracted:", data);

    res.json(data);
  } catch (error) {
    console.error("🔥 Error en /scrape:", error);
    res.status(500).json({ error: "Error al obtener datos", details: error.message });
  } finally {
    if (browser) {
      await browser.close();
      console.log("👋 Browser closed");
    }
  }
});

// Endpoint para exportar a Excel
app.post("/export-excel", (req, res) => {
  const { data } = req.body;
  if (!data || !Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: "No hay datos para exportar" });
  }

  const headers = ["", ...data.map((item) => item.nota)];
  const rows = [
    ["TITULO", ...data.map((item) => item.title)],
    ["BAJADA", ...data.map((item) => item.bajada)],
    ["LINK", ...data.map((item) => item.link)],
    ["IMAGEN", ...data.map((item) => item.image)],
  ];

  const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Datos");

  const filePath = "data.xlsx";
  xlsx.writeFile(wb, filePath);
  res.download(filePath, "datos.xlsx", (err) => {
    if (err) {
      console.error("Error enviando Excel:", err);
      res.status(500).end();
    }
  });
});

// Arranque local
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () =>
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`)
  );
}

module.exports = app;
