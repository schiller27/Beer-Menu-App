import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

app.post('/process-menu', async (req, res) => {
  try {
    const { image, location_name } = req.body;

    if (!image || !location_name) {
      return res.status(400).json({ error: 'Missing image or location name' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: image
              }
            },
            {
              type: 'text',
              text: `Extract beer menu information from this image. Return ONLY a JSON array with this exact structure, no other text:
[
  {
    "beer_name": "string",
    "abv": "number or null",
    "ibu": "number or null", 
    "beer_type": "string",
    "brewery_name": "string or null",
    "description": "string or null"
  }
]

Rules:
- Extract ALL beers visible in the image
- For ABV and IBU, extract only the numeric value
- If information is missing, use null
- Beer type should be standardized (IPA, Lager, Stout, Porter, Ale, Seltzer, Witbier, etc.)
- Return valid JSON only, no markdown formatting`
            }
          ]
        }
      ]
    });

    const jsonText = response.content[0].text.trim();
    const cleanJson = jsonText.replace(/```json\n?|\n?```/g, '');
    const beers = JSON.parse(cleanJson);

    res.json({ beers });
  } catch (error) {
    console.error('Error processing menu:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
