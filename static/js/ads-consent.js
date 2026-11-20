(() => {
    const storageKey = 'disc-tools-dashboard-consent-v4';
    const publicPath = !/^\/(?:my-servers|manage|profile|verify|success)(?:\/|$)/.test(location.pathname);
    if (!publicPath) return;

    let consent;
    try {
        consent = JSON.parse(localStorage.getItem(storageKey));
    } catch {
        consent = null;
    }

    const panel = document.createElement('aside');
    panel.className = 'dashboard-consent';
    panel.setAttribute('aria-labelledby', 'dashboard-consent-title');
    panel.hidden = !!consent;
    panel.innerHTML = '<h2 id="dashboard-consent-title">Cookies, analytics &amp; advertising</h2>' +
        '<p>Essential storage keeps the dashboard working. With your permission, Umami measures visits and Google AdSense can show ads on public pages. Premium members do not see ads.</p>' +
        '<div class="dashboard-consent-actions"><button type="button" data-consent="all">Accept all</button><button type="button" data-consent="essential">Only essentials</button><button type="button" data-consent="select" aria-expanded="false">Select</button></div>' +
        '<div class="dashboard-consent-options" hidden><label><input type="checkbox" checked disabled> Essential storage (always active)</label><label><input type="checkbox" data-analytics-consent> Umami analytics</label><label><input type="checkbox" data-ad-consent> Google AdSense advertising</label><button type="button" data-consent="save">Save selection</button></div>' +
        '<a href="/legal/privacy-policy/">Privacy policy</a>';
    document.body.append(panel);

    const settings = document.createElement('button');
    settings.className = 'dashboard-cookie-settings';
    settings.type = 'button';
    settings.textContent = 'Cookie settings';
    const showSettings = () => { panel.hidden = false; };
    settings.addEventListener('click', showSettings);
    document.querySelector('#cookie-settings')?.addEventListener('click', showSettings);
    (document.querySelector('.site-footer') || document.body).append(settings);

    const options = panel.querySelector('.dashboard-consent-options');
    const adToggle = panel.querySelector('[data-ad-consent]');
    const analyticsToggle = panel.querySelector('[data-analytics-consent]');
    const slots = [...document.querySelectorAll('.ad-slot')];
    let adsLoaded = false;
    let analyticsLoaded = false;
    let adStatus = null;

    function startAnalytics() {
        if (!consent?.analytics || analyticsLoaded) return;
        analyticsLoaded = true;
        const script = document.createElement('script');
        script.defer = true;
        script.src = 'https://umami.disc-tools.de/script.js';
        script.dataset.websiteId = '71c24f0f-5dfe-41b7-a2ba-0585cba7946c';
        document.head.append(script);
    }

    async function isNonPremium() {
        if (adStatus !== null) return adStatus;
        try {
            const authResponse = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
            if (!authResponse.ok) return (adStatus = true);
            const auth = await authResponse.json();
            if (!auth?.user?.id) return (adStatus = true);
            const statusResponse = await fetch('/api/premium/status/' + encodeURIComponent(auth.user.id), { credentials: 'include', cache: 'no-store' });
            if (!statusResponse.ok) return (adStatus = false);
            adStatus = (await statusResponse.json()).premium !== true;
            return adStatus;
        } catch {
            return (adStatus = false);
        }
    }

    async function startAds() {
        if (!consent?.advertising || !slots.length || adsLoaded || !(await isNonPremium()) || !consent?.advertising) return;
        adsLoaded = true;
        const script = document.createElement('script');
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6223306610300371';
        script.addEventListener('load', () => {
            if (!consent?.advertising) return;
            for (const slot of slots) {
                slot.hidden = false;
                try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
                catch { slot.hidden = true; }
            }
        }, { once: true });
        document.head.append(script);
    }

    function save(nextConsent) {
        const revokeLoadedScript = (analyticsLoaded && !nextConsent.analytics) || (adsLoaded && !nextConsent.advertising);
        consent = { essential: true, analytics: nextConsent.analytics, advertising: nextConsent.advertising };
        try { localStorage.setItem(storageKey, JSON.stringify(consent)); }
        catch { /* The preference still applies for this page view. */ }
        panel.hidden = true;
        if (revokeLoadedScript) {
            location.reload();
            return;
        }
        startAnalytics();
        void startAds();
    }

    panel.addEventListener('click', event => {
        const button = event.target.closest('[data-consent]');
        if (!button) return;
        if (button.dataset.consent === 'select') {
            options.hidden = !options.hidden;
            button.setAttribute('aria-expanded', String(!options.hidden));
            adToggle.checked = consent?.advertising === true;
            analyticsToggle.checked = consent?.analytics === true;
        } else if (button.dataset.consent === 'save') {
            save({ analytics: analyticsToggle.checked, advertising: adToggle.checked });
        } else {
            const allow = button.dataset.consent === 'all';
            save({ analytics: allow, advertising: allow });
        }
    });

    document.querySelectorAll('.ad-slot').forEach(slot => { slot.hidden = true; });
    startAnalytics();
    void startAds();
})();
