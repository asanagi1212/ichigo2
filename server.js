import { createServer } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect as tlsConnect } from "node:tls";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
        rejectBody(new Error("请求内容过大"));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolveBody(body ? JSON.parse(body) : {});
      } catch {
        rejectBody(new Error("请求 JSON 格式不正确"));
      }
    });

    request.on("error", rejectBody);
  });
}

function buildEndpoint(clientSettings = {}) {
  const baseUrl = process.env.OPENAI_BASE_URL || clientSettings.baseUrl || "https://api.openai.com";
  const chatPath = process.env.OPENAI_CHAT_PATH || clientSettings.chatPath || "/v1/chat/completions";

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

function buildChatPayload({ messages = [], settings = {} }) {
  const model = process.env.OPENAI_MODEL || settings.model;
  const systemPrompt = settings.systemPrompt || process.env.SYSTEM_PROMPT;

  if (!model) {
    throw new Error("请在 .env 里设置 OPENAI_MODEL，或在前端模型设置里填写 Model。");
  }

  const apiMessages = [];

  if (systemPrompt) {
    apiMessages.push({ role: "system", content: systemPrompt });
  }

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

function extractReply(data) {
  return (
    data?.choices?.[0]?.message?.content ||
    data?.output_text ||
    data?.content?.[0]?.text ||
    ""
  );
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
      request.destroy(new Error("模型接口连接超时"));
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
      rejectRequest(new Error("当前代理实现仅支持 HTTPS 模型接口"));
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
        rejectRequest(new Error(`本地代理连接失败: ${connectResponse.statusCode}`));
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
        request.destroy(new Error("模型接口连接超时"));
      });
      request.on("error", rejectRequest);
      request.end(body);
    });

    connectRequest.on("timeout", () => {
      connectRequest.destroy(new Error("连接本地代理超时"));
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
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    sendJson(response, 500, {
      error: "后端没有配置 OPENAI_API_KEY。请复制 .env.example 为 .env，并填入你的模型 API Key。"
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const endpoint = buildEndpoint(body.settings);
    const payload = buildChatPayload(body);

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

    const text = upstreamResponse.text;
    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (upstreamResponse.statusCode < 200 || upstreamResponse.statusCode >= 300) {
      sendJson(response, upstreamResponse.statusCode, {
        error: data?.error?.message || data?.message || text || "模型接口请求失败"
      });
      return;
    }

    sendJson(response, 200, {
      content: extractReply(data),
      raw: data
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.cause?.message || error.message || "后端代理出错"
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

  serveStatic(request, response);
}).listen(port, () => {
  console.log(`Pulse Chat API listening on http://localhost:${port}`);
  if (getProxyUrl()) {
    console.log(`Using proxy: ${getProxyUrl()}`);
  }
});
