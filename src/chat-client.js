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

async function mockReply(messages) {
  const latestUserMessage = [...messages].reverse().find((item) => item.role === "user");
  const seed =
    latestUserMessage?.content?.trim() ||
    (latestUserMessage?.imageDataUrl ? "你上传了一张图片" : "你好");

  await new Promise((resolve) => setTimeout(resolve, 900));

  return [
    `我已经收到你的需求：${seed}`,
    "如果你愿意，我们下一步可以继续细化成这三个方向：",
    "1. 聊天流程与消息状态",
    "2. 模型接入方式与鉴权方案",
    "3. iOS PWA 的安装、缓存和输入体验优化"
  ].join("\n");
}

async function proxyReply(messages, settings) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages,
      settings: {
        baseUrl: settings.baseUrl,
        chatPath: settings.chatPath,
        model: settings.model,
        systemPrompt: settings.systemPrompt
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `请求失败: ${response.status}`);
  }

  return data.content || "接口已返回，但没有解析到标准消息内容。";
}

export async function getAssistantReply(messages, settings) {
  if (settings.mode === "openai-compatible") {
    return proxyReply(messages, settings);
  }

  return mockReply(messages, settings);
}

export function exportTranscript(messages) {
  return formatConversation(messages);
}
