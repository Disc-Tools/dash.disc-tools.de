const managedServerId = window.location.pathname.match(/^\/manage\/(\d{17,20})\/(settings|verification|honeypot|bump)\/?$/)?.[1];
const settingsPanel = document.querySelector('.profile-panel');
const settingsLoading = document.getElementById('settings-loading');
const settingsIdentity = document.getElementById('manage-identity');
const settingsSidebarBody = document.getElementById('manage-sidebar-body');
const settingsMenu = document.querySelector('.manage-sidebar-toggle');
let verifiedServerList;
let initialSettings;
let initialSettingsUsed = false;

function settingsMessage(message, action) {
    settingsPanel.hidden = true;
    settingsLoading.textContent = message;
    if (action) {
        const link = document.createElement('a');
        link.className = 'button button-outline';
        link.href = action.url;
        link.textContent = action.label;
        settingsLoading.append(document.createElement('br'), link);
    }
}

async function manageSettingsFetch(path, options = {}) {
    if (!managedServerId) throw new Error('Invalid server ID');
    const url = new URL(path, dashboardOrigin);
    const allowedPath = `/api/guilds/${managedServerId}/`;
    if (!url.pathname.startsWith(allowedPath)) throw new Error('Unexpected settings endpoint');

    const method = options.method || 'GET';
    if (method === 'GET' && url.pathname.endsWith('/settings') && initialSettings && !initialSettingsUsed) {
        initialSettingsUsed = true;
        return Response.json(initialSettings);
    }

    const response = await fetch(url, {
        ...options,
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(method === 'GET' ? 10000 : 30000)
    });
    if (method === 'GET' && !response.ok) throw new Error('Settings could not be loaded');

    // Uploaded images are hosted by the dashboard.
    if (response.ok && url.pathname.endsWith('/upload')) {
        const data = await response.json();
        if (data.url) data.url = new URL(data.url, dashboardOrigin).href;
        return Response.json(data);
    }
    return response;
}

async function checkAuth() {
    try {
        if (!managedServerId) throw new Error('Invalid server ID');
        const [serverResult, settingsResult] = await Promise.allSettled([
            dashboardSession('/api/servers'),
            dashboardSession(`/api/guilds/${managedServerId}/settings`)
        ]);
        if (serverResult.status === 'rejected') throw serverResult.reason;
        const response = serverResult.value;
        if (!response.ok) throw new Error('Server list unavailable');
        const data = await response.json();
        if (!data.authenticated || data.error === 'no_access_token') {
            settingsMessage('Sign in with Discord to configure this server.', {
                label: 'Sign in with Discord',
                url: new URL('/api/auth/login?return=dashboard-my-servers', dashboardOrigin)
            });
            return { authenticated: false };
        }
        if (data.error || !Array.isArray(data.botServers) || !Array.isArray(data.servers)) throw new Error('Invalid server list');
        const server = data.botServers.find(guild => guild.id === managedServerId);
        if (!server || server.missingPermissions) {
            const listed = server || data.servers.find(guild => guild.id === managedServerId);
            settingsMessage(listed ? 'The bot needs to be installed with the required permissions.' : 'You do not have access to this server.', {
                label: listed ? 'Fix permissions' : 'My servers',
                url: listed ? discordBotInvite(managedServerId, data.clientId, requiredBotPermissions) : '/my-servers/'
            });
            return { authenticated: false };
        }

        if (settingsResult.status === 'rejected') throw settingsResult.reason;
        const settings = settingsResult.value;
        if (!settings.ok) {
            settingsMessage(settings.status === 403
                ? 'Only the server owner or a member with the configured manager role can edit these settings.'
                : 'Settings could not be loaded. Please reload this page.');
            return { authenticated: false };
        }

        initialSettings = await settings.json();
        if (!initialSettings.settings || !Array.isArray(initialSettings.channels) || !Array.isArray(initialSettings.roles)) throw new Error('Invalid settings');
        verifiedServerList = data;
        for (const link of document.querySelectorAll('.manage-sidebar [data-panel]')) {
            link.href = `/manage/${managedServerId}/${link.dataset.panel}`;
        }
        settingsIdentity.hidden = false;
        settingsMenu.hidden = false;
        settingsLoading.hidden = true;
        settingsPanel.hidden = false;
        return { authenticated: true };
    } catch {
        showServerListError();
        return { authenticated: false };
    }
}

async function fetchServersWithRetry() {
    return verifiedServerList;
}

function showServerListError() {
    settingsMessage('Server settings could not be loaded. Please reload this page.');
}

settingsMenu.addEventListener('click', () => {
    const open = settingsMenu.getAttribute('aria-expanded') !== 'true';
    settingsMenu.setAttribute('aria-expanded', String(open));
    settingsSidebarBody.toggleAttribute('data-open', open);
});

document.querySelector('.manage-sidebar').addEventListener('keydown', event => {
    if (event.key === 'Escape' && settingsSidebarBody.hasAttribute('data-open')) {
        settingsSidebarBody.removeAttribute('data-open');
        settingsMenu.setAttribute('aria-expanded', 'false');
        settingsMenu.focus();
    }
});

window.matchMedia('(max-width: 740px)').addEventListener('change', () => {
    settingsSidebarBody.removeAttribute('data-open');
    settingsMenu.setAttribute('aria-expanded', 'false');
});
