import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_INSTRUCTIONS = process.env.MATCH_GPT_INSTRUCTIONS;

export default async function handler(req, res) {
  try {
    // FORM page
    if (!req.query.url) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(`
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Generátor článků</title>
            <style>
              body { font-family: -apple-system, sans-serif; padding:40px; max-width:700px; margin:auto; }
              input { width:100%; padding:12px; font-size:16px; border-radius:8px; border:1px solid #ccc; margin-top:8px; }
              button { margin-top:20px; padding:12px 20px; font-size:16px; background:#0070f3; border:none; color:white; border-radius:8px; cursor:pointer; }
            </style>
          </head>
          <body>
            <h1>Generátor článku</h1>
            <form method="GET" action="">
              <input name="url" placeholder="Sem vlož URL zápasu…" required />
              <button type="submit">Vygenerovat článek</button>
            </form>
          </body>
        </html>
      `);
    }

    const { url } = req.query;

    // EXTRACT MATCH ID
    const idMatch = url.match(/\/(\d+)\//);
    if (!idMatch) return res.status(400).send("Nepodařilo se získat ID zápasu.");
    const matchId = idMatch[1];

    // JSON URL
    const jsonUrl = `https://fibalivestats.dcd.shared.geniussports.com/data/${matchId}/data.json`;

    // DOWNLOAD JSON
    const jsonResponse = await fetch(jsonUrl);
    if (!jsonResponse.ok) {
      return res.status(500).send(`Nepodařilo se stáhnout JSON (${jsonResponse.status}) z ${jsonUrl}`);
    }
    const jsonData = await jsonResponse.json();

    // CALL OPENAI
    const completion = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTIONS },
        { role: "user", content: JSON.stringify({ matchJson: jsonData }) }
      ]
    });

    // OUTPUT FROM MODEL — expecting JSON
    let parsed;
    try {
      parsed = JSON.parse(completion.choices[0].message.content);
    } catch (err) {
      return res.status(500).send("Model nevrátil validní JSON: " + err.message);
    }

    const { titulek, shrnuti, clanek, clanek_verze_2 } = parsed;

    // HTML OUTPUT
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${titulek}</title>
          <style>
            body { font-family:-apple-system, sans-serif; padding:40px; max-width:800px; margin:auto; line-height:1.6; }
            section { margin-bottom:40px; }
            h2 { margin-top:20px; }
            hr { margin:40px 0; }
          </style>
        </head>
        <body>
          <a href="/api/generate">← Zpět</a>

          <h1>${titulek}</h1>

          <section>
            <h2>1) Shrnutí</h2>
            <p>${shrnuti.replace(/\n/g, "<br>")}</p>
          </section>

          <section>
            <h2>2) Hlavní článek</h2>
            <p>${clanek.replace(/\n/g, "<br>")}</p>
          </section>

          <section>
            <h2>3) Druhá verze článku</h2>
            <p>${clanek_verze_2.replace(/\n/g, "<br>")}</p>
          </section>
        </body>
      </html>
    `);

  } catch (error) {
    console.error(error);
    res.status(500).send("Chyba: " + error.message);
  }
}
