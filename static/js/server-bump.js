(function() {
    const fetch = manageSettingsFetch;
    var path = window.location.pathname;
    var match = path.match(/^\/manage\/(\d+)\/bump\/?$/);
    var serverId = match ? match[1] : null;
    document.getElementById('server-sidebar-id').textContent = serverId || '-';

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
    }

    function makeInviteUrl(clientId) {
        var params = new URLSearchParams({
            client_id: /^[0-9]{17,20}$/.test(String(clientId || '')) ? String(clientId) : '1508899864602345582',
            permissions: '8',
            scope: 'bot',
            guild_id: serverId || '',
            disable_guild_select: 'true'
        });
        return 'https://discord.com/oauth2/authorize?' + params.toString();
    }

    function showBotMissingPanel(serverName, serverIcon, clientId) {
        var inviteUrl = makeInviteUrl(clientId);
        document.getElementById('server-sidebar-name').textContent = serverName;
        document.getElementById('nav-overview').href = '/manage/' + serverId + '/overview';
        if (document.getElementById('nav-settings')) document.getElementById('nav-settings').href = '/manage/' + serverId + '/settings';
        if (document.getElementById('nav-verification')) document.getElementById('nav-verification').href = '/manage/' + serverId + '/verification';
        if (document.getElementById('nav-honeypot')) document.getElementById('nav-honeypot').href = '/manage/' + serverId + '/honeypot';
        if (document.getElementById('nav-bump')) document.getElementById('nav-bump').href = '/manage/' + serverId + '/bump';
        if (serverIcon) {
            var isAnimated = serverIcon.startsWith('a_');
            var base = 'https://cdn.discordapp.com/icons/' + serverId + '/' + serverIcon;
            document.getElementById('server-sidebar-icon').innerHTML = '<img src="' + escapeHtml(base) + '.' + (isAnimated ? 'gif' : 'png') + '" alt="' + escapeHtml(serverName) + '">';
        }
        var panel = document.querySelector('.profile-panel');
        if (panel) {
            panel.innerHTML = '<h2><i class="fa-solid fa-robot"></i> Server Management</h2>' +
                '<p class="profile-panel-sub">The bot does not have the required permissions on <strong>' + escapeHtml(serverName || 'this server') + '</strong>.</p>' +
                '<div class="settings-card" style="text-align:center;padding:24px;">' +
                '<p style="margin-bottom:16px;">Re-invite the bot with the required permissions.</p>' +
                '<a class="btn-discord" href="' + escapeHtml(inviteUrl) + '" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-discord"></i> Update Bot</a>' +
                '</div>' +
                '<p style="text-align:center;margin-top:16px;"><a href="/my-servers">← Back to My Servers</a></p>';
        }
    }

    var savedEnabled = false;
    var savedChannel = '';
    var bar = document.getElementById('unsaved-bar');
    var toastEl = null;
    var allChannels = [];
    var categorySel = null;
    var channelSel = null;
    var toggleEl = null;

    function showToast(text, className) {
        if (!toastEl) return;
        toastEl.textContent = text;
        toastEl.className = 'toast ' + (className || '');
        toastEl.removeAttribute('hidden');
        clearTimeout(toastEl._timeout);
        toastEl._timeout = setTimeout(function() { toastEl.hidden = true; }, 2500);
    }

    function populateChannels(categoryId) {
        channelSel.innerHTML = '<option value="">- None -</option>';
        var filtered = categoryId
            ? allChannels.filter(function(c) { return c.parentId === categoryId; })
            : allChannels;
        filtered.forEach(function(ch) {
            var opt = document.createElement('option');
            opt.value = ch.id;
            opt.textContent = '#' + ch.name;
            channelSel.appendChild(opt);
        });
    }

    function updateControlsState() {
        var on = toggleEl.checked;
        categorySel.disabled = !on;
        channelSel.disabled = !on;
    }

    function isDirty() {
        return toggleEl.checked !== savedEnabled || channelSel.value !== savedChannel;
    }

    function checkDirty() {
        bar.style.display = isDirty() ? 'flex' : 'none';
    }

    function discardChanges() {
        toggleEl.checked = savedEnabled;
        if (savedChannel) {
            var ch = allChannels.find(function(c) { return c.id === savedChannel; });
            categorySel.value = ch && ch.parentId ? ch.parentId : '';
        } else {
            categorySel.value = '';
        }
        populateChannels(categorySel.value);
        channelSel.value = savedChannel;
        updateControlsState();
        bar.style.display = 'none';
    }

    function loadSettings() {
        fetch('/api/guilds/' + serverId + '/settings', { credentials: 'include' })
            .then(function(r) {
                if (r.status === 403) {
                    window.location.replace('/manage/' + serverId + '/overview');
                    return null;
                }
                return r.json();
            })
            .then(function(data) {
                if (!data) return;
                toastEl = document.getElementById('toast');
                allChannels = data.channels || [];
                categorySel = document.getElementById('setting-bump-category');
                channelSel = document.getElementById('setting-bump-channel');
                toggleEl = document.getElementById('toggle-bump-enabled');

                (data.categories || []).forEach(function(c) {
                    var opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    categorySel.appendChild(opt);
                });

                var settings = data.settings || {};
                savedEnabled = !!settings.bump_reminder_enabled;
                savedChannel = settings.bump_channel || '';

                toggleEl.checked = savedEnabled;
                if (savedChannel) {
                    var ch = allChannels.find(function(c) { return c.id === savedChannel; });
                    categorySel.value = ch && ch.parentId ? ch.parentId : '';
                }
                populateChannels(categorySel.value);
                channelSel.value = savedChannel;
                updateControlsState();

                categorySel.addEventListener('change', function() {
                    populateChannels(categorySel.value);
                    channelSel.value = '';
                    checkDirty();
                });
                channelSel.addEventListener('change', checkDirty);
                toggleEl.addEventListener('change', function() {
                    updateControlsState();
                    checkDirty();
                });
            })
            .catch(function() {});
    }

    window.saveBumpSettings = function() {
        var btnBar = document.getElementById('btn-save-bar');
        if (toggleEl.checked && !channelSel.value) {
            showToast('Please select a bump channel.', 'error');
            return;
        }
        if (btnBar) btnBar.disabled = true;

        fetch('/api/guilds/' + serverId + '/settings', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bump_reminder_enabled: toggleEl.checked,
                bump_channel: channelSel.value || null
            })
        })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
        .then(function(res) {
            if (!res.ok || res.data.error) {
                showToast(res.data && res.data.error ? res.data.error : 'Failed to save', 'error');
                if (btnBar) btnBar.disabled = false;
                return;
            }
            showToast('Saved!', 'success');
            if (btnBar) btnBar.disabled = false;
            savedEnabled = !!res.data.bump_reminder_enabled;
            savedChannel = res.data.bump_channel || '';
            bar.style.display = 'none';
        })
        .catch(function() {
            showToast('Failed to save', 'error');
            if (btnBar) btnBar.disabled = false;
        });
    };

    document.getElementById('btn-discard').addEventListener('click', discardChanges);
    document.getElementById('btn-save-bar').addEventListener('click', function() { window.saveBumpSettings(); });

    window.addEventListener('beforeunload', function(e) {
        if (isDirty()) {
            bar.style.display = 'flex';
            bar.classList.add('shake');
            setTimeout(function() { bar.classList.remove('shake'); }, 400);
            e.preventDefault();
        }
    });

    document.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (!link || !isDirty()) return;
        var href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        if (href === window.location.pathname) return;
        e.preventDefault();
        bar.style.display = 'flex';
        bar.classList.add('shake');
        setTimeout(function() { bar.classList.remove('shake'); }, 400);
        if (confirm('You have unsaved changes. Leave anyway?')) {
            window.location.href = href;
        }
    });

    checkAuth().then(function(auth) {
        if (!auth.authenticated) return;

        fetchServersWithRetry(serverId)
            .then(function(data) {
                if (!data) return;
                var server = null;
                var botServers = data.botServers || [];
                for (var i = 0; i < botServers.length; i++) {
                    if (String(botServers[i].id) === serverId) { server = botServers[i]; break; }
                }
                if (!server) {
                    var otherServers = data.servers || [];
                    var foundSrv = null;
                    for (var j = 0; j < otherServers.length; j++) {
                        if (String(otherServers[j].id) === serverId) { foundSrv = otherServers[j]; break; }
                    }
                    if (foundSrv) {
                        showBotMissingPanel(foundSrv.name, foundSrv.icon, data.clientId);
                    } else {
                        window.location.replace('/my-servers/');
                    }
                    return;
                }
                if (server.missingPermissions) {
                    showBotMissingPanel(server.name, server.icon, data.clientId);
                    return;
                }
                document.getElementById('server-sidebar-name').textContent = server.name;
                document.getElementById('server-sub').textContent = 'Set up bump reminders for ' + server.name;
                document.querySelector('title').textContent = server.name + ' Bump Reminder – Disc-Tools';
                document.getElementById('nav-overview').href = '/manage/' + serverId + '/overview';
                document.getElementById('nav-settings').href = '/manage/' + serverId + '/settings';
                document.getElementById('nav-verification').href = '/manage/' + serverId + '/verification';
                var nh = document.getElementById('nav-honeypot');
                if (nh) nh.href = '/manage/' + serverId + '/honeypot';
                var nb = document.getElementById('nav-bump');
                if (nb) nb.href = '/manage/' + serverId + '/bump';

                if (server.icon) {
                    var isAnimated = server.icon.startsWith('a_');
                    var base = 'https://cdn.discordapp.com/icons/' + serverId + '/' + server.icon;
                    document.getElementById('server-sidebar-icon').innerHTML = '<img src="' + escapeHtml(base) + '.' + (isAnimated ? 'gif' : 'png') + '" alt="' + escapeHtml(server.name) + '">';
                }

                loadSettings();
            }).catch(showServerListError);
    });
})();
