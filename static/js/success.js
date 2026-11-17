const stateTitle = document.getElementById('state-title');
const stateMessage = document.getElementById('state-message');
const resultParams = new URLSearchParams(window.location.search);
const resultPage = window.location.pathname.replace(/\/$/, '');

async function updateResult() {
    if (resultPage === '/success/login') {
        if (resultParams.has('code')) {
            const callback = new URL('/api/auth/callback', dashboardOrigin);
            for (const key of ['code', 'state']) {
                if (resultParams.has(key)) callback.searchParams.set(key, resultParams.get(key));
            }
            window.location.replace(callback);
            return;
        }
        const response = await dashboardSession('/api/auth/me');
        if (!response.ok) throw new Error('Session check failed');
        const session = await response.json();
        stateTitle.textContent = session.authenticated ? 'Signed in' : 'Sign in to continue';
        stateMessage.textContent = session.authenticated ? 'Your Discord session is active. You can open My servers.' : 'Open Sign in with Discord to connect your account.';
    }
    if (resultPage === '/success/logout') {
        const response = await dashboardSession('/api/auth/logout', 'POST');
        if (!response.ok || !(await response.json()).success) throw new Error('Sign out failed');
        document.getElementById('dashboard-account').hidden = true;
        document.getElementById('dashboard-sign-in').hidden = false;
        stateTitle.textContent = 'Signed out';
        stateMessage.textContent = 'Your dashboard session has ended.';
    }
    if (resultPage === '/success/invite') {
        if (resultParams.has('code')) {
            if (window.location.origin !== dashboardOrigin) {
                const callback = new URL('/success/invite', dashboardOrigin);
                callback.search = resultParams;
                window.location.replace(callback);
                return;
            }
            const response = await fetch('/api/invite/bot/callback', {
                method: 'POST',
                credentials: 'include',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({code: resultParams.get('code')}),
                signal: AbortSignal.timeout(15000)
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error('Invitation could not be confirmed');
            window.history.replaceState({}, '', '/success/invite/');
            stateTitle.textContent = 'Disc-Tools is ready';
            stateMessage.textContent = data.guild?.name
                ? `Disc-Tools is installed on ${data.guild.name}. Open My servers to configure it.`
                : 'The invitation is complete. Open My servers to configure the bot.';
            return;
        }
        const guildId = resultParams.get('guild_id');
        const response = await dashboardSession('/api/servers');
        if (!response.ok) throw new Error('Invite check failed');
        const data = await response.json();
        const guild = data.botServers?.find(server => server.id === guildId);
        stateTitle.textContent = guild ? 'Disc-Tools is ready' : 'Check your server';
        stateMessage.textContent = guild ? `Disc-Tools is installed on ${guild.name}. Open My servers to configure it.` : 'Open My servers to check whether Disc-Tools has joined your server.';
    }
}
updateResult().catch(() => {
    stateTitle.textContent = 'Could not confirm this action';
    stateMessage.textContent = 'Please try again from the live dashboard or contact support.';
});
