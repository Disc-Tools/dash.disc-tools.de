(function() {
    var state = {
        auth: { authenticated: false },
        sort: 'new',
        polls: [],
        loaded: false
    };

    var listEl = document.getElementById('poll-list');
    var loginHint = document.getElementById('login-hint');

    function escHtml(s) {
        var d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function timeAgo(dateStr) {
        var diff = Date.now() - new Date(dateStr).getTime();
        var min = Math.floor(diff / 60000);
        if (min < 1) return 'just now';
        if (min < 60) return min + 'm ago';
        var h = Math.floor(min / 60);
        if (h < 24) return h + 'h ago';
        var d = Math.floor(h / 24);
        if (d < 30) return d + 'd ago';
        var mo = Math.floor(d / 30);
        if (mo < 12) return mo + 'mo ago';
        return Math.floor(mo / 12) + 'y ago';
    }

    function avatarHtml(userId, hash, name, cls) {
        var src = 'https://cdn.discordapp.com/embed/avatars/0.png';
        if (hash) {
            var ext = hash.indexOf('a_') === 0 ? 'gif' : 'png';
            src = 'https://cdn.discordapp.com/avatars/' + userId + '/' + hash + '.' + ext + '?size=64';
        }
        return '<img class="' + cls + '" src="' + src + '" alt="' + escHtml(name) + '" loading="lazy">';
    }

    function renderCreateArea() {
        loginHint.style.display = state.auth.authenticated ? 'none' : '';
    }

    function findPoll(id) {
        for (var i = 0; i < state.polls.length; i++) {
            if (state.polls[i].id === id) return state.polls[i];
        }
        return null;
    }

    function voteButtons(p) {
        return '<button class="vote-btn up' + (p.my_vote === 1 ? ' voted' : '') + '" data-vote="1" aria-label="Upvote"><i class="fa-solid fa-arrow-up"></i></button>'
            + '<span class="vote-score">' + p.score + '</span>'
            + '<button class="vote-btn down' + (p.my_vote === -1 ? ' voted' : '') + '" data-vote="-1" aria-label="Downvote"><i class="fa-solid fa-arrow-down"></i></button>';
    }

    function pollCardHtml(p) {
        return '<div class="poll-card" id="' + p.id + '" data-id="' + p.id + '">' +
                '<div class="poll-head">' +
                    avatarHtml(p.user_id, p.avatar, p.username, 'poll-avatar') +
                    '<span class="poll-author">' + escHtml(p.username) + '</span>' +
                    '<span class="poll-time">' + timeAgo(p.created_at) + '</span>' +
                '</div>' +
                '<div class="poll-question">' + escHtml(p.question) + '</div>' +
                (p.description ? '<div class="poll-description">' + escHtml(p.description) + '</div>' : '') +
                '<div class="poll-actions">' +
                    '<div class="vote-group">' + voteButtons(p) + '</div>' +
                    '<button class="comment-toggle"><i class="fa-regular fa-comment"></i> <span class="comment-count">' + p.comment_count + '</span></button>' +
                '</div>' +
                '<div class="comments-section"></div>' +
            '</div>';
    }

    function renderList() {
        if (!state.loaded) return;
        if (state.polls.length === 0) {
            listEl.innerHTML = '<div class="empty-state"><i class="fa-solid fa-square-poll-vertical"></i><p>No polls yet.<br>Be the first to start one!</p></div>';
            return;
        }
        var html = '';
        for (var i = 0; i < state.polls.length; i++) {
            html += pollCardHtml(state.polls[i]);
        }
        listEl.innerHTML = html;
    }

    async function handleVote(card, value) {
        if (!state.auth.authenticated) {
            window.location.href = '/api/auth/login';
            return;
        }
        var id = card.getAttribute('data-id');
        var p = findPoll(id);
        if (!p) return;

        var newValue = p.my_vote === value ? 0 : value;
        try {
            var res = await fetch('/api/polls/' + id + '/vote', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: newValue })
            });
            if (res.status === 401) { window.location.href = '/api/auth/login'; return; }
            if (!res.ok) return;
            var data = await res.json();
            p.score = data.score;
            p.my_vote = data.my_vote;
            var group = card.querySelector('.vote-group');
            group.innerHTML = voteButtons(p);
        } catch (e) {}
    }

    function commentHtml(c) {
        return '<div class="comment">' +
            avatarHtml(c.user_id, c.avatar, c.username, 'comment-avatar') +
            '<div class="comment-body">' +
                '<div class="comment-meta"><b>' + escHtml(c.username) + '</b> · ' + timeAgo(c.created_at) + '</div>' +
                '<div class="comment-content">' + escHtml(c.content) + '</div>' +
            '</div>' +
        '</div>';
    }

    async function loadComments(section, id) {
        section.innerHTML = '<div class="comments-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
        try {
            var res = await fetch('/api/polls/' + id + '/comments', { credentials: 'include' });
            var data = await res.json();
            var html = '';
            if (!data.comments || data.comments.length === 0) {
                html += '<div class="no-comments">No comments yet.</div>';
            } else {
                for (var i = 0; i < data.comments.length; i++) html += commentHtml(data.comments[i]);
            }
            if (state.auth.authenticated) {
                html += '<form class="comment-form">' +
                    '<textarea maxlength="500" placeholder="Write a comment…" required></textarea>' +
                    '<button type="submit" class="btn-primary" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>' +
                '</form>';
            }
            section.innerHTML = html;
            section.dataset.ids = (data.comments || []).map(function(c) { return c.id; }).join(',');

            var form = section.querySelector('.comment-form');
            if (form) {
                form.addEventListener('submit', async function(ev) {
                    ev.preventDefault();
                    var ta = form.querySelector('textarea');
                    var content = ta.value.trim();
                    if (!content) return;
                    var sendBtn = form.querySelector('button');
                    sendBtn.disabled = true;
                    try {
                        var r = await fetch('/api/polls/' + id + '/comments', {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: content })
                        });
                        if (r.status === 401) { window.location.href = '/api/auth/login'; return; }
                        var d = await r.json();
                        if (r.ok && d.comment) {
                            var noComments = section.querySelector('.no-comments');
                            if (noComments) noComments.remove();
                            section.insertAdjacentHTML('afterbegin', commentHtml(d.comment));
                            ta.value = '';
                            var p = findPoll(id);
                            if (p) {
                                p.comment_count++;
                                var card = section.closest('.poll-card');
                                var cnt = card.querySelector('.comment-count');
                                if (cnt) cnt.textContent = p.comment_count;
                            }
                        }
                    } catch (e) {} finally {
                        sendBtn.disabled = false;
                    }
                });
            }
        } catch (e) {
            section.innerHTML = '<div class="no-comments">Failed to load comments.</div>';
        }
    }

    var REFRESH_MS = 6000;
    var refreshTimer = null;

    function updateCardFromPoll(card, p) {
        var group = card.querySelector('.vote-group');
        if (group) group.innerHTML = voteButtons(p);
        var cnt = card.querySelector('.comment-count');
        if (cnt) cnt.textContent = p.comment_count;
    }

    async function appendNewComments(section, id) {
        try {
            var res = await fetch('/api/polls/' + id + '/comments', { credentials: 'include' });
            if (!res.ok) return;
            var data = await res.json();
            var comments = data.comments || [];
            var have = {};
            (section.dataset.ids || '').split(',').forEach(function(x) { if (x) have[x] = true; });
            var added = false;
            for (var i = 0; i < comments.length; i++) {
                if (have[comments[i].id]) continue;
                have[comments[i].id] = true;
                var form = section.querySelector('.comment-form');
                var html = commentHtml(comments[i]);
                if (form) form.insertAdjacentHTML('beforebegin', html);
                else section.insertAdjacentHTML('beforeend', html);
                added = true;
            }
            if (added) {
                var noComments = section.querySelector('.no-comments');
                if (noComments) noComments.remove();
                section.dataset.ids = Object.keys(have).join(',');
            }
        } catch (e) {}
    }

    async function refreshLive() {
        if (document.hidden || !state.loaded || document.activeElement && document.activeElement.closest && document.activeElement.closest('.comments-section, .poll-create')) return;
        try {
            var res = await fetch('/api/polls?sort=' + state.sort, { credentials: 'include' });
            if (!res.ok) return;
            var data = await res.json();
            var fresh = data.polls || [];
            var seen = {};
            for (var i = 0; i < fresh.length; i++) {
                var p = fresh[i];
                seen[p.id] = true;
                var existing = findPoll(p.id);
                if (existing) {
                    var votesChanged = existing.score !== p.score || existing.my_vote !== p.my_vote;
                    var commentsChanged = existing.comment_count !== p.comment_count;
                    existing.score = p.score;
                    existing.my_vote = p.my_vote;
                    existing.username = p.username;
                    existing.avatar = p.avatar;
                    if (votesChanged || commentsChanged || existing.question !== p.question || existing.description !== p.description) {
                        existing.question = p.question;
                        existing.description = p.description;
                        var card = document.getElementById(p.id);
                        if (card) {
                            updateCardFromPoll(card, existing);
                            var q = card.querySelector('.poll-question');
                            if (q) q.innerHTML = escHtml(existing.question);
                            var d = card.querySelector('.poll-description');
                            if (d && existing.description) d.innerHTML = escHtml(existing.description);
                        }
                    }
                    if (commentsChanged) {
                        var card2 = document.getElementById(p.id);
                        if (card2) {
                            var section = card2.querySelector('.comments-section');
                            if (section && section.classList.contains('open') && section.dataset.loaded) {
                                appendNewComments(section, p.id);
                            }
                        }
                    }
                } else {
                    state.polls.unshift(p);
                    var empty = listEl.querySelector('.empty-state');
                    if (empty) empty.remove();
                    listEl.insertAdjacentHTML('afterbegin', pollCardHtml(p));
                    var newCard = document.getElementById(p.id);
                    if (newCard) {
                        newCard.classList.add('fresh');
                        setTimeout(function(el) { return function() { el.classList.remove('fresh'); }; }(newCard), 500);
                    }
                }
            }
            for (var j = state.polls.length - 1; j >= 0; j--) {
                if (!seen[state.polls[j].id]) {
                    var el = document.getElementById(state.polls[j].id);
                    if (el) el.remove();
                    state.polls.splice(j, 1);
                    if (state.polls.length === 0) renderList();
                }
            }
        } catch (e) {}
    }

    function startLiveRefresh() {
        if (refreshTimer) return;
        refreshTimer = setInterval(refreshLive, REFRESH_MS);
    }

    listEl.addEventListener('click', function(ev) {
        var card = ev.target.closest('.poll-card');
        if (!card) return;
        var voteBtn = ev.target.closest('.vote-btn');
        if (voteBtn) return handleVote(card, Number(voteBtn.getAttribute('data-vote')));

        var toggle = ev.target.closest('.comment-toggle');
        if (toggle) {
            var section = card.querySelector('.comments-section');
            var open = section.classList.toggle('open');
            if (open && !section.dataset.loaded) {
                section.dataset.loaded = '1';
                loadComments(section, card.getAttribute('data-id'));
            }
        }
    });

    document.getElementById('sort-tabs').addEventListener('click', function(ev) {
        var tab = ev.target.closest('.sort-tab');
        if (!tab) return;
        var sort = tab.getAttribute('data-sort');
        if (sort === state.sort) return;
        state.sort = sort;
        this.querySelectorAll('.sort-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        loadPolls();
    });

    async function loadPolls() {
        try {
            var res = await fetch('/api/polls?sort=' + state.sort, { credentials: 'include' });
            var data = await res.json();
            state.polls = data.polls || [];
            state.loaded = true;
            renderList();
        } catch (e) {
            listEl.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Failed to load polls. Please try again later.</p></div>';
        }
    }

    checkAuth().then(function(auth) {
        state.auth = auth;
        var r = document.getElementById('header-right');
        if (r) updateHeader(auth, r);
        renderCreateArea();
        loadPolls().then(startLiveRefresh);
    });
})();
