// Simple test script to POST a sample beer to the local /save-beers endpoint
// Run with: node tools/test_supabase_insert.js

async function main() {
  const sampleBeers = [
    {
      beer_name: 'Test IPA',
      beer_type: 'IPA',
      abv: 6.5,
      ibu: 50,
      brewery_name: 'Test Brewery',
      description: 'Sample beer inserted for testing',
      location_name: 'Local Test Pub',
      date_captured: new Date().toISOString()
    }
  ];

  try {
    const resp = await fetch('http://localhost:3001/save-beers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beers: sampleBeers })
    });

    const text = await resp.text();
    console.log('Status:', resp.status);
    console.log('Response body:', text);
  } catch (err) {
    console.error('Test request failed:', err);
  }
}

main();
