# Pulse Chat

An iOS-oriented React + Vite PWA chat frontend with a local backend proxy for OpenAI-compatible model APIs.

## Features

- Mobile-first chat UI for iOS PWA usage
- Mock mode for UI testing without API usage
- OpenAI-compatible backend proxy at `/api/chat`
- Image attachment preview before sending
- Local settings persistence
- Safe API key handling through `.env`
- Optional HTTP(S) proxy support for environments that need a local network proxy

## Project Structure

- `index.html`: Vite entry
- `src/main.jsx`: React entry
- `src/App.jsx`: Chat UI, settings dialogs, composer, image attachment flow
- `src/chat-client.js`: Frontend chat client
- `src/storage.js`: Local settings persistence
- `src/styles.css`: Main app styles
- `server.js`: Backend proxy for model requests
- `public/`: PWA manifest, service worker, and icons
- `start-dev.bat`: Starts backend proxy and Vite dev server on Windows
- `start-api.bat`: Starts only the backend proxy

## Setup

Install dependencies:

```powershell
npm install
```

Copy the environment template:

```powershell
copy .env.example .env
```

Edit `.env`:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com
OPENAI_CHAT_PATH=/v1/chat/completions
OPENAI_MODEL=gpt-4o-mini
SYSTEM_PROMPT=You are a concise and reliable assistant.
HTTPS_PROXY=http://127.0.0.1:7897
```

If you do not need a local proxy, remove `HTTPS_PROXY`.

## Development

Recommended on Windows:

```powershell
start-dev.bat
```

This starts:

- Frontend: `http://localhost:5173`
- Backend proxy: `http://localhost:8787`

Manual startup:

```powershell
npm run api
npm run dev
```

Run the two commands in separate terminals.

## Build

```powershell
npm run build
```

## Deploy As Mobile PWA

This project can be deployed as a single Node service:

1. Install dependencies with `npm install`
2. Build the frontend with `npm run build`
3. Start the production server with `npm start`

The server will:

- serve the built PWA from `dist/`
- expose the chat proxy at `/api/chat`
- keep the frontend and API on the same origin, which is ideal for mobile PWA deployment

Deployment notes:

- Use HTTPS in production. PWA installability and service workers require a secure origin.
- Recommended hosts: Railway, Render, Fly.io, or any Node host that supports environment variables.
- Set the same `.env` values in your hosting platform, especially `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_CHAT_PATH`, and `OPENAI_MODEL`.
- Build command: `npm run build`
- Start command: `npm start`

Phone testing:

- Local development: open `http://localhost:5173` on the same computer.
- Same-LAN device test: run `npm run build` and `npm start`, then open `http://<your-computer-ip>:8787` on your phone.
- For actual install to home screen and offline caching on a real phone, use an HTTPS deployment URL.

## Notes

- Do not commit `.env`; it is ignored by `.gitignore`.
- ChatGPT Plus does not include API quota. OpenAI API usage is billed separately.
- If requests to `api.openai.com` time out, set `HTTPS_PROXY` to your local proxy address or use another OpenAI-compatible provider.
