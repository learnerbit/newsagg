import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // 1. Security check: Only allow if a secret key matches (prevents random people from spamming your API)
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== process.env.SYNC_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Fetch latest headlines (Example: Top US News)
    const response = await fetch(
      `https://newsapi.org/v2/top-headlines?country=us&apiKey=${process.env.NEWS_API_KEY}`
    );
    const data = await response.json();

    // 3. Map the news to your Outlets
    // Note: This logic assumes you have an outlet named "The Associated Press" or similar.
    for (const item of data.articles.slice(0, 15)) {
    const sourceName = item.source.name;

    // 1. Check if the outlet already exists
    let outlet = await sql`SELECT id FROM outlets WHERE name ILIKE ${sourceName}`;

    // 2. If it doesn't exist, create it! 
    if (outlet.length === 0) {
        outlet = await sql`
        INSERT INTO outlets (name, bias_label, ownership_details)
        VALUES (${sourceName}, 'Unknown', 'Auto-discovered via API')
        RETURNING id
        `;
    }

    // 3. Insert the article using the ID we just found or created
    await sql`
        INSERT INTO articles (title, url, summary, outlet_id, category)
        VALUES (
        ${item.title}, 
        ${item.url}, 
        ${item.description || 'No summary provided'}, 
        ${outlet[0].id}, 
        'Top Stories'
        )
        ON CONFLICT (url) DO NOTHING
    `;
    }

    return NextResponse.json({ success: true, message: 'News synced!' });
    } catch (error: any) {
        console.error("SYNC ERROR:", error); // This shows up in your terminal
        return NextResponse.json({ 
        error: 'Sync failed', 
        details: error.message 
        }, { status: 500 });
    }
}