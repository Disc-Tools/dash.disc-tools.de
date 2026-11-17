const menuButton = document.querySelector('.menu-toggle');
const navigation = document.getElementById('navigation');
const mobileLayout = window.matchMedia('(max-width: 740px)');

function setMenuOpen(open) {
    navigation.hidden = mobileLayout.matches && !open;
    menuButton.setAttribute('aria-expanded', String(open));
}

function syncNavigation() {
    menuButton.hidden = !mobileLayout.matches;
    setMenuOpen(false);
}

menuButton.addEventListener('click', () => {
    setMenuOpen(menuButton.getAttribute('aria-expanded') === 'false');
});

navigation.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!mobileLayout.matches || !link) return;

    setMenuOpen(false);
    const target = link.getAttribute('href');
    if (target.startsWith('#')) {
        const section = document.getElementById(target.slice(1));
        const heading = document.getElementById(section.getAttribute('aria-labelledby'));
        heading.focus({ preventScroll: true });
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
        setMenuOpen(false);
        menuButton.focus();
    }
});

mobileLayout.addEventListener('change', syncNavigation);
syncNavigation();

const signIn = document.getElementById('dashboard-sign-in');
const account = document.getElementById('dashboard-account');
const accountSummary = account.querySelector('summary');
const accountName = account.querySelector('.account-name');
const accountAvatar = account.querySelector('.account-avatar');
const logout = document.getElementById('dashboard-logout');
const accountError = account.querySelector('.account-error');

async function loadDashboardAccount() {
    const response = await dashboardSession('/api/auth/me');
    if (!response.ok) return;

    const profile = await response.json();
    if (!profile.authenticated || !profile.user) return;
    const user = profile.user;
    accountName.textContent = user.global_name || user.username || 'Discord user';
    accountAvatar.src = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=64`
        : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
    signIn.hidden = true;
    account.hidden = false;
}

logout.addEventListener('click', async () => {
    logout.disabled = true;
    accountError.hidden = true;
    try {
        const response = await dashboardSession('/api/auth/logout', 'POST');
        if (!response.ok || !(await response.json()).success) throw new Error('Logout failed');
        account.open = false;
        account.hidden = true;
        signIn.hidden = false;
        signIn.focus();
        document.dispatchEvent(new Event('dashboard-logout'));
    } catch {
        accountError.textContent = 'Could not sign out. Try again in the dashboard.';
        accountError.hidden = false;
    } finally {
        logout.disabled = false;
    }
});

document.addEventListener('click', event => {
    if (!account.contains(event.target)) account.open = false;
});

account.addEventListener('keydown', event => {
    if (event.key === 'Escape' && account.open) {
        event.stopPropagation();
        account.open = false;
        accountSummary.focus();
    }
});

loadDashboardAccount().catch(() => {});
