import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Tvůj system prompt vložený ve Vercelu (MATCH_GPT_INSTRUCTIONS)
const SYSTEM_INSTRUCTIONS = process.env.MATCH_GPT_INSTRUCTIONS;

// Hlavní export serverless funkce
export default async function handler(req, res) {
  try {
    // Pokud není parametr URL → zobraz input stránku:
    if (!req.query.url) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(`
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Generátor článků ze zápasu</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
                padding: 40px; 
                max-width: 700px; 
                margin: auto; 
                line-height: 1.6;
              }
              input {
                width: 100%;
                padding: 12px;
                font-size: 16px;
                border-radius: 8px;
                border: 1px solid #ccc;
                margin-top: 8px;
              }
              button {
                margin-top: 20px;
                padding: 12px 20px;
                font-size: 16px;
                border: none;
                background: #0070f3;
                color: white;
                border-radius: 8px;
                cursor: pointer;
              }
              button:hover {
                background: #0059c1;
              }
              h1 { margin-bottom: 10px; }
            </style>
          </head>
          <body>
            <h1>Generátor článku ze zápasu</h1>
            <p>Vlož URL zápasu z FIBA Live Stats, například:</p>
            <code>https://fibalivestats.dcd.shared.geniussports.com/u/CBFFE/2779305/bs.html</code>

            <form method="GET" action="">
              <input 
                name="url" 
                placeholder="Sem vlož URL zápasu…" 
                required
              />
              <button type="submit">Vygenerovat článek</button>
            </form>
          </body>
        </html>
      `);
    }

    //
    // Pokud uživatel zadal URL → pokračujeme ke generování článku
    //
    const { url } = req.query;

    // 1) Získání ID ze vstupní FIBA Live Stats URL
    const idMatch = url.match(/\/(\d+)\//);
    if (!idMatch) {
      return res.status(400).send("Nepodařilo se získat ID zápasu z URL.");
    }
    const matchId = idMatch[1];

    // 2) URL JSONu
    const jsonUrl = `https://fibalivestats.dcd.shared.geniussports.com/data/${matchId}/data.json`;

    // 3) Stažení JSONu
    const jsonResponse = await fetch(jsonUrl);
    if (!jsonResponse.ok) {
      return res
        .status(500)
        .send(`Nepodařilo se stáhnout JSON (${jsonResponse.status}) z: ${jsonUrl}`);
    }

    const jsonData = await jsonResponse.json();

    // 4) Zavolání OpenAI s tvými instrukcemi
    const completion = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: SYSTEM_INSTRUCTIONS || "Zpracuj JSON zápasu podle interních pravidel."
        },
        {
          role: "user",
          content: JSON.stringify({
            matchJson: jsonData
          })
        }
      ]
    });

    const output = completion.choices[0].message.content;

    // 5) Výstup zobrazíme jako HTML dokument
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    return res.status(200).send(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Vygenerovaný článek</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              padding: 40px;
              line-height: 1.6;
              max-width: 800px;
              margin: auto;
            }
            a { color: #0070f3; }
            pre { background: #f4f4f4; padding: 12px; border-radius: 6px; }
            h1, h2, h3 { margin-top: 28px; }
          </style>
        </head>
        <body>
          <a href="/api/generate">← Zpět</a>
          <h1>Vygenerovaný článek</h1>
          <h3>Zápas ID: ${matchId}</h3>
          <p><strong>Zdroj JSON:</strong> <a href="${jsonUrl}">${jsonUrl}</a></p>
          <hr />
          ${output}
        </body>
      </html>
    `);

  } catch (error) {
    console.error("Chyba v API:", error);
    res.status(500).send("Došlo k chybě: " + error.message);
  }
}
