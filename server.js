const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");
const xlsx = require("xlsx");

const app = express();
app.use(express.json());
app.use(cors());

app.post("/scrape", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: "URL requerida" });
    }

    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded" });

        const data = await page.evaluate(() => {
            // Intentamos encontrar el título en cualquiera de las clases posibles
            let title =
                document.querySelector(".sc-6ab2981a-2 span")?.innerText || 
                document.querySelector(".sc-e612944f-4")?.innerText ||
                "No encontrado";

            // Intentamos encontrar la bajada en cualquiera de las clases posibles
            let bajada =
                document.querySelector(".sc-c214f8c1-16")?.innerText || 
                document.querySelector(".sc-2af63f48-19")?.innerText ||
                "No encontrado";

            // Capturamos el link de la página
            const link = window.location.href;

            return { title, bajada, link };
        });

        await browser.close();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener datos", details: error.message });
    }
});

app.post("/export-excel", (req, res) => {
    const { data } = req.body;

    if (!data || data.length === 0) {
        return res.status(400).json({ error: "No hay datos para exportar" });
    }

    // Crear estructura con múltiples columnas
    const headers = ["", ...data.map((item) => item.nota)];
    const rows = [
        ["TITULO", ...data.map((item) => item.title)],
        ["BAJADA", ...data.map((item) => item.bajada)],
        ["LINK Y CTA", ...data.map((item) => item.link)],
    ];

    const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Datos");

    const filePath = "data.xlsx";
    xlsx.writeFile(wb, filePath);

    res.download(filePath);
});

const PORT = 5000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en http://localhost:${PORT}`));
