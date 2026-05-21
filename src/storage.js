const STORAGE_KEY = "pulse-chat-settings";

const defaultChecklist = [
  {
    id: "morning",
    label: "早安仪式",
    items: [
      { id: "water", label: "喝一杯温水", checked: true },
      { id: "breakfast", label: "记得吃早餐", checked: false }
    ]
  },
  {
    id: "daytime",
    label: "白天记挂",
    items: [
      { id: "reply", label: "忙完记得回消息", checked: false },
      { id: "walk", label: "出去走一小会儿", checked: false }
    ]
  },
  {
    id: "night",
    label: "晚安收尾",
    items: [
      { id: "shower", label: "洗漱和护肤", checked: false },
      { id: "sleep", label: "早点睡觉", checked: false }
    ]
  }
];

const defaults = {
  mode: "mock",
  baseUrl: "https://api.openai.com",
  chatPath: "/v1/chat/completions",
  model: "gpt-4o-mini",
  systemPrompt: "你是一个专业、简洁、可靠的中文助手。",
  contactName: "联系人工助手",
  contactAvatar: "AI",
  contactAvatarImage: "",
  nestLeftName: "阿橘",
  nestLeftAvatar: "阿",
  nestLeftAvatarImage: "",
  nestRightName: "小窝",
  nestRightAvatar: "窝",
  nestRightAvatarImage: "",
  nestStartDate: "2022-09-03",
  nestChecklist: defaultChecklist
};

function sanitizeChecklist(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return defaultChecklist.map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item }))
    }));
  }

  const next = value
    .map((section, sectionIndex) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const items = Array.isArray(section.items)
        ? section.items
            .map((item, itemIndex) => {
              if (!item || typeof item !== "object") {
                return null;
              }

              return {
                id: item.id || `item-${sectionIndex + 1}-${itemIndex + 1}`,
                label: typeof item.label === "string" ? item.label : "",
                checked: Boolean(item.checked)
              };
            })
            .filter(Boolean)
        : [];

      return {
        id: section.id || `section-${sectionIndex + 1}`,
        label: typeof section.label === "string" ? section.label : "",
        items
      };
    })
    .filter(Boolean);

  return next.length > 0 ? next : sanitizeChecklist(null);
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const { apiKey, ...settings } = parsed;

    return {
      ...defaults,
      ...settings,
      nestChecklist: sanitizeChecklist(settings.nestChecklist)
    };
  } catch {
    return { ...defaults, nestChecklist: sanitizeChecklist(defaults.nestChecklist) };
  }
}

export function saveSettings(settings) {
  const { apiKey, ...safeSettings } = settings;
  const next = {
    ...defaults,
    ...safeSettings,
    nestChecklist: sanitizeChecklist(safeSettings.nestChecklist)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
