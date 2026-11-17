# Contributing to Disc-Tools Dashboard

## Setup

Clone the repository and run a static preview.

```sh
python3 -m http.server 8080
```

Open http://localhost:8080/. The private API uses the production Discord session and requires the deployed origin. Test local UI work with isolated API fixtures.

## Page structure

Public pages contain their header and footer directly in HTML. Server management and account pages use a full-height sidebar. Shared behavior lives in static/js/dashboard-session.js, static/js/dashboard.js and the feature scripts.

Server management URLs map to templates in manage/. The production Nginx configuration supplies that mapping. The repository contains frontend files. Backend and server configuration are deployed separately.

## Editing

- Follow the formatting of the file being edited.
- Keep browser logic in static/js/ and styling in static/css/.
- Use the existing local fonts and Disc-Tools colors.
- Use textContent for untrusted text and validate URLs before navigation.
- Keep keyboard navigation, reduced-motion behavior and mobile layouts usable.
- Increment asset query versions when deployed files change.

## Checks

Run JavaScript syntax checks for edited scripts.

```sh
for file in static/js/*.js; do node --check "$file"; done
```

Check local asset paths and test the affected pages at desktop and mobile widths. For changes involving data, cover loading, empty, denied-access and error states with isolated fixtures. Document any real-account verification still pending.

Describe the user-visible change and the checks performed in the pull request. Report security issues through the process in SECURITY.md.

[Support Discord](https://discord.gg/rtRs8rhj5u)
