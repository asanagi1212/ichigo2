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

const defaultNestPlants = [
  { id: "plant-pothos", emoji: "🪴", name: "绿萝", species: "黄金葛", days: 3, waterLevel: 0.26 },
  { id: "plant-cactus", emoji: "🌵", name: "多肉", species: "仙人掌科", days: 12, waterLevel: 0.82 },
  { id: "plant-lavender", emoji: "💐", name: "薰衣草", species: "Lavender", days: 1, waterLevel: 0.48 },
  { id: "plant-sunflower", emoji: "🌻", name: "向日葵", species: "Sunflower", days: 7, waterLevel: 0.74 },
  { id: "plant-strawberry", emoji: "🍓", name: "草莓", species: "Strawberry", days: 4, waterLevel: 0.58 },
  { id: "plant-clover", emoji: "🍀", name: "幸运草", species: "Oxalis", days: 9, waterLevel: 0.67 },
  { id: "plant-waterlily", emoji: "🪷", name: "睡莲", species: "Water Lily", days: 5, waterLevel: 0.63 }
];

const defaults = {
  mode: "mock",
  apiKey: "",
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
  statusAvatar: "早",
  statusAvatarImage: "",
  statusLittleUpdate: "little updates",
  statusSignature: "把喜欢、心情和每天的小碎片，慢慢留在这里。",
  nestStartDate: "2022-09-03",
  nestDailyNote: "今天也要好好吃饭、慢慢休息。\n忙的时候记得回来看看这里，我们把喜欢的日常一点点存起来。",
  nestDailySign: "来自你的小窝",
  nestChecklist: defaultChecklist,
  nestPlants: defaultNestPlants
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

function sanitizeNestPlants(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return defaultNestPlants.map((plant) => ({ ...plant }));
  }

  const next = value
    .map((plant, index) => {
      if (!plant || typeof plant !== "object") {
        return null;
      }

      const waterLevel = Number.isFinite(Number(plant.waterLevel))
        ? Math.max(0, Math.min(1, Number(plant.waterLevel)))
        : 0.5;

      return {
        id: plant.id || `plant-${index + 1}`,
        emoji: typeof plant.emoji === "string" && plant.emoji.trim() ? plant.emoji.trim() : "🪴",
        name: typeof plant.name === "string" && plant.name.trim() ? plant.name.trim() : `植物 ${index + 1}`,
        species: typeof plant.species === "string" ? plant.species.trim() : "",
        days: Number.isFinite(Number(plant.days)) ? Math.max(1, Math.round(Number(plant.days))) : 1,
        waterLevel
      };
    })
    .filter(Boolean);

  return next.length > 0 ? next : sanitizeNestPlants(null);
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    return {
      ...defaults,
      ...parsed,
      nestChecklist: sanitizeChecklist(parsed.nestChecklist),
      nestPlants: sanitizeNestPlants(parsed.nestPlants)
    };
  } catch {
    return {
      ...defaults,
      nestChecklist: sanitizeChecklist(defaults.nestChecklist),
      nestPlants: sanitizeNestPlants(defaults.nestPlants)
    };
  }
}

export function saveSettings(settings) {
  const next = {
    ...defaults,
    ...settings,
    model: typeof settings.model === "string" && settings.model.trim() ? settings.model.trim() : defaults.model,
    nestChecklist: sanitizeChecklist(settings.nestChecklist),
    nestPlants: sanitizeNestPlants(settings.nestPlants)
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
