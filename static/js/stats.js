const statsNumbers = new Intl.NumberFormat(document.documentElement.lang);
const statsDates = new Intl.DateTimeFormat(document.documentElement.lang, {dateStyle: 'medium', timeZone: 'UTC'});

async function loadStats() {
    const response = await fetch('/api/stats', {signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('Stats unavailable');
    const data = await response.json();
    for (const [id, key] of Object.entries({servers:'servers', users:'totalUsers', community:'communityMembers', backups:'backups'})) {
        if (typeof data[key] === 'number') document.getElementById('stats-' + id).textContent = statsNumbers.format(data[key]);
    }
    document.getElementById('stats-status').textContent = 'Latest numbers loaded.';
}

async function loadStatsHistory() {
    const response = await fetch('/api/stats/history?days=30', {signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('History unavailable');
    const data = await response.json();
    if (!Array.isArray(data.days)) throw new Error('Invalid history');
    const body = document.querySelector('#stats-history tbody');
    for (const day of data.days) {
        const date = new Date(day.date);
        if (!Number.isFinite(date.getTime())) continue;
        const row = body.insertRow();
        row.insertCell().textContent = statsDates.format(date);
        for (const key of ['servers', 'total_users', 'community_members']) {
            row.insertCell().textContent = day[key] == null ? '–' : statsNumbers.format(Number(day[key]));
        }
    }
    document.getElementById('stats-history').hidden = body.rows.length === 0;
    document.getElementById('history-status').textContent = body.rows.length ? '' : 'No daily snapshots available yet.';
}

loadStats().catch(() => { document.getElementById('stats-status').textContent = 'Statistics could not be loaded. Please try again.'; });
loadStatsHistory().catch(() => { document.getElementById('history-status').textContent = 'Daily history could not be loaded. Please try again.'; });
