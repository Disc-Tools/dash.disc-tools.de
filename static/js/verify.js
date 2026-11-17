const verifyId = window.location.pathname.match(/^\/verify\/(\d{17,20})\/?$/)?.[1];
const verifyStatus = document.getElementById('verify-status');
const verifyForm = document.getElementById('verify-form');
const verifyButton = document.getElementById('verify-button');
const verifyRetry = document.getElementById('verify-retry');
const verifyTerms = document.getElementById('verify-terms');
const verifyPrivacy = document.getElementById('verify-privacy');
let authorizationUrl;

function updateVerifyButton() {
    verifyButton.disabled = !authorizationUrl || !verifyTerms.checked || !verifyPrivacy.checked;
}

async function loadVerification() {
    verifyForm.hidden = true;
    verifyRetry.hidden = true;
    authorizationUrl = undefined;
    updateVerifyButton();
    if (!verifyId) {
        verifyStatus.textContent = 'Open the verification link posted by Disc-Tools in your Discord server.';
        return;
    }

    verifyStatus.textContent = 'Loading server details…';
    try {
        const response = await fetch(`/api/public-verification/${verifyId}`, {
            cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000)
        });
        if (response.status === 404) {
            verifyStatus.textContent = 'Verification is not enabled for this server, or the bot is no longer there. Ask a server administrator for help.';
            return;
        }
        if (!response.ok) throw new Error('Verification unavailable');
        const data = await response.json();
        const oauth = new URL(data.oauthUrl);
        if (oauth.origin !== 'https://discord.com' || oauth.pathname !== '/api/oauth2/authorize') throw new Error('Invalid authorization URL');
        authorizationUrl = oauth.href;
        document.getElementById('verify-name').textContent = data.name;
        document.title = `Verify · ${data.name} | Disc-Tools`;
        const icon = document.querySelector('.verify-icon');
        icon.textContent = [...data.name.trim()][0] || '•';
        if (data.iconUrl) {
            const image = document.createElement('img');
            image.alt = '';
            image.width = image.height = 48;
            image.addEventListener('load', () => icon.replaceChildren(image), {once: true});
            image.src = data.iconUrl;
        }
        document.getElementById('verify-server').hidden = false;
        verifyStatus.textContent = 'Confirm your Discord account to receive access to this server.';
        verifyForm.hidden = false;
        updateVerifyButton();
    } catch {
        verifyStatus.textContent = 'Server verification could not be loaded. Please try again.';
        verifyRetry.hidden = false;
    }
}

verifyTerms.addEventListener('change', updateVerifyButton);
verifyPrivacy.addEventListener('change', updateVerifyButton);
verifyRetry.addEventListener('click', loadVerification);
verifyForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!verifyForm.reportValidity() || verifyButton.disabled) return;
    // Get a fresh signed state so time spent reading this page cannot expire it.
    verifyButton.disabled = true;
    await loadVerification();
    if (authorizationUrl && verifyTerms.checked && verifyPrivacy.checked) window.location.assign(authorizationUrl);
});
loadVerification();
