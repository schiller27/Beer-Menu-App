import React, { useState, useEffect } from 'react';
import { Camera, Upload, Loader, CheckCircle, AlertCircle, List, Home } from 'lucide-react';

// Supabase configuration
const SUPABASE_URL = 'https://nlyfolhxfwrlihcculvn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5seWZvbGh4ZndybGloY2N1bHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ1NDMsImV4cCI6MjA4MzY0MDU0M30.mTvYoaTumcZC_c4u8G87YIo8O2A6Mw8D_ADTk7LKrm8';

export default function BeerMenuApp() {
  const [view, setView] = useState('upload'); // 'upload' or 'browse'
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [allBeers, setAllBeers] = useState([]);
  const [loadingBeers, setLoadingBeers] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (view === 'browse') {
      fetchAllBeers();
    }
  }, [view]);

  const fetchAllBeers = async () => {
    setLoadingBeers(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/beers?select=*&order=created_at.desc&limit=50`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAllBeers(data);
      }
    } catch (err) {
      console.error('Error fetching beers:', err);
    } finally {
      setLoadingBeers(false);
    }
  };

  const handleImageCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
      setError(null);
      setSavedSuccess(false);
    }
  };

  const processImage = async () => {
    if (!image || !locationName.trim()) {
      setError('Please provide both an image and location name');
      return;
    }

    if (!apiKey.trim()) {
      setError('Please provide your Claude API key');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(image);
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
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
                    data: base64
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
        })
      });

      const data = await response.json();
      
      if (data.content && data.content[0]?.text) {
        const jsonText = data.content[0].text.trim();
        const cleanJson = jsonText.replace(/```json\n?|\n?```/g, '');
        const beers = JSON.parse(cleanJson);
        
        const enrichedBeers = beers.map(beer => ({
          ...beer,
          location_name: locationName,
          date_captured: new Date().toISOString()
        }));
        
        setResult(enrichedBeers);
      }
    } catch (err) {
      console.error('Processing error:', err);
      setError('Failed to process image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveToDatabase = async () => {
    if (!result || result.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Save each beer to Supabase
      const promises = result.map(beer => 
        fetch(`${SUPABASE_URL}/rest/v1/beers`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(beer)
        })
      );

      await Promise.all(promises);
      setSavedSuccess(true);
      
      // Clear form after 2 seconds
      setTimeout(() => {
        setImage(null);
        setPreview(null);
        setResult(null);
        setLocationName('');
        setSavedSuccess(false);
      }, 2000);
      
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save to database. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Group beers by location
  const beersByLocation = allBeers.reduce((acc, beer) => {
    if (!acc[beer.location_name]) {
      acc[beer.location_name] = [];
    }
    acc[beer.location_name].push(beer);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Camera className="w-10 h-10 text-amber-600" />
            <h1 className="text-4xl font-bold text-gray-800">BeerBoard</h1>
          </div>
          <p className="text-gray-600">Scan and share beer menus from your favorite spots</p>
        </div>

        {/* Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView('upload')}
            className={`flex-1 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
              view === 'upload'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Upload className="w-5 h-5" />
            Upload Menu
          </button>
          <button
            onClick={() => setView('browse')}
            className={`flex-1 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
              view === 'browse'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <List className="w-5 h-5" />
            Browse Menus
          </button>
        </div>

        {/* Upload View */}
        {view === 'upload' && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Claude API Key *
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-amber-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Get your API key from console.anthropic.com</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Location Name *
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g., Three Brothers Brewing"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Upload Beer Menu Photo *
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageCapture}
                  className="hidden"
                  id="image-input"
                />
                <label
                  htmlFor="image-input"
                  className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-amber-500 hover:bg-amber-50 transition"
                >
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Take Photo or Upload Image</span>
                </label>
              </div>
            </div>

            {preview && (
              <div className="mb-6">
                <img
                  src={preview}
                  alt="Beer menu preview"
                  className="w-full rounded-lg shadow-md"
                />
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {savedSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-green-700 text-sm">Successfully saved to database!</p>
              </div>
            )}

            {!result && (
              <button
                onClick={processImage}
                disabled={!image || !locationName.trim() || !apiKey.trim() || loading}
                className="w-full bg-amber-600 text-white py-4 rounded-lg font-semibold hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    Scan Beer Menu
                  </>
                )}
              </button>
            )}

            {result && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <h2 className="text-2xl font-bold text-gray-800">
                    Found {result.length} Beers
                  </h2>
                </div>

                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                  {result.map((beer, index) => (
                    <div key={index} className="border-l-4 border-amber-500 pl-4 py-2 bg-amber-50 rounded">
                      <h3 className="font-bold text-lg text-gray-800">{beer.beer_name}</h3>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
                        <div>
                          <span className="font-semibold">Type:</span> {beer.beer_type}
                        </div>
                        {beer.abv && (
                          <div>
                            <span className="font-semibold">ABV:</span> {beer.abv}%
                          </div>
                        )}
                        {beer.ibu && (
                          <div>
                            <span className="font-semibold">IBU:</span> {beer.ibu}
                          </div>
                        )}
                        {beer.brewery_name && (
                          <div className="col-span-2">
                            <span className="font-semibold">Brewery:</span> {beer.brewery_name}
                          </div>
                        )}
                      </div>
                      {beer.description && (
                        <p className="text-sm text-gray-500 mt-2">{beer.description}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setResult(null);
                      setImage(null);
                      setPreview(null);
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveToDatabase}
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Submit to Database
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-500 text-center mt-3">
                  Review the beers above, then click Submit to save them to the public database
                </p>
              </div>
            )}
          </div>
        )}

        {/* Browse View */}
        {view === 'browse' && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Recent Beer Menus</h2>
            
            {loadingBeers ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 animate-spin text-amber-600" />
              </div>
            ) : allBeers.length === 0 ? (
              <div className="text-center py-12">
                <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No beer menus yet. Be the first to upload one!</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(beersByLocation).map(([location, beers]) => (
                  <div key={location} className="border-b pb-6 last:border-b-0">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-800">{location}</h3>
                      <span className="text-sm text-gray-500">
                        {formatDate(beers[0].created_at)}
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {beers.map((beer, index) => (
                        <div key={beer.id || index} className="border-l-4 border-amber-500 pl-4 py-2 hover:bg-amber-50 transition rounded">
                          <div className="flex items-start justify-between">
                            <h4 className="font-bold text-gray-800">{beer.beer_name}</h4>
                            <span className="text-sm text-gray-500 whitespace-nowrap ml-2">
                              {beer.beer_type}
                            </span>
                          </div>
                          <div className="flex gap-4 mt-1 text-sm text-gray-600">
                            {beer.abv && <span>ABV: {beer.abv}%</span>}
                            {beer.ibu && <span>IBU: {beer.ibu}</span>}
                          </div>
                          {beer.description && (
                            <p className="text-sm text-gray-500 mt-1">{beer.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Powered by Claude AI · Built with React · Data stored in Supabase</p>
        </div>
      </div>
    </div>
  );
}