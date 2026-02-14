# Dev Chronicle

A web application that automatically generates newspaper-style weekly reports from GitHub and Zenn activity data.

[Japanese version (README.md)](README.md)

---

## Concept

A developer's day-to-day work tends to scatter across fragmented records -- commits, pull requests, published articles. Dev Chronicle aggregates these fragments into a single "weekly newspaper" format, providing a bird's-eye view of one's development activity.

**Design Intentions:**

- **Unified Activity View** -- Bring together GitHub coding activity and Zenn writing activity into a single report for a holistic perspective
- **The Newspaper Metaphor** -- By borrowing the structure of a newspaper (headlines, lead paragraphs, sidebar statistics), the report reads as a narrative rather than a raw data dump
- **AI as Third-Party Perspective** -- AI-generated editorial commentary surfaces trends and patterns in your activity that you might not notice on your own

---

## Key Features

### GitHub Activity Visualization

Displays profile information, recent commit history (grouped by repository), pull request activity (color-coded by status), and featured repositories in distinct sections. Content-oriented repositories (e.g., zenn-content) are automatically distinguished from product development repositories.

### Zenn Article Integration

Lists the latest articles alongside like counts, publication dates, and topics. Shown alongside GitHub activity, this gives a two-sided view of both code and writing output.

### AI Editor's Column

Choose from three AI providers -- OpenAI, Anthropic Claude, or Google Gemini -- to auto-generate editorial commentary in a "newspaper column" tone based on your activity data. Multiple models are available per provider.

### Themes and Export

Supports light/dark theme switching, HTML file download, clipboard copy, and browser printing. Exported HTML files include embedded fonts and styles, making them self-contained and viewable standalone.

---

## Tech Stack

| Category      | Technology                                            |
| ------------- | ----------------------------------------------------- |
| Framework     | Next.js 16 (App Router)                               |
| Language      | TypeScript 5 (strict mode)                            |
| UI            | React 19, Tailwind CSS 4                              |
| Fonts         | Noto Sans JP, Noto Serif JP (Google Fonts)            |
| Testing       | Vitest 4, React Testing Library                       |
| External APIs | GitHub REST API v3, Zenn API                          |
| AI            | OpenAI API, Anthropic Messages API, Google Gemini API |

---

## Architecture

### Overview

```
Browser (React)
  |
  |-- /           InputForm.tsx   Input, state management, export logic
  |-- /embed      EmbedPage.tsx   Parameter-driven auto display (for iframe)
  |-- shared      Newspaper.tsx   Newspaper layout rendering
  |
  v
Next.js API Routes (Server-side)
  |-- /api/github       GitHub REST API proxy
  |-- /api/zenn         Zenn API proxy
  |-- /api/ai-comment   AI commentary generation (multi-provider)
  |-- /api/card         SVG card generation (for GitHub README)
  |
  v
External APIs
  |-- GitHub API (profile / events / repositories)
  |-- Zenn API (article listing)
  |-- OpenAI / Anthropic / Gemini (text generation)
```

### Data Flow

1. The user enters a GitHub and/or Zenn username and triggers generation
2. `InputForm` issues parallel requests to the API routes
3. API routes act as proxies to external APIs, returning data with a 300-second cache
4. If AI commentary is enabled, a summary is constructed from the fetched data and sent to `/api/ai-comment`
5. Once all data is available, the `Newspaper` component renders the report

### Component Design

The application is built around two core components.

**InputForm** handles both the input view and the result view. It manages data fetching state, AI provider/model selection, theme switching, and all export operations (HTML generation, download, clipboard copy, printing). On result display, it switches to a view containing a toolbar and the Newspaper component.

**Newspaper** is a pure display component that transforms received data into a newspaper layout. It uses a two-column structure -- a main column for article sections and a sidebar for statistics -- and conditionally renders sections for the header, lead paragraph, commits, pull requests, repositories, Zenn articles, and AI commentary.

### Utility Layer

`lib/utils.ts` provides the following functions:

- `formatDate` / `shortDate` / `daysAgo` -- Date formatting in Japanese style and short formats
- `isContentRepo` / `sortByRelevance` -- Content repository detection and priority sorting
- `cleanBio` -- Strips URLs, social service labels, and separators from GitHub bios
- `prColor` -- Returns color codes for PR actions (merged/opened/closed)
- `groupPushEventsByRepo` -- Groups PushEvents by repository, aggregating commit counts and latest timestamps

### API Route Design

All four API routes are implemented as Next.js Route Handlers (App Router).

- `/api/github` -- Executes three requests to GitHub API in parallel via `Promise.all` (profile, events, repositories). If `GITHUB_TOKEN` is set, it attaches a Bearer token to increase rate limits.
- `/api/zenn` -- Fetches the latest articles from Zenn API, accepting a username as a query parameter.
- `/api/ai-comment` -- Dispatches to OpenAI, Anthropic, or Gemini based on the `provider` parameter. The system prompt assigns the role of "weekly tech newspaper AI editor" and includes instructions to distinguish content repositories from product development and to avoid speculation about external profile links.
- `/api/card` -- Generates an SVG image summarizing GitHub/Zenn activity. Fetches data from external APIs server-side and assembles an SVG string. Designed for image embedding in GitHub profile READMEs.

### Theme System

Uses Tailwind CSS 4's custom theme feature to define light/dark colors via CSS variables. Dark mode is implemented through `@custom-variant dark` with `.dark` class-based toggling. Theme transitions use CSS `transition` for smooth switching.

---

## Project Structure

```
src/
  app/
    api/
      github/route.ts       GitHub API wrapper
      zenn/route.ts          Zenn API wrapper
      ai-comment/route.ts    AI commentary generation endpoint
      card/route.ts          SVG card generation (for GitHub README)
    embed/
      layout.tsx             Embed layout
      page.tsx               Embed display page (for iframe embedding)
    layout.tsx               Root layout and metadata
    page.tsx                 Home page
    globals.css              Theme definitions and global styles
  components/
    InputForm.tsx            Input form, state management, export logic
    Newspaper.tsx            Newspaper layout rendering
  lib/
    utils.ts                 Date formatting, repo classification, data shaping utilities
  types/
    index.ts                 TypeScript type definitions (GitHub / Zenn / Newspaper)
  __tests__/
    setup.ts                 Test setup configuration
    utils.test.ts            Unit tests for utilities
```

---

## Setup

### Prerequisites

- Node.js 20 or later
- npm, yarn, pnpm, or bun

### Installation

```bash
git clone <repository-url>
cd dev-chronicle
npm install
```

### Environment Variables

Create `.env.local` and configure keys for the services you intend to use.

```
# For AI commentary generation (only the provider you use needs a key)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...

# Optional: increases GitHub API rate limits
GITHUB_TOKEN=ghp_...
```

If you don't use the AI commentary feature, no API keys are needed. GITHUB_TOKEN is optional but significantly increases rate limits (unauthenticated: 60 req/hr, authenticated: 5,000 req/hr).

### Running

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Commands

| Command              | Description              |
| -------------------- | ------------------------ |
| `npm run dev`        | Start development server |
| `npm run build`      | Production build         |
| `npm run start`      | Start production server  |
| `npm run test`       | Run tests                |
| `npm run test:watch` | Run tests in watch mode  |

---

## Usage

1. Enter a GitHub username and/or a Zenn username
2. Optionally enable AI commentary and select a provider and model
3. Click "Generate Newspaper"
4. Use the toolbar to switch themes, save as HTML, copy HTML, or print

---

## Embedding

Dev Chronicle reports can be embedded in external web pages. The `/embed` endpoint renders a report directly (without the input form) based on query parameters. Designed for use in portfolio sites, blogs, team dashboards, and internal tools.

### URL Format

```
/embed?gh={GitHub username}&zenn={Zenn username}&dark={0|1}
```

### Parameters

| Parameter | Required   | Type   | Description      |
| --------- | ---------- | ------ | ---------------- |
| `gh`      | Either one | string | GitHub username  |
| `zenn`    | Either one | string | Zenn username    |
| `dark`    | Optional   | `"1"`  | Enable dark mode |

Both `gh` and `zenn` can be specified together, or either one alone. If both are empty, an error message is displayed.

### iframe Embedding

The most common approach -- load the report inside an iframe on an external HTML page.

```html
<!-- GitHub + Zenn -->
<iframe
  src="https://your-domain.com/embed?gh=BoxPistols&zenn=aito"
  width="100%"
  height="800"
  style="border: none;"
>
</iframe>

<!-- GitHub only, dark mode -->
<iframe
  src="https://your-domain.com/embed?gh=BoxPistols&dark=1"
  width="100%"
  height="800"
  style="border: none;"
>
</iframe>

<!-- Zenn only -->
<iframe
  src="https://your-domain.com/embed?zenn=aito"
  width="100%"
  height="800"
  style="border: none;"
>
</iframe>
```

### Direct Link Usage

The embed URL can also be opened directly in a browser, serving as a shortcut to a specific user's report.

```
https://your-domain.com/embed?gh=BoxPistols&zenn=aito
```

### Responsive iframe

To auto-adjust iframe height on the embedding page, use a CSS aspect-ratio wrapper.

```html
<div style="position: relative; width: 100%; padding-top: 150%; overflow: hidden;">
  <iframe
    src="https://your-domain.com/embed?gh=BoxPistols"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
  >
  </iframe>
</div>
```

For fixed height, use values between `height="800"` and `height="1200"`. When displaying both GitHub and Zenn data, use a larger height.

### Use Cases

- **Portfolio site** -- Showcase development activity in newspaper format
- **Personal blog** -- Embed an activity report in a sidebar or dedicated page
- **Team dashboard** -- Display per-member activity reports in a grid
- **Internal tools** -- Automate periodic activity sharing

### Differences from Main Interface

| Feature       | Main (`/`)                | Embed (`/embed`)        |
| ------------- | ------------------------- | ----------------------- |
| Input form    | Yes                       | No (set via parameters) |
| Toolbar       | Yes (theme, export)       | No                      |
| AI commentary | Yes (provider selectable) | Not available           |
| Dark mode     | Button toggle             | `?dark=1` parameter     |
| Layout        | Standard padding          | Minimal padding         |

### Notes

- AI editorial commentary is not available in embed mode. Use the main interface if AI commentary is needed
- Data is fetched at display time, so the initial load may take a few seconds
- GitHub API rate limits (unauthenticated: 60 req/hr) may cause temporary failures under heavy traffic. Setting `GITHUB_TOKEN` is recommended
- iframe permission headers (`X-Frame-Options`, `Content-Security-Policy: frame-ancestors`) are applied only to the `/embed` path

---

## SVG Card (for GitHub Profile README)

The `/api/card` endpoint generates an SVG card image that can be embedded in a GitHub profile README. Since GitHub does not support iframes, this provides a way to display an activity summary as an image.

### URL Format

```
/api/card?gh={GitHub username}&zenn={Zenn username}&dark={0|1}
```

### Parameters

| Parameter | Required | Type   | Description                                 |
| --------- | -------- | ------ | ------------------------------------------- |
| `gh`      | Required | string | GitHub username                             |
| `zenn`    | Optional | string | Zenn username (adds Zenn stats to the card) |
| `dark`    | Optional | `"1"`  | Generate card in dark mode                  |

### Usage in GitHub Profile README

Add the following Markdown to your profile repository (`username/username`) README:

```markdown
![Dev Chronicle](https://your-domain.com/api/card?gh=BoxPistols&zenn=aito)
```

Dark mode:

```markdown
![Dev Chronicle](https://your-domain.com/api/card?gh=BoxPistols&zenn=aito&dark=1)
```

### Card Contents

- Username and display name
- Contribution count and heatmap (last 26 weeks)
- GitHub stats (commits, PRs, stars, public repos, followers)
- Top 5 languages
- Zenn stats (article count, likes) -- when `zenn` parameter is specified

### Technical Details

- Response format: SVG (`image/svg+xml`)
- Width: 420px, height: dynamic based on content
- 5-minute CDN cache (`Cache-Control: public, max-age=300`)
- Contribution data is only shown when `GITHUB_TOKEN` is configured
- Errors are returned as SVG images to prevent broken displays

### Embed vs SVG Card

|               | SVG Card (`/api/card`)  | Embed (`/embed`)        |
| ------------- | ----------------------- | ----------------------- |
| Use case      | GitHub README, Markdown | Web pages, iframes      |
| Format        | SVG image               | HTML (interactive)      |
| Detail level  | Summary (stats-focused) | Full report (newspaper) |
| AI commentary | No                      | No (use main interface) |
| Links         | No (image)              | Yes (clickable)         |

---

## License

MIT
