import { createServer } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect as tlsConnect } from "node:tls";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 8787);

loadDotEnv();

function loadDotEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key) {
      process.env[key] = value;
    }
  }
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(data));
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 25 * 1024 * 1024) {
        rejectBody(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolveBody(body ? JSON.parse(body) : {});
      } catch {
        rejectBody(new Error("Request JSON is invalid."));
      }
    });

    request.on("error", rejectBody);
  });
}

function pickSetting(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function buildEndpoint(clientSettings = {}) {
  const baseUrl = pickSetting(clientSettings.baseUrl, process.env.OPENAI_BASE_URL, "https://api.openai.com");
  const chatPath = pickSetting(
    clientSettings.chatPath,
    process.env.OPENAI_CHAT_PATH,
    "/v1/chat/completions"
  );

  return new URL(chatPath, baseUrl).toString();
}

function buildMessageContent(message) {
  const parts = [];

  if (message.content?.trim()) {
    parts.push({ type: "text", text: message.content.trim() });
  }

  if (message.imageDataUrl) {
    parts.push({
      type: "image_url",
      image_url: {
        url: message.imageDataUrl
      }
    });
  }

  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1 && parts[0].type === "text") {
    return parts[0].text;
  }

  return parts;
}

function buildAppActionPrompt(appContext = {}) {
  const plants = Array.isArray(appContext.plants) ? appContext.plants : [];
  const moods = Array.isArray(appContext.allowedStatusMoods) ? appContext.allowedStatusMoods : [];
  const dailyNote = appContext.dailyNote || {};
  const statusProfile = appContext.statusProfile || {};

  const contextLines = [
    "你在一个陪伴感应用里，不止能聊天，也可以顺手帮用户更新页面内容。",
    "如果你需要触发页面动作，请在回复最后追加一段且只追加一段：",
    "<pulse-actions>{JSON}</pulse-actions>",
    "JSON 可包含以下键：",
    '1. "dailyNote": {"content":"新的小纸条内容","signature":"落款"}',
    '2. "waterPlant": {"id":"植物id"} 或 {"name":"植物名字"}',
    '3. "createStatus": {"content":"状态内容","mood":"晴朗"}',
    "可以同时组合多个键，不需要的键不要输出。",
    "标签外仍然正常用中文和用户说话，不要解释标签本身。",
    `可用状态 mood 只有：${moods.join("、") || "晴朗、想念、轻松、心动"}。`
  ];

  if (dailyNote.content) {
    contextLines.push(`当前今日小纸条：${dailyNote.content}`);
  }

  if (dailyNote.signature) {
    contextLines.push(`当前小纸条落款：${dailyNote.signature}`);
  }

  if (plants.length > 0) {
    contextLines.push(
      `当前植物：${plants
        .map((plant) => `${plant.name}(id:${plant.id}, 水分:${Math.round(Number(plant.waterLevel || 0) * 100)}%)`)
        .join("；")}`
    );
  }

  if (statusProfile.name && statusProfile.handle) {
    contextLines.push(`状态页发帖身份：${statusProfile.name} / @${statusProfile.handle}`);
  }

  return contextLines.join("\n");
}

function buildChatPayload({ messages = [], settings = {}, appContext = {} }) {
  const model = pickSetting(settings.model, process.env.OPENAI_MODEL);
  const systemPrompt = pickSetting(settings.systemPrompt, process.env.SYSTEM_PROMPT);

  if (!model) {
    throw new Error("No model is configured. Enter one in the app settings or set OPENAI_MODEL on the server.");
  }

  const apiMessages = [];

  if (systemPrompt) {
    apiMessages.push({ role: "system", content: systemPrompt });
  }

  apiMessages.push({
    role: "system",
    content: buildAppActionPrompt(appContext)
  });

  for (const message of messages) {
    if (message.pending || !["user", "assistant"].includes(message.role)) {
      continue;
    }

    apiMessages.push({
      role: message.role,
      content: buildMessageContent(message)
    });
  }

  return {
    model,
    messages: apiMessages
  };
}

function extractAssistantActions(text) {
  if (typeof text !== "string") {
    return { content: "", actions: null };
  }

  const match = text.match(/<pulse-actions>\s*([\s\S]*?)\s*<\/pulse-actions>/i);

  if (!match) {
    return { content: text.trim(), actions: null };
  }

  let actions = null;

  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      actions = parsed;
    }
  } catch {
    actions = null;
  }

  const content = text.replace(match[0], "").trim();
  return { content, actions };
}

function normalizeReplyText(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeReplyText(item))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  if (typeof value.text === "string") {
    return value.text.trim();
  }

  if (typeof value.content === "string") {
    return value.content.trim();
  }

  if (Array.isArray(value.parts)) {
    return normalizeReplyText(value.parts);
  }

  if (Array.isArray(value.content)) {
    return normalizeReplyText(value.content);
  }

  return "";
}

function extractReply(data) {
  return (
    normalizeReplyText(data?.choices?.[0]?.message?.content) ||
    normalizeReplyText(data?.choices?.[0]?.delta?.content) ||
    normalizeReplyText(data?.choices?.[0]?.text) ||
    normalizeReplyText(data?.output_text) ||
    normalizeReplyText(data?.content) ||
    normalizeReplyText(data?.candidates?.[0]?.content?.parts) ||
    normalizeReplyText(data?.candidates?.[0]?.content) ||
    normalizeReplyText(data?.message?.content) ||
    ""
  );
}

function formatUpstreamError(data, text, settings = {}) {
  const message = data?.error?.message || data?.message || text || "Upstream model request failed.";
  const configuredModel = pickSetting(settings.model, process.env.OPENAI_MODEL);
  const normalized = String(message).toLowerCase();
  const looksLikeModelAccessIssue =
    normalized.includes("no access to model") ||
    normalized.includes("model_not_found") ||
    normalized.includes("does not exist") ||
    normalized.includes("invalid model") ||
    normalized.includes("unsupported model");

  if (!looksLikeModelAccessIssue || !configuredModel) {
    return message;
  }

  return `${message} Current model: ${configuredModel}. Update the Model field in settings to a model your token can use.`;
}

function parseUpstreamJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function sendUpstreamRequest({ endpoint, apiKey, payload }) {
  const upstreamResponse = await requestModel(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      }
    },
    JSON.stringify(payload)
  );

  return {
    statusCode: upstreamResponse.statusCode,
    text: upstreamResponse.text,
    data: parseUpstreamJson(upstreamResponse.text)
  };
}

function buildModelTestPayload(settings = {}) {
  const model = pickSetting(settings.model, process.env.OPENAI_MODEL);
  const systemPrompt = pickSetting(settings.systemPrompt, process.env.SYSTEM_PROMPT);

  if (!model) {
    throw new Error("No model is configured. Enter one in the app settings or set OPENAI_MODEL on the server.");
  }

  const messages = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  messages.push({ role: "user", content: "Reply with OK only." });

  return {
    model,
    messages,
    max_tokens: 8,
    temperature: 0
  };
}
function getProxyUrl() {
  return (
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy ||
    ""
  );
}

function requestDirect(url, options, body) {
  return new Promise((resolveRequest, rejectRequest) => {
    const endpoint = new URL(url);
    const requester = endpoint.protocol === "https:" ? httpsRequest : httpRequest;

    const request = requester(
      {
        method: options.method || "GET",
        hostname: endpoint.hostname,
        port: endpoint.port || (endpoint.protocol === "https:" ? 443 : 80),
        path: `${endpoint.pathname}${endpoint.search}`,
        headers: options.headers,
        timeout: 30000
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () => {
          resolveRequest({ statusCode: response.statusCode || 0, text });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Model request timed out."));
    });
    request.on("error", rejectRequest);
    request.end(body);
  });
}

function requestViaHttpProxy(url, options, body, proxyUrl) {
  return new Promise((resolveRequest, rejectRequest) => {
    const endpoint = new URL(url);
    const proxy = new URL(proxyUrl);
    const targetPort = endpoint.port || (endpoint.protocol === "https:" ? 443 : 80);

    if (endpoint.protocol !== "https:") {
      rejectRequest(new Error("The built-in proxy flow only supports HTTPS upstream endpoints."));
      return;
    }

    const connectRequest = httpRequest({
      method: "CONNECT",
      hostname: proxy.hostname,
      port: proxy.port || 7897,
      path: `${endpoint.hostname}:${targetPort}`,
      timeout: 30000
    });

    connectRequest.on("connect", (connectResponse, socket) => {
      if ((connectResponse.statusCode || 0) >= 400) {
        socket.destroy();
        rejectRequest(new Error(`Local proxy connection failed with status ${connectResponse.statusCode}.`));
        return;
      }

      const tlsSocket = tlsConnect({
        socket,
        servername: endpoint.hostname
      });

      const request = httpsRequest(
        {
          method: options.method || "GET",
          host: endpoint.hostname,
          path: `${endpoint.pathname}${endpoint.search}`,
          headers: options.headers,
          createConnection: () => tlsSocket,
          timeout: 30000
        },
        (response) => {
          let text = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            text += chunk;
          });
          response.on("end", () => {
            resolveRequest({ statusCode: response.statusCode || 0, text });
          });
        }
      );

      request.on("timeout", () => {
        request.destroy(new Error("Model request timed out."));
      });
      request.on("error", rejectRequest);
      request.end(body);
    });

    connectRequest.on("timeout", () => {
      connectRequest.destroy(new Error("Connecting to the local proxy timed out."));
    });
    connectRequest.on("error", rejectRequest);
    connectRequest.end();
  });
}

async function requestModel(url, options, body) {
  const proxyUrl = getProxyUrl();

  if (proxyUrl) {
    return requestViaHttpProxy(url, options, body, proxyUrl);
  }

  return requestDirect(url, options, body);
}

async function handleChat(request, response) {
  try {
    const body = await readJsonBody(request);
    const apiKey = pickSetting(body.settings?.apiKey, process.env.OPENAI_API_KEY);

    if (!apiKey) {
      sendJson(response, 500, {
        error: "No API key is configured. Enter one in the phone settings or set OPENAI_API_KEY on the server."
      });
      return;
    }

    const endpoint = buildEndpoint(body.settings);
    const payload = buildChatPayload(body);
    const upstream = await sendUpstreamRequest({ endpoint, apiKey, payload });

    if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
      sendJson(response, upstream.statusCode, {
        error: formatUpstreamError(upstream.data, upstream.text, body.settings)
      });
      return;
    }

    const reply = extractReply(upstream.data);

    if (!reply) {
      sendJson(response, 502, {
        error: "The model request succeeded, but the upstream response did not contain readable assistant text."
      });
      return;
    }

    const parsedReply = extractAssistantActions(reply);

    sendJson(response, 200, {
      content: parsedReply.content || "我已经帮你处理好了。",
      actions: parsedReply.actions,
      raw: upstream.data
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.cause?.message || error.message || "Backend proxy request failed."
    });
  }
}

async function handleModelTest(request, response) {
  try {
    const body = await readJsonBody(request);
    const apiKey = pickSetting(body.settings?.apiKey, process.env.OPENAI_API_KEY);

    if (!apiKey) {
      sendJson(response, 500, {
        error: "No API key is configured. Enter one in the phone settings or set OPENAI_API_KEY on the server."
      });
      return;
    }

    const endpoint = buildEndpoint(body.settings);
    const payload = buildModelTestPayload(body.settings);
    const upstream = await sendUpstreamRequest({ endpoint, apiKey, payload });

    if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
      sendJson(response, upstream.statusCode, {
        ok: false,
        endpoint,
        model: payload.model,
        error: formatUpstreamError(upstream.data, upstream.text, body.settings)
      });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      endpoint,
      model: payload.model,
      content: extractReply(upstream.data) || "OK",
      raw: upstream.data
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.cause?.message || error.message || "Backend proxy request failed."
    });
  }
}

function serveStatic(request, response) {
  const distRoot = join(root, "dist");
  const requestPath = new URL(request.url, `http://${request.headers.host}`).pathname;
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = resolve(join(distRoot, safePath));
  const indexPath = join(distRoot, "index.html");

  if (!filePath.startsWith(resolve(distRoot))) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png"
  };

  const isAssetRequest = extname(filePath) !== "";
  const outputPath = existsSync(filePath) ? filePath : isAssetRequest ? null : indexPath;

  if (!outputPath || !existsSync(outputPath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const headers = {
    "Content-Type": contentTypes[extname(outputPath)] || "application/octet-stream"
  };

  if (requestPath === "/sw.js" || requestPath === "/manifest.webmanifest") {
    headers["Cache-Control"] = "no-cache";
  }

  response.writeHead(200, headers);
  response.end(readFileSync(outputPath));
}

createServer((request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.url?.startsWith("/api/chat") && request.method === "POST") {
    handleChat(request, response);
    return;
  }

  if (request.url?.startsWith("/api/test-model") && request.method === "POST") {
    handleModelTest(request, response);
    return;
  }

  serveStatic(request, response);
}).listen(port, () => {
  console.log(`Pulse Chat API listening on http://localhost:${port}`);
  if (getProxyUrl()) {
    console.log(`Using proxy: ${getProxyUrl()}`);
  }
});
