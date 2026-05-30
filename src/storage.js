const STORAGE_KEY = "pulse-chat-settings";

export const defaultChecklist = [
  {
    id: "morning",
    label: "早安仪式",
    items: [
      { id: "water", label: "喝一杯温水", checked: true },
      { id: "breakfast", label: "记得吃早饭", checked: false }
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
      { id: "shower", label: "洗澡和护肤", checked: false },
      { id: "sleep", label: "早点睡觉", checked: false }
    ]
  }
];

export const defaultNestPlants = [
  { id: "plant-pothos", emoji: "🪴", name: "绿萝", species: "黄金葛", days: 3, waterLevel: 0.26 },
  { id: "plant-cactus", emoji: "🌵", name: "多肉", species: "仙人掌科", days: 12, waterLevel: 0.82 },
  { id: "plant-lavender", emoji: "🌿", name: "薰衣草", species: "Lavender", days: 1, waterLevel: 0.48 },
  { id: "plant-sunflower", emoji: "🌻", name: "向日葵", species: "Sunflower", days: 7, waterLevel: 0.74 },
  { id: "plant-strawberry", emoji: "🍓", name: "草莓", species: "Strawberry", days: 4, waterLevel: 0.58 },
  { id: "plant-clover", emoji: "🍀", name: "幸运草", species: "Oxalis", days: 9, waterLevel: 0.67 },
  { id: "plant-waterlily", emoji: "🪷", name: "睡莲", species: "Water Lily", days: 5, waterLevel: 0.63 }
];

export const defaults = {
  mode: "mock",
  apiKey: "",
  baseUrl: "https://api.openai.com",
  chatPath: "/v1/chat/completions",
  model: "gpt-4o-mini",
  systemPrompt: "你是一个专业、简洁、可靠的中文助手。",
  contactName: "阿橘",
  contactAvatar: "阿",
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

function looksCorruptedText(value) {
  return typeof value === "string" && (/\?{2,}|�|`n/.test(value) || value.includes("\uFFFD"));
}

function cleanString(value, fallback = "") {
  return looksCorruptedText(value) || typeof value !== "string" ? fallback : value;
}

function pickFilledString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function cloneDefaultChecklist() {
  return defaultChecklist.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item }))
  }));
}

function cloneDefaultNestPlants() {
  return defaultNestPlants.map((plant) => ({ ...plant }));
}

export function sanitizeChecklist(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return cloneDefaultChecklist();
  }

  const fallbackSections = cloneDefaultChecklist();

  const next = value
    .map((section, sectionIndex) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const fallbackSection = fallbackSections[sectionIndex] || fallbackSections[0];
      const items = Array.isArray(section.items)
        ? section.items
            .map((item, itemIndex) => {
              if (!item || typeof item !== "object") {
                return null;
              }

              const fallbackItem = fallbackSection?.items[itemIndex] || fallbackSection?.items[0];
              const label =
                looksCorruptedText(item.label) && fallbackItem?.label
                  ? fallbackItem.label
                  : typeof item.label === "string"
                    ? item.label
                    : "";

              return {
                id: item.id || `item-${sectionIndex + 1}-${itemIndex + 1}`,
                label,
                checked: Boolean(item.checked)
              };
            })
            .filter(Boolean)
        : [];

      const label =
        looksCorruptedText(section.label) && fallbackSection?.label
          ? fallbackSection.label
          : typeof section.label === "string"
            ? section.label
            : "";

      return {
        id: section.id || `section-${sectionIndex + 1}`,
        label,
        items
      };
    })
    .filter(Boolean);

  return next.length > 0 ? next : cloneDefaultChecklist();
}

export function sanitizeNestPlants(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return cloneDefaultNestPlants();
  }

  const fallbackPlants = cloneDefaultNestPlants();

  const next = value
    .map((plant, index) => {
      if (!plant || typeof plant !== "object") {
        return null;
      }

      const fallbackPlant = fallbackPlants[index] || fallbackPlants[0];
      const waterLevel = Number.isFinite(Number(plant.waterLevel))
        ? Math.max(0, Math.min(1, Number(plant.waterLevel)))
        : 0.5;
      const emoji =
        looksCorruptedText(plant.emoji) && fallbackPlant?.emoji
          ? fallbackPlant.emoji
          : typeof plant.emoji === "string" && plant.emoji.trim()
            ? plant.emoji.trim()
            : "🪴";
      const name =
        looksCorruptedText(plant.name) && fallbackPlant?.name
          ? fallbackPlant.name
          : typeof plant.name === "string" && plant.name.trim()
            ? plant.name.trim()
            : `植物 ${index + 1}`;
      const species =
        looksCorruptedText(plant.species) && fallbackPlant?.species
          ? fallbackPlant.species
          : typeof plant.species === "string"
            ? plant.species.trim()
            : "";

      return {
        id: plant.id || `plant-${index + 1}`,
        emoji,
        name,
        species,
        days: Number.isFinite(Number(plant.days)) ? Math.max(1, Math.round(Number(plant.days))) : 1,
        waterLevel
      };
    })
    .filter(Boolean);

  return next.length > 0 ? next : cloneDefaultNestPlants();
}

export function sanitizeSettings(settings = {}) {
  const dailyNote =
    typeof settings.nestDailyNote === "string"
      ? settings.nestDailyNote.replace(/`n/g, "\n")
      : defaults.nestDailyNote;
  const contactName = cleanString(settings.contactName);
  const contactAvatar = cleanString(settings.contactAvatar);
  const contactAvatarImage = cleanString(settings.contactAvatarImage);
  const nestLeftName = cleanString(settings.nestLeftName);
  const nestLeftAvatar = cleanString(settings.nestLeftAvatar);
  const nestLeftAvatarImage = cleanString(settings.nestLeftAvatarImage);
  const nestRightName = cleanString(settings.nestRightName);
  const nestRightAvatar = cleanString(settings.nestRightAvatar);
  const nestRightAvatarImage = cleanString(settings.nestRightAvatarImage);
  const statusAvatar = cleanString(settings.statusAvatar);
  const statusAvatarImage = cleanString(settings.statusAvatarImage);
  const assistantName = pickFilledString(nestLeftName, contactName, defaults.nestLeftName);
  const assistantAvatar = pickFilledString(nestLeftAvatar, contactAvatar, defaults.nestLeftAvatar);
  const assistantAvatarImage = pickFilledString(nestLeftAvatarImage, contactAvatarImage);
  const userName = pickFilledString(nestRightName, defaults.nestRightName);
  const userAvatar = pickFilledString(statusAvatar, nestRightAvatar, defaults.statusAvatar);
  const userAvatarImage = pickFilledString(statusAvatarImage, nestRightAvatarImage);

  return {
    ...defaults,
    ...settings,
    model:
      typeof settings.model === "string" && settings.model.trim()
        ? settings.model.trim()
        : defaults.model,
    systemPrompt:
      looksCorruptedText(settings.systemPrompt) || typeof settings.systemPrompt !== "string"
        ? defaults.systemPrompt
        : settings.systemPrompt,
    contactName: assistantName,
    contactAvatar: assistantAvatar,
    contactAvatarImage: assistantAvatarImage,
    nestLeftName: assistantName,
    nestLeftAvatar: assistantAvatar,
    nestLeftAvatarImage: assistantAvatarImage,
    nestRightName: userName,
    nestRightAvatar: userAvatar,
    nestRightAvatarImage: userAvatarImage,
    statusAvatar: userAvatar,
    statusAvatarImage: userAvatarImage,
    statusSignature:
      looksCorruptedText(settings.statusSignature) || typeof settings.statusSignature !== "string"
        ? defaults.statusSignature
        : settings.statusSignature,
    nestDailyNote: looksCorruptedText(dailyNote) ? defaults.nestDailyNote : dailyNote,
    nestDailySign:
      looksCorruptedText(settings.nestDailySign) || typeof settings.nestDailySign !== "string"
        ? defaults.nestDailySign
        : settings.nestDailySign,
    nestChecklist: sanitizeChecklist(settings.nestChecklist),
    nestPlants: sanitizeNestPlants(settings.nestPlants)
  };
}

export function buildServerSettingsPayload(settings = {}) {
  const next = sanitizeSettings(settings);
  const { apiKey, ...payload } = next;
  return payload;
}

export function mergeServerSettings(localSettings = {}, remoteSettings = {}) {
  const merged = sanitizeSettings({
    ...localSettings,
    ...remoteSettings
  });

  if (typeof localSettings.apiKey === "string") {
    merged.apiKey = localSettings.apiKey;
  }

  return merged;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return sanitizeSettings(parsed);
  } catch {
    return sanitizeSettings(defaults);
  }
}

export function saveSettings(settings = {}) {
  const next = sanitizeSettings(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
