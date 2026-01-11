import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

console.log('API Key loaded:', process.env.VITE_ANTHROPIC_API_KEY ? 'Yes (length: ' + process.env.VITE_ANTHROPIC_API_KEY.length + ')' : 'No');

const client = new Anthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY
});

app.post('/process-menu', async (req, res) => {
  try {
    const { image, location_name } = req.body;

    if (!image || !location_name) {
      return res.status(400).json({ error: 'Missing image or location name' });
    }

    if (!process.env.VITE_ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
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

    res.json({ beers });
  } catch (error) {
    console.error('Error processing menu:', error);
    console.error('Error details:', error.message);
    console.error('Error status:', error.status);
    res.status(500).json({ error: error.message || 'Failed to process image' });
  }
});

// Endpoint to save beers to Supabase using service role key
app.post('/save-beers', async (req, res) => {
  try {
    const { beers } = req.body;

    if (!Array.isArray(beers) || beers.length === 0) {
      return res.status(400).json({ error: 'No beers provided' });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL');
      return res.status(500).json({ error: 'Server misconfigured: missing Supabase service role key. Add SUPABASE_SERVICE_ROLE_KEY to .env' });
    }

    // Insert into Supabase REST API
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/beers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(beers)
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error('Supabase insert failed', resp.status, text);
      return res.status(resp.status).json({ error: `Supabase insert failed: ${text}` });
    }

    const inserted = JSON.parse(text);
    res.json({ inserted });
  } catch (err) {
    console.error('Error saving beers:', err);
    res.status(500).json({ error: 'Failed to save beers' });
  }
});

// Endpoint to save beers to Supabase using a service role key (server-side)
app.post('/save-beers', async (req, res) => {
  try {
    const beers = req.body.beers;
    if (!beers || !Array.isArray(beers) || beers.length === 0) {
      return res.status(400).json({ error: 'No beers provided' });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_SERVICE_ROLE;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('Supabase URL or service role key not configured');
      return res.status(500).json({ error: 'Supabase not configured on server' });
    }

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/beers`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(beers)
    });

    if (!insertRes.ok) {
      const text = await insertRes.text();
      console.error('Supabase insert error:', insertRes.status, text);
      return res.status(insertRes.status).json({ error: 'Failed to insert into Supabase', details: text });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving beers:', err);
    res.status(500).json({ error: 'Server failed to save beers' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
