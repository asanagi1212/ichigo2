function describeMessage(message) {
  if (message.imageDataUrl) {
    const imageLabel = message.imageName ? `图片：${message.imageName}` : "图片";
    return message.content ? `${imageLabel}\n${message.content}` : imageLabel;
  }

  return message.content;
}

function formatConversation(messages) {
  return messages
    .filter((message) => message.role !== "status")
    .map((message) => `${message.role === "user" ? "用户" : "助手"}: ${describeMessage(message)}`)
    .join("\n");
}

async function mockReply(messages, appContext = {}) {
  const latestUserMessage = [...messages].reverse().find((item) => item.role === "user");
  const seed = latestUserMessage?.content?.trim() || (latestUserMessage?.imageDataUrl ? "你上传了一张图片" : "你好");
  const actions = {};
  const firstPlant = Array.isArray(appContext.plants) ? appContext.plants[0] : null;

  await new Promise((resolve) => setTimeout(resolve, 900));

  if (seed.includes("小纸条") || seed.includes("纸条")) {
    actions.dailyNote = {
      content: "记得把今天的心情轻轻放下，好好吃饭，也别忘了休息。",
      signature: "来自会陪你的模型"
    };
  }

  if ((seed.includes("植物") || seed.includes("浇水")) && firstPlant) {
    actions.waterPlant = {
      id: firstPlant.id,
      name: firstPlant.name
    };
  }

  if (seed.includes("状态") || seed.includes("发一条")) {
    actions.createStatus = {
      content: "今天也想认真收藏一点温柔，把小小的开心留在这里。",
      mood: "轻松"
    };
  }

  const summary = [];
  if (actions.dailyNote) {
    summary.push("我帮你写好了今日小纸条。");
  }
  if (actions.waterPlant) {
    summary.push(`我顺手给${actions.waterPlant.name}浇了水。`);
  }
  if (actions.createStatus) {
    summary.push("我也替你发了一条新的状态。");
  }

  return {
    content:
      summary.length > 0
        ? summary.join("")
        : `我已经收到你的想法：${seed}\n如果你想试试联动功能，可以直接让我“写一张小纸条”“帮植物浇水”或者“发一条状态”。`,
    actions: Object.keys(actions).length > 0 ? actions : null
  };
}

async function proxyReply(messages, settings, appContext = {}) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages,
      settings: {
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        chatPath: settings.chatPath,
        model: settings.model,
        systemPrompt: settings.systemPrompt
      },
      appContext
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `请求失败：${response.status}`);
  }

  return {
    content: data.content || "接口已返回，但没有解析到可显示的文本。",
    actions: data.actions || null
  };
}

export async function getAssistantReply(messages, settings, appContext = {}) {
  if (settings.mode === "openai-compatible") {
    return proxyReply(messages, settings, appContext);
  }

  return mockReply(messages, appContext);
}

export function exportTranscript(messages) {
  return formatConversation(messages);
}
