import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_INSTRUCTIONS = process.env.MATCH_GPT_INSTRUCTIONS;

export default async function handler(req, res) {
  try {
    //
    // 1) FORMULÁŘ — pokud není parametr URL
    //
    if (!req.query.url) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(`
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Generátor článků</title>
            <style>
              body { font-family:-apple-system, sans-serif; padding:40px; max-width:700px; margin:auto; }
              input { width:100%; padding:12px; font-size:16px; border-radius:8px; border:1px solid #ccc; margin-top:8px; }
              button { margin-top:20px; padding:12px 20px; font-size:16px; background:#0070f3; border:none; color:white; border-radius:8px; cursor:pointer; }
              button:hover { background:#0059c1; }
              h1 { margin-bottom:10px; }
            </style>
          </head>
          <body>
            <h1>Generátor článku ze zápasu</h1>
            <p>Vlož URL zápasu z FIBA Live Stats:</p>
            <code>https://fibalivestats.dcd.shared.geniussports.com/u/CBFFE/2779305/bs.html</code>

            <form method="GET" action="">
              <input name="url" placeholder="Sem vlož URL zápasu…" required />
              <button type="submit">Vygenerovat článek</button>
            </form>
          </body>
        </html>
      `);
    }

    //
    // 2) EXTRAKCE ID ZÁPASU Z URL
    //
    const { url } = req.query;

    const idMatch = url.match(/\/(\d+)\//);
    if (!idMatch) {
      return res.status(400).send("Nepodařilo se získat ID zápasu z URL.");
    }

    const matchId = idMatch[1];

    //
    // 3) STAŽENÍ JSONU Z FIBA API
    //
    const jsonUrl = `https://fibalivestats.dcd.shared.geniussports.com/data/${matchId}/data.json`;

    const jsonResponse = await fetch(jsonUrl);
    if (!jsonResponse.ok) {
      return res.status(500).send(
        `Nepodařilo se stáhnout JSON (${jsonResponse.status}) z ${jsonUrl}`
      );
    }

    const jsonData = await jsonResponse.json();

    //
    // 4) OPENAI API VOLÁNÍ S TVÝMI SYSTEM INSTRUCTIONS
    //
    const completion = await client.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTIONS },
        { role: "user", content: JSON.stringify({ matchJson: jsonData }) }
      ]
    });

    //
    // 5) PARSOVÁNÍ JSON OD MODELU
    //
    let parsed;
    try {
      parsed = JSON.parse(completion.choices[0].message.content);
    } catch (err) {
      return res.status(500).send("Model nevrátil validní JSON: " + err.message);
    }

    // OČEKÁVANÁ TVOJE STRUKTURA:
    //
    // {
    //   "hlavni_clanek": "...",
    //   "titulek": "...",
    //   "shrnuti": "...",
    //   "odlehceny_clanek": "..."
    // }

    const titulek = parsed.titulek || "Bez titulku";
    const shrnuti = parsed.shrnuti || "Bez shrnutí";
    const hlavni = parsed.hlavni_clanek || "Hlavní článek nebyl vygenerován.";
    const odlehceny = parsed.odlehceny_clanek || "Odlehčený článek nebyl vygenerován.";

    //
    // 6) HTML VÝSTUP
    //
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
            pre { white-space:pre-wrap; }
          </style>
        </head>
        <body>
          <a href="/api/generate">← Zpět</a>

          <h1>${titulek}</h1>

          <section>
            <h2>1) Shrnutí</h2>
            <pre>${shrnuti}</pre>
          </section>

          <section>
            <h2>2) Hlavní článek</h2>
            <pre>${hlavni}</pre>
          </section>

          <section>
            <h2>3) Odlehčený článek</h2>
            <pre>${odlehceny}</pre>
          </section>
        </body>
      </html>
    `);

  } catch (error) {
    console.error("CHYBA SERVERU:", error);
    res.status(500).send("Chyba serveru: " + error.message);
  }
}
