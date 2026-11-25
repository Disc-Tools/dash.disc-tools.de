function showPurchaseMessage(message, isError = false) {
    const status = document.getElementById('premium-purchase-status');
    status.textContent = message;
    status.dataset.error = String(isError);
    status.hidden = false;
}

async function getPurchaseUser() {
    const response = await dashboardSession('/api/auth/me');
    if (!response.ok) throw new Error('Could not verify your Discord account. Please try again.');
    const profile = await response.json();
    if (!profile.authenticated || !profile.user) {
        showPurchaseMessage('Sign in with Discord before starting a purchase.', true);
        document.getElementById('dashboard-sign-in')?.focus();
        return null;
    }
    return profile.user;
}

async function createCheckout(button, endpoint, payload) {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Opening secure checkout…';
    showPurchaseMessage('Connecting to secure Stripe checkout…');

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.url) {
            throw new Error(result.error || 'Could not start checkout. Please try again.');
        }
        window.location.assign(result.url);
    } catch (error) {
        showPurchaseMessage(error.message || 'Could not start checkout. Please try again.', true);
        button.disabled = false;
        button.textContent = originalText;
    }
}

async function startPurchase(button, endpoint, makePayload) {
    button.disabled = true;
    try {
        const user = await getPurchaseUser();
        if (!user) {
            button.disabled = false;
            return;
        }
        const extra = await makePayload(user);
        if (!extra) {
            button.disabled = false;
            return;
        }
        await createCheckout(button, endpoint, {
            userId: user.id,
            buyerId: user.id,
            successUrl: new URL('/premium/success', window.location.origin).href,
            cancelUrl: window.location.href,
            waiverAccepted: true,
            ...extra
        });
    } catch (error) {
        showPurchaseMessage(error.message || 'Could not start checkout. Please try again.', true);
        button.disabled = false;
    }
}

document.getElementById('premium-subscribe')?.addEventListener('click', event => {
    startPurchase(event.currentTarget, '/api/premium/create-checkout-session', async () => ({}));
});

document.getElementById('premium-one-time')?.addEventListener('click', event => {
    startPurchase(event.currentTarget, '/api/premium/create-one-time-session', async () => ({
        successUrl: new URL('/premium/success?onetime=1', window.location.origin).href
    }));
});

document.getElementById('premium-gift')?.addEventListener('click', event => {
    startPurchase(event.currentTarget, '/api/premium/create-gift-checkout-session', async user => {
        const recipientId = window.prompt('Enter the recipient’s Discord User ID (17–20 digits):');
        if (recipientId === null) return null;
        const id = recipientId.trim();
        if (!/^\d{17,20}$/.test(id)) throw new Error('Enter a valid Discord User ID (17–20 digits).');
        if (id === user.id) throw new Error('You cannot gift Premium to yourself. Choose another user.');

        const lookup = await fetch(`/api/premium/lookup-user/${encodeURIComponent(id)}`, {
            credentials: 'include',
            cache: 'no-store'
        });
        if (!lookup.ok) throw new Error('User not found. Check the Discord User ID and try again.');
        const recipient = await lookup.json();
        const name = recipient.globalName || recipient.username || id;
        if (!window.confirm(`Send one month of Premium to ${name} (${id})?`)) return null;
        return { recipientId: id, successUrl: new URL('/premium/success?gift=1', window.location.origin).href };
    });
});
