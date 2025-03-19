const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");
const xlsx = require("xlsx");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Ruta de prueba
app.get("/", (req, res) => {
    res.send("🚀 Servidor funcionando correctamente en Render");
});

// ✅ Scraping con opciones ajustadas para Render
app.post("/scrape", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: "URL requerida" });
    }

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no-zygote"
            ],
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded" });

        const data = await page.evaluate(() => {
            let title =
                document.querySelector(".sc-6ab2981a-2 span")?.innerText || 
                document.querySelector(".sc-e612944f-4")?.innerText ||
                "No encontrado";

            let bajada =
                document.querySelector(".sc-c214f8c1-16")?.innerText || 
                document.querySelector(".sc-2af63f48-19")?.innerText ||
                "No encontrado";

            const link = window.location.href;

            return { title, bajada, link };
        });

        await browser.close();
        res.json(data);
    } catch (error) {
        console.error("❌ Error en Puppeteer:", error);
        res.status(500).json({ error: "Error al obtener datos", details: error.message });
    }
});

// ✅ Ajustamos el puerto para Render
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en http://localhost:${PORT}`));
