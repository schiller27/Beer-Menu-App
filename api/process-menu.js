// Simple mock endpoint for beer menu processing
// In production, this should call a real AI API

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, location_name } = req.body;

    if (!image || !location_name) {
      return res.status(400).json({ error: 'Missing image or location name' });
    }

    // For now, return mock data
    // In production, send the image to a free AI service like:
    // - Google Cloud Vision API (free tier)
    // - Replicate API (free tier)
    // - HuggingFace API (free tier)
    
    const mockBeers = [
      {
        beer_name: "Sample IPA",
        abv: 6.5,
        ibu: 45,
        beer_type: "IPA",
        brewery_name: "Local Brewery",
        description: "A hoppy IPA with citrus notes"
      }
    ];

    return res.status(200).json({ beers: mockBeers });
  } catch (error) {
    console.error('Error processing menu:', error);
    return res.status(500).json({ error: 'Failed to process image' });
  }
}
