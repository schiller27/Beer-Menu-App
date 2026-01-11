import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

const client = new Anthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.error(`Invalid method: ${req.method} - expected POST`);
    return res.status(405).json({ error: 'Method not allowed. Only POST is supported.' });
  }

  try {
    const { image, location_name } = req.body;

    if (!image || !location_name) {
      return res.status(400).json({ error: 'Missing image or location name' });
    }

    if (!process.env.VITE_ANTHROPIC_API_KEY) {
      console.error('VITE_ANTHROPIC_API_KEY is not configured');
      return res.status(500).json({ error: 'API key not configured on server' });
    }

    // Convert base64 to buffer and compress
    let imageData = image;
    if (image.startsWith('data:')) {
      imageData = image.split(',')[1];
    }

    const imageBuffer = Buffer.from(imageData, 'base64');
    console.log(`Original image size: ${imageBuffer.length} bytes`);

    // Compress the image using sharp
    const compressedBuffer = await sharp(imageBuffer)
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 75 })
      .toBuffer();

    const compressedBase64 = compressedBuffer.toString('base64');
    console.log(`Compressed image size: ${compressedBuffer.length} bytes`);

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
                data: compressedBase64
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

    res.status(200).json({ beers });
  } catch (error) {
    console.error('Error processing menu:', error);
    console.error('Error message:', error.message);
    console.error('Error status:', error.status);
    res.status(500).json({ 
      error: error.message || 'Failed to process image',
      details: error.status ? `API Error ${error.status}` : 'Unknown error'
    });
  }
}
