const serversStatus = document.getElementById('servers-status');
const serverGroups = document.getElementById('server-groups');
const serverControls = document.getElementById('servers-controls');
const serverSearch = document.getElementById('server-search');
const serverResults = document.getElementById('server-results');
const loginUrl = new URL('/api/auth/login?return=dashboard-my-servers', dashboardOrigin);

function serverLink(label, url, primary = false) {
    const link = document.createElement('a');
    link.className = primary ? 'button button-primary' : 'button button-outline';
    link.href = url;
    link.textContent = label;
    return link;
}

function showServerStatus(message, canSignIn = false) {
    serversStatus.classList.remove('is-loading');
    const text = document.createElement('p');
    text.textContent = message;
    serversStatus.replaceChildren(text);
    if (canSignIn) serversStatus.append(serverLink('Sign in with Discord', loginUrl, true));
}

function renderServer(guild, installed, clientId) {
    const needsPermissions = installed && guild.missingPermissions;
    const canManage = installed && !needsPermissions;
    const row = document.createElement('li');
    row.className = 'server-row';
    const icon = document.createElement('span');
    icon.className = 'server-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = [...guild.name.trim()][0]?.toLocaleUpperCase() || '•';
    if (/^(?:a_)?[a-f0-9]{32}$/.test(guild.icon || '')) {
        const image = document.createElement('img');
        image.src = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=64`;
        image.width = 42;
        image.height = 42;
        image.alt = '';
        image.loading = 'lazy';
        image.addEventListener('error', () => image.remove(), { once: true });
        const fallback = document.createElement('span');
        fallback.style.gridArea = '1 / 1';
        fallback.textContent = icon.textContent;
        icon.replaceChildren(fallback, image);
        image.addEventListener('load', () => fallback.remove(), { once: true });
    }

    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.className = 'server-title';
    title.textContent = guild.name;
    const meta = document.createElement('span');
    meta.className = 'server-meta';
    if (needsPermissions) {
        meta.classList.add('server-meta-warning');
        const warningIcon = document.createElement('span');
        warningIcon.setAttribute('aria-hidden', 'true');
        warningIcon.textContent = '⚠︎';
        meta.append(warningIcon, 'Bot permissions need attention');
    } else {
        meta.textContent = installed ? 'Disc-Tools installed' : 'Disc-Tools can be invited';
    }
    info.append(title, meta);

    const url = canManage
        ? `/manage/${guild.id}/overview`
        : discordBotInvite(guild.id, clientId, needsPermissions ? requiredBotPermissions : '0');

    const actionLabel = needsPermissions ? 'Fix permissions' : installed ? 'Manage' : 'Invite';
    const action = serverLink(actionLabel, url);
    if (needsPermissions) action.classList.add('server-action-warning');
    action.setAttribute('aria-label', `${action.textContent} ${guild.name}`);
    row.append(icon, info, action);
    return row;
}

function showServerGroups(data) {
    const groups = [
        { label: 'With Disc-Tools', entries: data.botServers, installed: true },
        { label: 'Available to invite', entries: data.servers, installed: false }
    ];
    const total = groups.reduce((count, group) => count + group.entries.length, 0);

    if (!total) {
        showServerStatus('No servers found. You need the Manage Server permission on at least one Discord server.');
        return;
    }

    for (const group of groups) {
        if (!group.entries.length) continue;

        const section = document.createElement('section');
        section.className = 'server-group';
        const heading = document.createElement('h2');
        heading.textContent = group.label;
        const list = document.createElement('ul');
        list.className = 'server-list';
        group.rows = group.entries.map(guild => renderServer(guild, group.installed, data.clientId));
        group.section = section;
        list.append(...group.rows);
        section.append(heading, list);
        serverGroups.append(section);
    }

    function filterServers() {
        const query = serverSearch.value.trim().toLocaleLowerCase();
        let matches = 0;
        for (const group of groups) {
            if (!group.rows) continue;

            let visible = 0;
            group.rows.forEach((row, index) => {
                row.hidden = !group.entries[index].name.toLocaleLowerCase().includes(query);
                if (!row.hidden) visible++;
            });
            group.section.hidden = visible === 0;
            matches += visible;
        }
        serverResults.textContent = matches === 0 ? 'No servers match your search.' : `${matches} ${matches === 1 ? 'server' : 'servers'}`;
    }

    serverSearch.addEventListener('input', filterServers);
    serverControls.hidden = false;
    serversStatus.hidden = true;
    filterServers();
}

async function loadServers() {
    const response = await dashboardSession('/api/servers');
    if (!response.ok) throw new Error('Server list unavailable');
    const data = await response.json();
    if (data.authenticated === false || data.error === 'no_access_token') {
        showServerStatus('Sign in with Discord to see your servers.', true);
        return;
    }
    if (data.error || !Array.isArray(data.botServers) || !Array.isArray(data.servers)) {
        throw new Error('Invalid server list');
    }

    for (const key of ['botServers', 'servers']) {
        data[key] = data[key].filter(guild => guild && /^\d{17,20}$/.test(guild.id) && typeof guild.name === 'string');
    }
    showServerGroups(data);
}

document.addEventListener('dashboard-logout', () => {
    serverGroups.replaceChildren();
    serverControls.hidden = true;
    serversStatus.hidden = false;
    window.location.reload();
});

loadServers().catch(() => {
    showServerStatus('Your servers could not be loaded. Please reload this page.');
    serversStatus.append(serverLink('Try again', '/my-servers/'));
});
