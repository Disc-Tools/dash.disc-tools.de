const serverId = window.location.pathname.match(/^\/manage\/(\d{17,20})\/overview\/?$/)?.[1];
const manageSignInUrl = new URL('/api/auth/login?return=dashboard-my-servers', dashboardOrigin);
const overview = document.getElementById('manage-overview');
const manageStatus = document.getElementById('manage-status');
const manageStatusText = document.getElementById('manage-status-text');
const manageActions = document.getElementById('manage-status-actions');
const identity = document.getElementById('manage-identity');
const manageNavigation = document.getElementById('manage-navigation');
const manageSidebar = document.querySelector('.manage-sidebar');
const manageSettings = document.getElementById('manage-settings');
const sidebarMenu = document.querySelector('.manage-sidebar-toggle');
const sidebarBody = document.getElementById('manage-sidebar-body');
const compactSidebar = window.matchMedia('(max-width: 740px)');
const growthSummary = document.getElementById('growth-summary');
const growthChart = document.getElementById('growth-chart');
const growthDetails = document.getElementById('growth-details');
const periodButtons = document.querySelectorAll('.growth-periods button');
const numbers = new Intl.NumberFormat(document.documentElement.lang);
const dates = new Intl.DateTimeFormat(document.documentElement.lang, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayMs = 86_400_000;
const svgNamespace = 'http://www.w3.org/2000/svg';
let memberHistory;
let growthDays = 7;

function setSidebarOpen(open) {
    sidebarMenu.setAttribute('aria-expanded', String(open));
    sidebarBody.toggleAttribute('data-open', open);
}

sidebarMenu.addEventListener('click', () => {
    setSidebarOpen(sidebarMenu.getAttribute('aria-expanded') === 'false');
});

compactSidebar.addEventListener('change', () => {
    if (compactSidebar.matches && sidebarBody.contains(document.activeElement)) sidebarMenu.focus();
    setSidebarOpen(false);
});

manageSidebar.addEventListener('keydown', event => {
    if (event.key === 'Escape' && compactSidebar.matches && sidebarBody.hasAttribute('data-open')) {
        setSidebarOpen(false);
        sidebarMenu.focus();
    }
});

manageNavigation.querySelector('[aria-current="page"]').addEventListener('click', () => {
    if (compactSidebar.matches) setSidebarOpen(false);
});

function setManageStatus(text, action) {
    manageStatus.hidden = false;
    manageStatusText.textContent = text;
    manageActions.replaceChildren();
    if (action) {
        const link = document.createElement('a');
        link.className = 'button button-outline';
        link.href = action.url;
        link.textContent = action.label;
        manageActions.append(link);
    }
}

function renderServerIdentity(server) {
    const iconContainer = identity.querySelector('.manage-icon');
    iconContainer.textContent = [...server.name.trim()][0]?.toLocaleUpperCase() || '•';
    if (/^(?:a_)?[a-f0-9]{32}$/.test(server.icon || '')) {
        const image = document.createElement('img');
        image.width = image.height = 44;
        image.alt = '';
        image.addEventListener('load', () => iconContainer.replaceChildren(image), { once: true });
        image.src = `https://cdn.discordapp.com/icons/${serverId}/${server.icon}.webp?size=64`;
    }
    document.getElementById('manage-server-name').textContent = server.name;
    document.getElementById('manage-server-id').textContent = serverId;
    document.title = `${server.name} · Overview | Disc-Tools`;
    identity.hidden = false;
    sidebarMenu.hidden = false;
}

function chartElement(name, attributes) {
    const element = document.createElementNS(svgNamespace, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
}

function renderGrowth() {
    if (!memberHistory) return;

    const end = Date.parse(new Date().toISOString().slice(0, 10));
    const start = end - dayMs * (growthDays - 1);
    const points = memberHistory.filter(point => point.date >= start && point.date <= end);
    growthChart.hidden = points.length === 0;
    growthDetails.hidden = points.length === 0;
    if (!points.length) {
        growthSummary.textContent = 'No member snapshots in this period yet.';
        return;
    }

    const first = points[0];
    const last = points.at(-1);
    const change = last.count - first.count;
    growthSummary.textContent = points.length === 1
        ? `${numbers.format(last.count)} members in the only recorded snapshot.`
        : `${numbers.format(last.count)} members at the latest snapshot · ${change > 0 ? '+' : ''}${numbers.format(change)} over the recorded period`;

    const max = Math.max(100, Math.ceil(Math.max(...points.map(point => point.count)) / 100) * 100);
    // Keep labels readable on larger servers while retaining round hundred values.
    const step = Math.ceil(max / 600) * 100;
    const ticks = [max];
    for (let value = Math.floor((max - 1) / step) * step; value >= 0; value -= step) {
        if (value === 0 || max - value >= step / 2) ticks.push(value);
    }

    const chartY = count => 150 - (count / max) * 140;
    const coords = points.map(point => ({
        x: 5 + ((point.date - start) / (end - start)) * 590,
        y: chartY(point.count)
    }));
    const svg = growthChart.querySelector('svg');
    const guideLines = ticks.map(count => chartElement('line', {
        x1: 0, x2: 600, y1: chartY(count), y2: chartY(count),
        stroke: 'var(--border)', 'vector-effect': 'non-scaling-stroke'
    }));
    const line = chartElement('polyline', {
        points: coords.map(point => `${point.x},${point.y}`).join(' '),
        fill: 'none',
        stroke: 'var(--accent-light)',
        'stroke-width': 2,
        'vector-effect': 'non-scaling-stroke'
    });
    svg.replaceChildren(...guideLines, line);

    growthChart.querySelector('.growth-points').replaceChildren(...coords.map(({ x, y }, index) => {
        const dot = document.createElement('span');
        dot.className = 'growth-point';
        dot.style.left = `${x / 6}%`;
        dot.style.top = `${y / 1.6}%`;
        const point = points[index];
        dot.title = `${dates.format(point.date)} · ${numbers.format(point.count)} members`;
        return dot;
    }));

    const scale = growthChart.querySelector('.growth-scale');
    const labels = growthChart.querySelector('.growth-dates');
    scale.replaceChildren(...ticks.map(value => {
        const span = document.createElement('span');
        span.style.setProperty('--tick-y', `${chartY(value) / 1.6}%`);
        span.textContent = numbers.format(value);
        return span;
    }));
    labels.replaceChildren(...[start, end].map(date => {
        const span = document.createElement('span');
        span.textContent = dates.format(date);
        return span;
    }));

    growthDetails.querySelector('tbody').replaceChildren(...points.map(point => {
        const row = document.createElement('tr');
        row.insertCell().textContent = dates.format(point.date);
        row.insertCell().textContent = numbers.format(point.count);
        return row;
    }));
}

function setHistory(rows) {
    if (!Array.isArray(rows)) {
        growthSummary.textContent = 'Member history is unavailable.';
        return;
    }

    memberHistory = rows.filter(row => row?.member_count != null).map(row => ({
        date: Date.parse(String(row.date).slice(0, 10)),
        count: Number(row.member_count)
    })).filter(point => Number.isFinite(point.date) && Number.isInteger(point.count) && point.count >= 0)
        .sort((a, b) => a.date - b.date);
    renderGrowth();
}

for (const button of periodButtons) {
    button.addEventListener('click', () => {
        growthDays = Number(button.dataset.days);
        for (const option of periodButtons) option.setAttribute('aria-pressed', String(option === button));
        renderGrowth();
    });
}

async function loadOverview() {
    if (!serverId) {
        setManageStatus('Invalid server ID.');
        return;
    }

    const [serverResult, statsResult] = await Promise.allSettled([
        dashboardSession('/api/servers'),
        dashboardSession(`/api/guilds/${serverId}/stats?days=30`)
    ]);
    if (serverResult.status === 'rejected') throw serverResult.reason;
    const response = serverResult.value;
    if (!response.ok) throw new Error('Server overview unavailable');
    const data = await response.json();
    if (data.authenticated === false || data.error === 'no_access_token') {
        setManageStatus('Sign in with Discord to manage this server.', {
            url: manageSignInUrl,
            label: 'Sign in with Discord'
        });
        return;
    }
    if (data.error || !Array.isArray(data.botServers) || !Array.isArray(data.servers)) {
        throw new Error('Invalid server list');
    }

    const installed = data.botServers.find(server => server.id === serverId);
    const server = installed || data.servers.find(server => server.id === serverId);
    if (!server) {
        setManageStatus('You need the Manage Server permission to view this server.', { url: '/my-servers/', label: 'My servers' });
        return;
    }

    if (!installed || server.missingPermissions) {
        renderServerIdentity(server);
        manageStatus.setAttribute('data-warning', '');
        setManageStatus(installed ? 'Bot permissions need attention.' : 'Disc-Tools is not installed on this server.', {
            url: discordBotInvite(serverId, data.clientId, requiredBotPermissions),
            label: installed ? 'Fix permissions' : 'Add Disc-Tools'
        });
        return;
    }

    if (statsResult.status === 'rejected') throw statsResult.reason;
    const statsResponse = statsResult.value;
    if (statsResponse.status === 403) {
        setManageStatus('Only the server owner or a member with the configured manager role can open this overview.', {
            url: '/my-servers/', label: 'My servers'
        });
        return;
    }
    if (statsResponse.status === 401) {
        setManageStatus('Your Discord session has expired.', {
            url: manageSignInUrl,
            label: 'Sign in with Discord'
        });
        return;
    }
    if (!statsResponse.ok) throw new Error('Server statistics unavailable');

    const stats = await statsResponse.json();
    renderServerIdentity(server);
    for (const link of manageSidebar.querySelectorAll('[data-panel]')) {
        link.href = `/manage/${serverId}/${link.dataset.panel}`;
    }
    manageNavigation.hidden = false;
    manageSettings.hidden = false;

    const statistics = { members: stats.memberCount ?? server.memberCount, online: server.onlineCount, roles: server.roleCount, boosts: server.boostCount };
    for (const [key, value] of Object.entries(statistics)) {
        if (Number.isFinite(value)) document.getElementById(`stat-${key}`).textContent = numbers.format(value);
    }
    manageStatus.hidden = true;
    overview.hidden = false;
    setHistory(stats.history);
}

loadOverview().catch(() => {
    setManageStatus('The server overview could not be loaded. Reload the page or open the live dashboard.', {
        url: new URL(`/manage/${serverId}/overview`, dashboardOrigin),
        label: 'Open live overview'
    });
});
