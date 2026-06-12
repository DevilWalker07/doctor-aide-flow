import { chromium } from "playwright";
const BASE = "http://localhost:5173";
const browser = await chromium.launch();
const page = await browser.newPage();
let loops = 0;
page.on("console", (m) => {
  if (m.type() === "error" && m.text().includes("Maximum update")) loops++;
});
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.setItem("da_local_user_id", "00000000-0000-4000-8000-000000000001");
  localStorage.setItem("da_shift_id", "test_shift");
  localStorage.setItem("da_plantao_ativo", JSON.stringify({ id: "test_shift", data: "2026-05-17", data_formatada: "17/05/2026", setor: "UTI", hospital: "H", tipo: "uti", status: "active", criado_em: Date.now() }));
});
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
console.log("Dashboard estado limpo (sem F1):", loops, "loops");
await browser.close();
