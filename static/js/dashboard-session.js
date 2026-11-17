const dashboardOrigin = 'https://dash.disc-tools.de';

function dashboardSession(path, method = 'GET') {
    return fetch(new URL(path, dashboardOrigin), {
        method,
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(8000)
    });
}

function discordBotInvite(guildId, clientId, permissions) {
    const url = new URL('https://discord.com/oauth2/authorize');
    url.search = new URLSearchParams({
        client_id: /^\d{17,20}$/.test(clientId) ? clientId : '1508899864602345582',
        scope: 'bot',
        permissions,
        guild_id: guildId,
        disable_guild_select: 'true'
    });
    return url;
}

// View Channel, Send Messages, Embed Links, and Manage Roles.
const requiredBotPermissions = String((1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 28n));
