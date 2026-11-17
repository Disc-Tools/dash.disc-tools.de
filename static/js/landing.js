const marquee = document.getElementById('community-marquee');
const marqueeToggle = document.querySelector('.marquee-toggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const communities = marquee.closest('.communities');

async function loadCommunities() {
    const endpoint = '/api/community-showcase';
    const response = await fetch(endpoint, {
        credentials: 'omit',
        signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('Community showcase unavailable');

    const servers = await response.json();
    if (!Array.isArray(servers) || !servers.length) throw new Error('No servers available');

    const firstRow = marquee.querySelector('.marquee-row');
    const rows = [firstRow];
    while (rows.length < Math.min(3, servers.length)) {
        const row = firstRow.cloneNode(true);
        marquee.append(row);
        rows.push(row);
    }

    const lists = rows.map(row => row.querySelector('.community-list'));
    servers.forEach((server, index) => {
        const item = document.createElement('li');
        if (server.iconUrl) {
            const icon = document.createElement('img');
            icon.className = 'community-icon';
            icon.width = 32;
            icon.height = 32;
            icon.alt = '';
            icon.loading = 'lazy';
            icon.decoding = 'async';
            icon.fetchPriority = 'low';
            icon.src = server.iconUrl;
            item.append(icon);
        }
        item.append(server.name);
        lists[index % lists.length].append(item);
    });

    for (const list of lists) {
        const copy = list.cloneNode(true);
        copy.classList.add('marquee-copy');
        copy.setAttribute('aria-hidden', 'true');
        list.after(copy);
        list.parentElement.style.setProperty('--duration', `${Math.max(28, list.children.length * 4)}s`);
    }

    const heading = document.getElementById('communities-title');
    const count = new Intl.NumberFormat(document.documentElement.lang).format(servers.length);
    heading.textContent = `${count} ${servers.length === 1 ? 'server' : 'servers'} using Disc-Tools`;
    syncMarquee();
    communities.removeAttribute('data-loading');
}

let motionPaused = false;

function syncMarquee() {
    marqueeToggle.hidden = reducedMotion.matches;
    marquee.toggleAttribute('data-motion', !reducedMotion.matches);
    marquee.toggleAttribute('data-paused', motionPaused);
    marqueeToggle.textContent = motionPaused ? 'Resume motion' : 'Pause motion';
}

marqueeToggle.addEventListener('click', () => {
    motionPaused = !motionPaused;
    syncMarquee();
});

reducedMotion.addEventListener('change', syncMarquee);
loadCommunities().catch(error => {
    communities.hidden = true;
    console.warn('Could not load the server showcase', error);
});
