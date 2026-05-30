import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { extname, join, resolve } from "node:path";
import { connect as tlsConnect } from "node:tls";
import { fileURLToPath } from "node:url";
import { buildServerSettingsPayload, defaults as defaultSettings, sanitizeSettings } from "./src/storage.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const ALLOWED_STATUS_MOODS = ["晴朗", "想念", "轻松", "心动"];

loadDotEnv();

const port = Number(process.env.PORT || 8787);

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
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
  const moods = Array.isArray(appContext.allowedStatusMoods)
    ? appContext.allowedStatusMoods
    : ALLOWED_STATUS_MOODS;
  const dailyNote = appContext.dailyNote || {};
  const statusProfile = appContext.statusProfile || {};
  const assistantStatusProfile = appContext.assistantStatusProfile || {};

  const contextLines = [
    "你在一个陪伴感应用里，不止能聊天，也可以顺手帮用户更新页面内容。",
    "如果你需要触发页面动作，请在回复最后追加且只追加一段：",
    "<pulse-actions>{JSON}</pulse-actions>",
    "JSON 可以包含以下键：",
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
        .join("，")}`
    );
  }

  if (statusProfile.name && statusProfile.handle) {
    contextLines.push(`用户状态页身份：${statusProfile.name} / @${statusProfile.handle}`);
  }

  if (assistantStatusProfile.name && assistantStatusProfile.handle) {
    contextLines.push(`当你触发 createStatus 时，会以助手身份发布：${assistantStatusProfile.name} / @${assistantStatusProfile.handle}`);
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

function createStatusPost({ content, mood, imageDataUrl = "", imageName = "", own = true }) {
  return {
    id: randomUUID(),
    author: own ? "right" : "left",
    own,
    mood,
    content,
    imageDataUrl,
    imageName,
    timestamp: new Date().toISOString(),
    likes: 0,
    comments: 0,
    commentsList: [],
    liked: false
  };
}

function buildStatusProfile(settings) {
  return {
    name: "早",
    handle: "asa",
    avatar: settings.statusAvatar || "早",
    image: settings.statusAvatarImage || "",
    note: settings.statusLittleUpdate || "little updates",
    bio: settings.statusSignature || "把喜欢、心情和每天的小碎片，慢慢留在这里。"
  };
}

function buildAssistantStatusProfile(settings) {
  return {
    name: settings.nestLeftName || settings.contactName || "阿橘",
    handle: "ai",
    avatar: settings.nestLeftAvatar || settings.contactAvatar || "AI",
    image: settings.nestLeftAvatarImage || settings.contactAvatarImage || "",
    note: "assistant updates",
    bio: "把想说的话和惦记，悄悄留在这里。"
  };
}

function buildAppContextFromSettings(settings) {
  return {
    dailyNote: {
      content:
        settings.nestDailyNote ||
        "今天也要好好吃饭、慢慢休息。\n忙的时候记得回来看看这里，我们把喜欢的日常一点点存起来。",
      signature: settings.nestDailySign || "来自你的小窝"
    },
    plants: Array.isArray(settings.nestPlants)
      ? settings.nestPlants.map((plant) => ({
          id: plant.id,
          name: plant.name,
          species: plant.species,
          waterLevel: plant.waterLevel,
          days: plant.days
        }))
      : [],
    statusProfile: buildStatusProfile(settings),
    assistantStatusProfile: buildAssistantStatusProfile(settings),
    allowedStatusMoods: ALLOWED_STATUS_MOODS
  };
}

function applyAssistantActionsToSettings(settings, actions) {
  if (!actions || typeof actions !== "object") {
    return sanitizeSettings(settings);
  }

  let nextSettings = sanitizeSettings(settings);

  if (actions.dailyNote && typeof actions.dailyNote === "object") {
    const nextContent =
      typeof actions.dailyNote.content === "string" && actions.dailyNote.content.trim()
        ? actions.dailyNote.content.trim()
        : nextSettings.nestDailyNote;
    const nextSignature =
      typeof actions.dailyNote.signature === "string" && actions.dailyNote.signature.trim()
        ? actions.dailyNote.signature.trim()
        : nextSettings.nestDailySign;

    nextSettings = sanitizeSettings({
      ...nextSettings,
      nestDailyNote: nextContent,
      nestDailySign: nextSignature
    });
  }

  if (actions.waterPlant && typeof actions.waterPlant === "object") {
    const targetName =
      typeof actions.waterPlant.name === "string" ? actions.waterPlant.name.trim() : "";
    const targetId = typeof actions.waterPlant.id === "string" ? actions.waterPlant.id.trim() : "";
    const targetIndex = (nextSettings.nestPlants || []).findIndex((plant) => {
      if (targetId && plant.id === targetId) {
        return true;
      }

      return targetName && plant.name === targetName;
    });

    if (targetIndex >= 0) {
      const nextPlants = nextSettings.nestPlants.map((plant, index) =>
        index !== targetIndex
          ? plant
          : {
              ...plant,
              days: Math.max(1, Number(plant.days || 1) + 1),
              waterLevel: Math.min(
                1,
                Math.round((Number(plant.waterLevel || 0.5) + 0.22) * 100) / 100
              )
            }
      );

      nextSettings = sanitizeSettings({
        ...nextSettings,
        nestPlants: nextPlants
      });
    }
  }

  if (actions.createStatus && typeof actions.createStatus === "object") {
    const nextContent =
      typeof actions.createStatus.content === "string" ? actions.createStatus.content.trim() : "";
    const nextMood = ALLOWED_STATUS_MOODS.includes(actions.createStatus.mood)
      ? actions.createStatus.mood
      : ALLOWED_STATUS_MOODS[0];

    if (nextContent) {
      const currentPosts = Array.isArray(nextSettings.statusPosts) ? nextSettings.statusPosts : [];

        nextSettings = sanitizeSettings({
          ...nextSettings,
          statusPosts: [
            createStatusPost({
              content: nextContent,
              mood: nextMood,
              own: false
            }),
            ...currentPosts
          ]
      });
    }
  }

  return nextSettings;
}

function getSupabaseConfig() {
  const url = pickSetting(process.env.SUPABASE_URL);
  const key = pickSetting(process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const userId = pickSetting(process.env.APP_STATE_USER_ID, "default");

  return {
    url,
    key,
    userId,
    enabled: Boolean(url && key)
  };
}

function hasSupabaseConfig() {
  return getSupabaseConfig().enabled;
}

function buildSupabaseRestUrl(path) {
  const { url } = getSupabaseConfig();
  return new URL(path, url).toString();
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value));
}

async function supabaseRequest(path, { method = "GET", body, headers = {} } = {}) {
  const config = getSupabaseConfig();

  if (!config.enabled) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  const requestBody = body === undefined ? undefined : JSON.stringify(body);
  const response = await requestModel(
    buildSupabaseRestUrl(path),
    {
      method,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        ...headers
      }
    },
    requestBody
  );

  const data = parseUpstreamJson(response.text);

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const errorMessage =
      data?.message ||
      data?.error_description ||
      data?.hint ||
      data?.details ||
      response.text ||
      `Supabase request failed with status ${response.statusCode}.`;

    throw new Error(errorMessage);
  }

  return data;
}

async function fetchStoredAppSettings() {
  const { userId } = getSupabaseConfig();
  const rows = await supabaseRequest(
    `/rest/v1/app_state?user_id=eq.${encodeFilterValue(userId)}&select=settings_json&limit=1`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return sanitizeSettings(defaultSettings);
  }

  return sanitizeSettings({
    ...defaultSettings,
    ...(rows[0]?.settings_json || {})
  });
}

async function upsertStoredAppSettings(settings) {
  const { userId } = getSupabaseConfig();
  const payload = [
    {
      user_id: userId,
      settings_json: buildServerSettingsPayload(settings),
      updated_at: new Date().toISOString()
    }
  ];

  await supabaseRequest("/rest/v1/app_state?on_conflict=user_id", {
    method: "POST",
    body: payload,
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal"
    }
  });
}

async function fetchStoredStatusPosts() {
  const { userId } = getSupabaseConfig();
  const rows = await supabaseRequest(
    `/rest/v1/status_posts?user_id=eq.${encodeFilterValue(
      userId
    )}&select=post_json&order=created_at.desc`
  );

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => row?.post_json)
    .filter((post) => post && typeof post === "object");
}

async function replaceStoredStatusPosts(posts = []) {
  const { userId } = getSupabaseConfig();

  await supabaseRequest(`/rest/v1/status_posts?user_id=eq.${encodeFilterValue(userId)}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal"
    }
  });

  if (!Array.isArray(posts) || posts.length === 0) {
    return;
  }

  const rows = posts.map((post) => ({
    id: post.id || randomUUID(),
    user_id: userId,
    mood: typeof post.mood === "string" ? post.mood : ALLOWED_STATUS_MOODS[0],
    content: typeof post.content === "string" ? post.content : "",
    created_at:
      typeof post.timestamp === "string" && post.timestamp.trim()
        ? post.timestamp
        : new Date().toISOString(),
    post_json: post
  }));

  await supabaseRequest("/rest/v1/status_posts", {
    method: "POST",
    body: rows,
    headers: {
      Prefer: "return=minimal"
    }
  });
}

async function loadMemories(limit = 20) {
  const { userId } = getSupabaseConfig();
  const rows = await supabaseRequest(
    `/rest/v1/memories?user_id=eq.${encodeFilterValue(
      userId
    )}&select=id,kind,content,importance,source,metadata,created_at,last_used_at&order=created_at.desc&limit=${Math.max(
      1,
      Math.min(100, Number(limit) || 20)
    )}`
  );

  return Array.isArray(rows) ? rows : [];
}

async function storeMemory(memory = {}) {
  const { userId } = getSupabaseConfig();
  const content = typeof memory.content === "string" ? memory.content.trim() : "";

  if (!content) {
    throw new Error("Memory content is required.");
  }

  const rows = await supabaseRequest("/rest/v1/memories", {
    method: "POST",
    body: [
      {
        user_id: userId,
        kind: pickSetting(memory.kind, "note"),
        content,
        importance: Math.max(1, Math.min(5, Number(memory.importance) || 1)),
        source: pickSetting(memory.source, "manual"),
        metadata: memory.metadata && typeof memory.metadata === "object" ? memory.metadata : {}
      }
    ],
    headers: {
      Prefer: "return=representation"
    }
  });

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function loadAppStateFromSupabase() {
  const settings = await fetchStoredAppSettings();
  const statusPosts = await fetchStoredStatusPosts();

  return sanitizeSettings({
    ...settings,
    statusPosts
  });
}

async function saveAppStateToSupabase(settings) {
  const sanitized = sanitizeSettings(settings);
  const statusPosts = Array.isArray(sanitized.statusPosts) ? sanitized.statusPosts : [];

  await upsertStoredAppSettings({
    ...sanitized,
    statusPosts
  });
  await replaceStoredStatusPosts(statusPosts);

  return loadAppStateFromSupabase();
}

async function applyAssistantActionsWithPersistence(actions, fallbackSettings = {}) {
  const baseSettings = hasSupabaseConfig()
    ? await loadAppStateFromSupabase()
    : sanitizeSettings(fallbackSettings);
  const nextSettings = applyAssistantActionsToSettings(baseSettings, actions);

  if (!hasSupabaseConfig()) {
    return nextSettings;
  }

  return saveAppStateToSupabase(nextSettings);
}

async function handleGetAppState(response) {
  if (!hasSupabaseConfig()) {
    sendJson(response, 503, {
      error:
        "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) first."
    });
    return;
  }

  try {
    const [settings, memories] = await Promise.all([
      loadAppStateFromSupabase(),
      loadMemories(20)
    ]);

    sendJson(response, 200, {
      settings,
      memories
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Failed to load app state."
    });
  }
}

async function handlePutAppState(request, response) {
  if (!hasSupabaseConfig()) {
    sendJson(response, 503, {
      error:
        "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) first."
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const savedSettings = await saveAppStateToSupabase(body.settings || {});

    sendJson(response, 200, {
      settings: savedSettings
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Failed to save app state."
    });
  }
}

async function handleGetMemories(response) {
  if (!hasSupabaseConfig()) {
    sendJson(response, 503, {
      error:
        "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) first."
    });
    return;
  }

  try {
    const memories = await loadMemories(50);
    sendJson(response, 200, { memories });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Failed to load memories."
    });
  }
}

async function handlePostMemory(request, response) {
  if (!hasSupabaseConfig()) {
    sendJson(response, 503, {
      error:
        "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) first."
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const memory = await storeMemory(body.memory || body);

    sendJson(response, 200, {
      memory
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Failed to save memory."
    });
  }
}

async function handleApplyActions(request, response) {
  if (!hasSupabaseConfig()) {
    sendJson(response, 503, {
      error:
        "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) first."
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const savedSettings = await applyAssistantActionsWithPersistence(body.actions, body.settings || {});

    sendJson(response, 200, {
      settings: savedSettings
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Failed to apply assistant actions."
    });
  }
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

    let appContext = body.appContext || {};

    if (hasSupabaseConfig()) {
      try {
        const persistedSettings = await loadAppStateFromSupabase();
        appContext = buildAppContextFromSettings(persistedSettings);
      } catch (error) {
        console.warn("Failed to load persisted app state for chat context.", error);
      }
    }

    const endpoint = buildEndpoint(body.settings);
    const payload = buildChatPayload({
      messages: body.messages,
      settings: body.settings,
      appContext
    });
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
    let nextSettings = null;
    let syncError = null;

    if (parsedReply.actions && hasSupabaseConfig()) {
      try {
        nextSettings = await applyAssistantActionsWithPersistence(parsedReply.actions, body.settings);
      } catch (error) {
        syncError = error.message || "Failed to persist assistant actions.";
      }
    }

    sendJson(response, 200, {
      content: parsedReply.content || "我已经帮你处理好了。",
      actions: parsedReply.actions,
      settings: nextSettings,
      syncError,
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

  if (request.url === "/api/app-state" && request.method === "GET") {
    handleGetAppState(response);
    return;
  }

  if (request.url === "/api/app-state" && request.method === "PUT") {
    handlePutAppState(request, response);
    return;
  }

  if (request.url === "/api/memories" && request.method === "GET") {
    handleGetMemories(response);
    return;
  }

  if (request.url === "/api/memories" && request.method === "POST") {
    handlePostMemory(request, response);
    return;
  }

  if (request.url === "/api/actions/apply" && request.method === "POST") {
    handleApplyActions(request, response);
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

  if (hasSupabaseConfig()) {
    console.log("Supabase persistence is enabled.");
  }

  if (getProxyUrl()) {
    console.log(`Using proxy: ${getProxyUrl()}`);
  }
});
