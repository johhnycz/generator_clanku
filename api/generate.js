import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// sem dáš své kompletní instrukce z Custom GPT (ve Vercel env proměnných)
const SYSTEM_INSTRUCTIONS = process.env.MATCH_GPT_INSTRUCTIONS;

export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: "Chybí parametr 'url'" });
    }

    //
    // 1) VYTÁHNEME ID ZE ZADANÉ URL
    //
    // Příklad:
    // https://fibalivestats.dcd.shared.geniussports.com/u/CBFFE/2779305/bs.html
    //
    // → ID je to poslední číslo (2779305)
    //
    const idMatch = url.match(/\/(\d+)\//);
    if (!idMatch) {
      return res.status(400).json({
        error: "Nepodařilo se získat ID zápasu z URL."
      });
    }

    const matchId = idMatch[1];

    //
    // 2) JSON URL podle tebou uvedeného formátu
    //
    const jsonUrl = `https://fibalivestats.dcd.shared.geniussports.com/data/${matchId}/data.json`;

    //
    // 3) STAŽENÍ JSONU
    //
    const jsonResponse = await fetch(jsonUrl);
    if (!jsonResponse.ok) {
      return res.status(500).json({
        error: `Nepodařilo se stáhnout JSON (${jsonResponse.status}) z ${jsonUrl}`
      });
    }

    const jsonData = await jsonResponse.json();

    //
    // 4) ODESLÁNÍ DO OPENAI (s tvými instrukcemi)
    //
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini", // můžeš změnit na jiný dostupný model
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

    //
    // 5) VRÁCENÍ VÝSLEDKU
    //
    res.status(200).json({
      matchId,
      jsonUrl,
      article: output
    });

  } catch (error) {
    console.error("Chyba v API:", error);
    res.status(500).json({ error: error.message });
  }
}
