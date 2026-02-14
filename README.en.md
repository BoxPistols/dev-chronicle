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

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict mode) |
| UI | React 19, Tailwind CSS 4 |
| Fonts | Noto Sans JP, Noto Serif JP (Google Fonts) |
| Testing | Vitest 4, React Testing Library |
| External APIs | GitHub REST API v3, Zenn API |
| AI | OpenAI API, Anthropic Messages API, Google Gemini API |

---

## Architecture

### Overview

```
Browser (React)
  |
  |-- InputForm.tsx    Input, state management, export logic
  |-- Newspaper.tsx    Newspaper layout rendering
  |
  v
Next.js API Routes (Server-side)
  |-- /api/github       GitHub REST API proxy
  |-- /api/zenn         Zenn API proxy
  |-- /api/ai-comment   AI commentary generation (multi-provider)
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

All three API routes are implemented as Next.js Route Handlers (App Router).

- `/api/github` -- Executes three requests to GitHub API in parallel via `Promise.all` (profile, events, repositories). If `GITHUB_TOKEN` is set, it attaches a Bearer token to increase rate limits.
- `/api/zenn` -- Fetches the latest articles from Zenn API, accepting a username as a query parameter.
- `/api/ai-comment` -- Dispatches to OpenAI, Anthropic, or Gemini based on the `provider` parameter. The system prompt assigns the role of "weekly tech newspaper AI editor" and includes instructions to distinguish content repositories from product development and to avoid speculation about external profile links.

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

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

---

## Usage

1. Enter a GitHub username and/or a Zenn username
2. Optionally enable AI commentary and select a provider and model
3. Click "Generate Newspaper"
4. Use the toolbar to switch themes, save as HTML, copy HTML, or print

---

## Embedding

Dev Chronicle reports can be embedded in external web pages via iframe. The `/embed` endpoint renders a report directly (without the input form) based on query parameters.

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `gh` | Either one | GitHub username |
| `zenn` | Either one | Zenn username |
| `dark` | Optional | Set to `1` for dark mode |

Both `gh` and `zenn` can be specified together, or either one alone.

### Examples

```html
<!-- GitHub + Zenn -->
<iframe
  src="https://your-domain.com/embed?gh=BoxPistols&zenn=aito"
  width="100%" height="800" style="border: none;">
</iframe>

<!-- GitHub only, dark mode -->
<iframe
  src="https://your-domain.com/embed?gh=BoxPistols&dark=1"
  width="100%" height="800" style="border: none;">
</iframe>

<!-- Zenn only -->
<iframe
  src="https://your-domain.com/embed?gh=&zenn=aito"
  width="100%" height="800" style="border: none;">
</iframe>
```

### Notes

- AI editorial commentary is not available in embed mode (use the main interface instead)
- Data is fetched at display time, so the initial load may take a few seconds
- The embedded report is responsive; `width="100%"` is recommended
- Adjust `height` based on content volume (800--1200px recommended)

---

## License

MIT
