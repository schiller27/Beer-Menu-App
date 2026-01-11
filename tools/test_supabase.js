const SUPABASE_URL = 'https://nlyfolhxfwrlihcculvn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5seWZvbGh4ZndybGloY2N1bHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ1NDMsImV4cCI6MjA4MzY0MDU0M30.mTvYoaTumcZC_c4u8G87YIo8O2A6Mw8D_ADTk7LKrm8';

async function run() {
  const url = `${SUPABASE_URL}/rest/v1/beers`;
  const beer = {
    beer_name: 'Test Beer from script',
    abv: 5.5,
    ibu: 30,
    beer_type: 'IPA',
    brewery_name: 'Script Brewery',
    description: 'Inserted via test script',
    location_name: 'Script Location',
    date_captured: new Date().toISOString()
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(beer)
    });

    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text);
  } catch (err) {
    console.error('Error sending request:', err);
  }
}

run();
