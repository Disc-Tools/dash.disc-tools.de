const inviteGuild = new URLSearchParams(window.location.search).get('guild_id');
if (/^\d{17,20}$/.test(inviteGuild || '')) {
    const invite = document.getElementById('invite-bot');
    const url = new URL(invite.href);
    url.searchParams.set('guild_id', inviteGuild);
    url.searchParams.set('disable_guild_select', 'true');
    invite.href = url;
}
