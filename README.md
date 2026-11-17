# Disc-Tools Dashboard 2.0

The frontend for [dash.disc-tools.de](https://dash.disc-tools.de/), built with HTML, CSS and JavaScript. The Public Bot provides authentication, Discord data, server configuration and billing APIs.

## Pages

- Landing page with Public Bot commands and a server marquee.
- My servers with search, bot invitations and permission repair.
- Server management with member history, settings, verification, honeypot and bump reminders.
- Account overview, privacy controls, data requests and session management.
- Premium options, subscription management and membership history.
- Public statistics, invitation flow and shop preview.
- Server verification at /verify/<serverID>.
- Legal information, action result pages and shared HTTP error templates.

Premium purchases are currently paused. Existing memberships can be managed from the account pages. The shop is a preview.

## Structure

| Path | Purpose |
| --- | --- |
| index.html | Landing page |
| my-servers/ | Server selection |
| manage/ | Server management templates |
| profile/ | Account, privacy, sessions and billing |
| verify/ | Public server verification template |
| premium/ | Premium information and result page |
| stats/, invite/, shop/ | Public pages |
| legal/, refund-policy/ | Legal information |
| success/, blocked/ | Result and access restriction pages |
| _errors/ | Shared HTTP error templates |
| static/css/, static/js/ | Styles and browser code |
| static/assets/img/, static/fonts/ | Images and local fonts |
| emails/ | Existing email template |
| .github/ | Repository templates and CI |

The UI uses Inter and Space Grotesk with the Disc-Tools accent color. Font Awesome assets are retained for existing dynamic bot result pages.

## Local preview

No frontend build or dependency installation is needed.

```sh
python3 -m http.server 8080
```

Open http://localhost:8080/. Authentication and private API actions require the deployed dashboard origin and its Public Bot backend. Local preview shows the static layout.

Production routes such as /manage/<serverID>/overview and /verify/<serverID> map to shared HTML templates through Nginx. A basic local file server does not provide these dynamic routes.

The backend runs separately in Pterodactyl. The reference .env.example describes backend configuration. No credentials are required to preview static pages.

## Public Bot commands

/avatar, /banner, /username-history, /emoji, /invite-lookup, /server-lookup, /timestamp, /color, /quote, /gifify, /backup, /widget, /alt and /premium.

## Validation and releases

CI runs HTML and CSS checks and JavaScript syntax checks. CodeQL scans JavaScript and GitHub Actions. Browser checks cover desktop and mobile layouts and simulated API interactions. Real Discord authorization and billing changes need verification with real accounts.

[Latest release](https://github.com/Disc-Tools/dash.disc-tools.de/releases/latest) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [MIT license](LICENSE)

## AI assistance

Claude and ChatGPT supported the development of this dashboard.

[![Claude](https://img.shields.io/badge/Claude-Anthropic-D97757?style=flat-square)](https://claude.ai/) [![ChatGPT](https://img.shields.io/badge/ChatGPT-OpenAI-10A37F?style=flat-square)](https://chatgpt.com/)
