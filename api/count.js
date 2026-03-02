let cachedCount = null;
let cacheTime   = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://useignitris.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Serve cache if fresh
    if (cachedCount !== null && Date.now() - cacheTime < CACHE_TTL) {
        return res.status(200).json({ count: cachedCount });
    }

    const token      = process.env.NOTION_TOKEN;
    const databaseId = 'a6cc514f81fd475a8c846df5a13a432b';

    try {
        let count    = 0;
        let hasMore  = true;
        let cursor   = undefined;

        while (hasMore) {
            const body = { page_size: 100 };
            if (cursor) body.start_cursor = cursor;

            const response = await fetch(
                `https://api.notion.com/v1/databases/${databaseId}/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization':   `Bearer ${token}`,
                        'Content-Type':    'application/json',
                        'Notion-Version':  '2022-06-28',
                    },
                    body: JSON.stringify(body),
                }
            );

            if (!response.ok) throw new Error('Notion query failed');

            const data = await response.json();
            count     += data.results.length;
            hasMore    = data.has_more;
            cursor     = data.next_cursor;
        }

        // Floor at 100 so we never show a number below the stated baseline
        cachedCount = Math.max(count, 100);
        cacheTime   = Date.now();

        return res.status(200).json({ count: cachedCount });
    } catch (err) {
        console.error('Waitlist count error:', err);
        return res.status(200).json({ count: 100 }); // safe fallback
    }
}
