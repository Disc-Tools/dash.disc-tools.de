const accountContent = document.getElementById('account-content');
const accountStatus = document.getElementById('account-status');
const accountRoute = window.location.pathname.replace(/\/$/, '');
const accountDate = value => {
    if (!value) return '–';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString(document.documentElement.lang) : '–';
};
let accountUser;

async function accountRequest(path, method = 'GET', body) {
    const response = await fetch(new URL(path, dashboardOrigin), {
        method, credentials: 'include', cache: 'no-store',
        headers: body ? {'Content-Type': 'application/json'} : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || 'Request failed. Please try again.');
    return data;
}

function accountText(id, text) {
    document.getElementById(id).textContent = text;
}

async function accountAction(button, statusId, action) {
    if (button.disabled) return;
    button.disabled = true;
    accountText(statusId, 'Working…');
    try { await action(); }
    catch (error) { accountText(statusId, error.message); }
    finally { button.disabled = false; }
}

async function loadAccountOverview() {
    accountText('account-display', accountUser.global_name || accountUser.username);
    accountText('account-username', '@' + accountUser.username);
    accountText('account-id', accountUser.id);
    accountText('account-email', accountUser.email || 'Not available');
    accountText('account-created', accountDate(Number((BigInt(accountUser.id) >> 22n) + 1420070400000n)));
    await Promise.allSettled([
        accountRequest('/api/premium/status/' + accountUser.id).then(data =>
            accountText('account-premium', data.premium ? 'Active' : 'Inactive')
        ).catch(() => accountText('account-premium', 'Could not load')),
        accountRequest('/api/servers').then(data => {
            if (!Array.isArray(data.botServers)) throw new Error('Unavailable');
            accountText('account-servers', data.botServers.length.toLocaleString());
        }).catch(() => accountText('account-servers', 'Could not load')),
        accountRequest('/api/profile/guild-membership').then(data =>
            accountText('account-community', data.joined ? accountDate(data.joined_at) : 'Not joined')
        ).catch(() => accountText('account-community', 'Could not load'))
    ]);
}

async function loadAccountSettings() {
    const [preferences, gdpr] = await Promise.all([
        accountRequest('/api/settings'), accountRequest('/api/gdpr/request')
    ]);
    const form = document.getElementById('privacy-form');
    form.elements.username_history.checked = !preferences.username_history_optout;
    form.elements.alt_visibility.checked = preferences.alt_visibility;
    form.addEventListener('submit', event => {
        event.preventDefault();
        accountAction(form.querySelector('button'), 'privacy-status', async () => {
            await accountRequest('/api/settings', 'POST', {
                username_history_optout: !form.elements.username_history.checked,
                alt_visibility: form.elements.alt_visibility.checked
            });
            accountText('privacy-status', 'Preferences saved.');
        });
    });
    const dataForm = document.getElementById('data-form');
    const destination = gdpr.gdpr_email || gdpr.discord_email;
    accountText('data-destination', destination ? 'Send to ' + destination + ', or enter another email below.' : 'Enter an email address to receive your data.');
    const email = document.getElementById('data-email');
    email.required = !destination;
    const requestButton = dataForm.querySelector('button');
    if (!gdpr.can_request) {
        requestButton.disabled = true;
        accountText('data-status', 'Next request available ' + accountDate(gdpr.next_allowed_at));
    }
    dataForm.addEventListener('submit', event => {
        event.preventDefault();
        accountAction(requestButton, 'data-status', async () => {
            const data = await accountRequest('/api/gdpr/request', 'POST', {email: email.value.trim() || undefined});
            accountText('data-status', 'Your data request was sent to ' + data.sent_to + '.');
            dataForm.dataset.sent = 'true';
        }).then(() => { if (dataForm.dataset.sent) requestButton.disabled = true; });
    });
}

function sessionDevice(userAgent) {
    const ua = userAgent || '';
    const browserPatterns = [
        [/Edg(?:A|iOS)?\/([\d.]+)/, 'Edge'],
        [/(?:OPR|Opera)\/([\d.]+)/, 'Opera'],
        [/(?:Firefox|FxiOS)\/([\d.]+)/, 'Firefox'],
        [/(?:Chrome|CriOS)\/([\d.]+)/, 'Chrome'],
        [/Version\/([\d.]+).*Safari/, 'Safari']
    ];
    let browser = 'Unknown';
    for (const [pattern, name] of browserPatterns) {
        const match = ua.match(pattern);
        if (match) {
            browser = name + ' ' + match[1].split('.')[0];
            break;
        }
    }
    const systems = [
        [/iPad/, 'iPadOS'], [/iPhone|iPod/, 'iOS'], [/Android/, 'Android'],
        [/Windows/, 'Windows'], [/Macintosh|Mac OS X/, 'macOS'], [/Linux/, 'Linux']
    ];
    const system = systems.find(([pattern]) => pattern.test(ua))?.[1] || 'Unknown';
    let device = /iPad|Tablet/.test(ua) ? 'Tablet' : /Mobile|iPhone|iPod|Android/.test(ua) ? 'Mobile' : 'Desktop';
    if (ua === 'dashboard') device = 'Dashboard';
    if (!ua || system === 'Unknown') device = ua === 'dashboard' ? 'Dashboard' : 'Unknown device';
    return {device, system, browser};
}

function accountDateCell(row, value) {
    const cell = row.insertCell();
    cell.className = 'account-date-cell';
    const date = new Date(value);
    if (!value || !Number.isFinite(date.getTime())) {
        cell.textContent = '–';
        return cell;
    }
    const time = document.createElement('time');
    time.dateTime = date.toISOString();
    const day = document.createElement('span');
    day.textContent = date.toLocaleDateString(document.documentElement.lang, {year:'numeric', month:'short', day:'numeric'});
    const clock = document.createElement('small');
    clock.textContent = date.toLocaleTimeString(document.documentElement.lang, {hour:'2-digit', minute:'2-digit'});
    time.append(day, clock);
    cell.append(time);
    return cell;
}

function accountStatusBadge(text, status) {
    const badge = document.createElement('span');
    badge.className = 'account-status-badge account-status-' + status;
    badge.textContent = text;
    return badge;
}

async function loadAccountSessions() {
    const data = await accountRequest('/api/sessions');
    if (!Array.isArray(data.sessions)) throw new Error('Invalid session list');
    const body = document.getElementById('account-sessions');
    body.replaceChildren();
    accountText('session-status', data.sessions.length ? '' : 'No active sessions.');
    for (const session of data.sessions) {
        const row = body.insertRow();
        const ua = session.user_agent || 'Unknown device';
        const current = ua === navigator.userAgent;
        const details = sessionDevice(session.user_agent);
        const deviceCell = row.insertCell();
        deviceCell.textContent = details.device;
        deviceCell.title = ua;
        if (current) deviceCell.append(accountStatusBadge('This device', 'active'));
        row.insertCell().textContent = details.system;
        row.insertCell().textContent = details.browser;
        accountDateCell(row, session.last_used || session.created_at);
        accountDateCell(row, session.created_at);
        const action = row.insertCell();
        if (!current) {
            const button = document.createElement('button');
            button.className = 'button button-outline';
            button.textContent = 'Revoke';
            button.addEventListener('click', () => accountAction(button, 'session-status', async () => {
                await accountRequest('/api/sessions/' + encodeURIComponent(session.id), 'DELETE');
                await loadAccountSessions();
                accountText('session-status', 'Session revoked.');
            }));
            action.append(button);
        } else action.textContent = 'Current session';
    }
}

async function loadAccountBilling() {
    const data = await accountRequest('/api/premium/status/' + accountUser.id);
    accountText('billing-summary', data.premium ? 'Your Disc-Tools Premium membership is active.' : 'You do not currently have an active Premium membership.');
    const expiry = document.getElementById('billing-expiry');
    if (!expiry) return;
    expiry.textContent = data.expires_at ? 'Access until ' + accountDate(data.expires_at) : data.premium ? 'No expiry date recorded.' : '';
    if (!data.stripe_subscription_id) return;
    document.getElementById('billing-actions').hidden = false;
    document.getElementById('billing-portal').addEventListener('click', event =>
        accountAction(event.currentTarget, 'billing-status', async () => {
            const result = await accountRequest('/api/premium/create-portal-session', 'POST', {
                userId: accountUser.id, returnUrl: window.location.href
            });
            const url = new URL(result.url);
            if (url.protocol !== 'https:' || url.hostname !== 'billing.stripe.com') throw new Error('Invalid billing portal link.');
            window.location.assign(url.href);
        })
    );
    document.getElementById('billing-cancel').addEventListener('click', event => {
        if (!window.confirm('Cancel your subscription at the end of the current billing period?')) return;
        accountAction(event.currentTarget, 'billing-status', async () => {
            const result = await accountRequest('/api/premium/cancel-subscription', 'POST', {userId: accountUser.id});
            if (!result.success) throw new Error('Cancellation could not be confirmed.');
            accountText('billing-status', 'Cancellation scheduled. Access continues until the end of the paid period.');
            document.getElementById('billing-cancel').hidden = true;
        });
    });
}

async function loadAccountHistory() {
    const data = await accountRequest('/api/premium/history');
    if (!Array.isArray(data.history)) throw new Error('Invalid Premium history');
    const body = document.getElementById('account-history');
    for (const entry of data.history) {
        const row = body.insertRow();
        const status = entry.active ? 'active' : entry.upcoming ? 'upcoming' : 'expired';
        row.insertCell().append(accountStatusBadge(
            status === 'active' ? 'Active' : status === 'upcoming' ? 'Upcoming' : 'Expired', status
        ));
        const type = entry.type || 'Purchase';
        row.insertCell().textContent = type.charAt(0).toUpperCase() + type.slice(1);
        row.insertCell().textContent = entry.duration_label || '–';
        accountDateCell(row, entry.created_at);
        accountDateCell(row, entry.expires_at);
        row.insertCell().textContent = entry.gifter_name || entry.gifted_by || '–';
    }
    accountText('history-status', data.history.length ? '' : 'No Premium history yet.');
}

async function initializeAccount() {
    const auth = await accountRequest('/api/auth/me');
    if (!auth.authenticated || !auth.user) {
        accountStatus.textContent = 'Sign in with Discord to open your account.';
        const link = document.createElement('a');
        link.className = 'button button-primary';
        link.href = new URL('/api/auth/login?return=dashboard-my-servers', dashboardOrigin);
        link.textContent = 'Sign in with Discord';
        accountStatus.append(document.createElement('br'), link);
        return;
    }
    accountUser = auth.user;
    const identity = document.getElementById('account-identity');
    identity.querySelector('strong').textContent = accountUser.global_name || accountUser.username;
    identity.querySelector('small').textContent = '@' + accountUser.username;
    const avatar = identity.querySelector('img');
    avatar.src = accountUser.avatar
        ? `https://cdn.discordapp.com/avatars/${accountUser.id}/${accountUser.avatar}.webp?size=64`
        : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(accountUser.id) >> 22n) % 6n)}.png`;
    identity.hidden = false;
    document.getElementById('account-logout').hidden = false;

    if (accountRoute.endsWith('/settings')) await loadAccountSettings();
    else if (accountRoute.endsWith('/sessions')) await loadAccountSessions();
    else if (accountRoute.endsWith('/premium-history')) await loadAccountHistory();
    else if (accountRoute.includes('/billing')) await loadAccountBilling();
    else await loadAccountOverview();
    accountStatus.hidden = true;
    accountContent.hidden = false;
}

document.getElementById('account-logout').addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    try {
        const result = await accountRequest('/api/auth/logout', 'POST');
        if (!result.success) throw new Error('Logout failed');
        window.location.replace('/success/logout/');
    } catch {
        accountStatus.hidden = false;
        accountStatus.textContent = 'Could not sign out. Please try again.';
        event.currentTarget.disabled = false;
    }
});

const accountMenu = document.querySelector('.manage-sidebar-toggle');
const accountNav = document.getElementById('account-nav');
accountMenu.addEventListener('click', () => {
    const open = accountMenu.getAttribute('aria-expanded') !== 'true';
    accountMenu.setAttribute('aria-expanded', String(open));
    accountNav.toggleAttribute('data-open', open);
});
document.querySelector('.manage-sidebar').addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        accountNav.removeAttribute('data-open');
        accountMenu.setAttribute('aria-expanded', 'false');
        accountMenu.focus();
    }
});
initializeAccount().catch(error => {
    accountStatus.textContent = 'Your account could not be loaded. ' + error.message;
});
