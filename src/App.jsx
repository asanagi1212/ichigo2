import { useEffect, useRef, useState } from "react";
import { getAssistantReply } from "./chat-client.js";
import { loadSettings, saveSettings } from "./storage.js";

function createId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const initialMessages = [
  {
    id: createId(),
    role: "assistant",
    content:
      "你好，我已经准备好作为这个项目的聊天助手。你可以先把想法、页面需求或者接口约束发给我，我们就从这里往下接。",
    timestamp: new Date().toISOString()
  }
];

const nestFeatureCards = [
  { title: "我们的日记", subtitle: "把细碎的开心都收进来", emoji: "📔", tone: "warm" },
  { title: "记忆相册", subtitle: "留给以后反复翻看的瞬间", emoji: "🖼️", tone: "lavender" },
  { title: "待办提醒", subtitle: "今天也一起把生活过顺", emoji: "📝", tone: "sage" },
  { title: "心愿清单", subtitle: "想做的事慢慢实现", emoji: "💛", tone: "rose" }
];

function IconButton({ label, children, ...props }) {
  return (
    <button className="icon-button" type="button" aria-label={label} {...props}>
      {children}
    </button>
  );
}

function Avatar({ text, image, className = "", clickable = false, onClick, label }) {
  const content = image ? (
    <img className="avatar-image" src={image} alt={label || "avatar"} />
  ) : (
    <span>{text || "AI"}</span>
  );

  if (clickable) {
    return (
      <button
        className={`avatar-pill avatar-button ${className}`.trim()}
        type="button"
        onClick={onClick}
        aria-label={label}
      >
        {content}
      </button>
    );
  }

  return <div className={`avatar-pill ${className}`.trim()}>{content}</div>;
}

function SettingsDialog({ open, settings, onClose, onSave }) {
  const dialogRef = useRef(null);
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleChange(event) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave(draft);
  }

  return (
    <dialog className="settings-dialog" ref={dialogRef} onClose={onClose}>
      <form className="settings-panel" method="dialog" onSubmit={handleSubmit}>
        <div className="settings-header">
          <div>
            <p className="settings-kicker">连接设置</p>
            <h2>模型接入配置</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <label>
          模式
          <select name="mode" value={draft.mode} onChange={handleChange}>
            <option value="mock">Mock</option>
            <option value="openai-compatible">OpenAI Compatible</option>
          </select>
        </label>

        <label>
          API Key
          <input
            name="apiKey"
            type="password"
            value={draft.apiKey || ""}
            onChange={handleChange}
            placeholder="sk-..."
            autoComplete="off"
            spellCheck="false"
          />
        </label>

        <label>
          Base URL
          <input
            name="baseUrl"
            type="url"
            value={draft.baseUrl}
            onChange={handleChange}
            placeholder="https://api.openai.com"
          />
        </label>

        <label>
          Chat Path
          <input
            name="chatPath"
            type="text"
            value={draft.chatPath}
            onChange={handleChange}
            placeholder="/v1/chat/completions"
          />
        </label>

        <label>
          Model
          <input
            name="model"
            type="text"
            value={draft.model}
            onChange={handleChange}
            placeholder="gpt-4o-mini"
          />
        </label>

        <label>
          System Prompt
          <textarea
            name="systemPrompt"
            rows="3"
            value={draft.systemPrompt}
            onChange={handleChange}
            placeholder="你是一个专业、简洁、可靠的中文助手。"
          />
        </label>

        <p className="settings-note">
          API Key 由后端 `.env` 读取，前端不会保存或暴露真实密钥。
        </p>

        <p className="settings-note">
          API Key entered here is stored only on this device and sent to your own proxy when you chat.
          If left blank, the server-side OPENAI_API_KEY will be used as a fallback.
        </p>

        <button className="primary-button" type="submit">
          保存配置
        </button>
      </form>
    </dialog>
  );
}

function ProfileQuickEditor({ open, settings, onClose, onSave }) {
  const dialogRef = useRef(null);
  const fileInputRef = useRef(null);
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setDraft((current) => ({
      ...current,
      [name]: name === "contactAvatar" ? value.slice(0, 2) : value
    }));
  }

  function handleChooseImage() {
    fileInputRef.current?.click();
  }

  function handleRemoveImage() {
    setDraft((current) => ({
      ...current,
      contactAvatarImage: ""
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDraft((current) => ({
        ...current,
        contactAvatarImage: typeof reader.result === "string" ? reader.result : ""
      }));
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave(draft);
    onClose();
  }

  return (
    <dialog className="sheet-dialog" ref={dialogRef} onClose={onClose}>
      <form className="sheet-panel" method="dialog" onSubmit={handleSubmit}>
        <div className="sheet-handle" aria-hidden="true"></div>

        <div className="sheet-header">
          <div>
            <p className="settings-kicker">快捷编辑</p>
            <h2>修改头像和备注</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="profile-preview">
          <Avatar
            text={draft.contactAvatar}
            image={draft.contactAvatarImage}
            className="profile-avatar profile-avatar-large"
            label="头像预览"
          />
          <div>
            <p className="session-label">即时预览</p>
            <h3 className="profile-name">{draft.contactName || "联系人工助手"}</h3>
          </div>
        </div>

        <div className="profile-fields">
          <label>
            备注名称
            <input
              name="contactName"
              type="text"
              maxLength="20"
              value={draft.contactName || ""}
              onChange={handleFieldChange}
              placeholder="联系人工助手"
            />
          </label>

          <label>
            头像文字
            <input
              name="contactAvatar"
              type="text"
              maxLength="2"
              value={draft.contactAvatar || ""}
              onChange={handleFieldChange}
              placeholder="AI"
            />
          </label>
        </div>

        <div className="profile-upload-row">
          <input
            ref={fileInputRef}
            className="hidden-input"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
          />
          <button className="ghost-button" type="button" onClick={handleChooseImage}>
            上传头像图片
          </button>
          <button className="ghost-button ghost-button-muted" type="button" onClick={handleRemoveImage}>
            移除图片
          </button>
        </div>

        <p className="settings-note profile-note">
          支持上传本地图片作为头像；如果没有图片，会回退显示你设置的头像文字。
        </p>

        <button className="primary-button" type="submit">
          保存
        </button>
      </form>
    </dialog>
  );
}

function NestHeroEditor({ open, settings, onClose, onSave }) {
  const dialogRef = useRef(null);
  const leftFileInputRef = useRef(null);
  const rightFileInputRef = useRef(null);
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setDraft((current) => ({
      ...current,
      [name]: name.includes("Avatar") && !name.includes("Image") ? value.slice(0, 2) : value
    }));
  }

  function handleChooseImage(side) {
    if (side === "left") {
      leftFileInputRef.current?.click();
      return;
    }

    rightFileInputRef.current?.click();
  }

  function handleRemoveImage(side) {
    const imageKey = side === "left" ? "nestLeftAvatarImage" : "nestRightAvatarImage";
    setDraft((current) => ({
      ...current,
      [imageKey]: ""
    }));

    const inputRef = side === "left" ? leftFileInputRef : rightFileInputRef;
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleImageChange(side, event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const imageKey = side === "left" ? "nestLeftAvatarImage" : "nestRightAvatarImage";
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((current) => ({
        ...current,
        [imageKey]: typeof reader.result === "string" ? reader.result : ""
      }));
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave(draft);
    onClose();
  }

  return (
    <dialog className="settings-dialog" ref={dialogRef} onClose={onClose}>
      <form className="settings-panel nest-editor-panel" method="dialog" onSubmit={handleSubmit}>
        <div className="settings-header">
          <div>
            <p className="settings-kicker">小窝编辑</p>
            <h2>头像与纪念日</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="nest-editor-grid">
          <section className="nest-editor-card">
            <div className="nest-editor-preview">
              <div className="nest-mini-avatar">
                {draft.nestLeftAvatarImage ? (
                  <img className="avatar-image" src={draft.nestLeftAvatarImage} alt="左侧头像预览" />
                ) : (
                  <span>{draft.nestLeftAvatar || "阿"}</span>
                )}
              </div>
              <div>
                <p className="session-label">左侧角色</p>
                <h3 className="profile-name">{draft.nestLeftName || "阿橘"}</h3>
              </div>
            </div>

            <label>
              名字
              <input
                name="nestLeftName"
                type="text"
                maxLength="12"
                value={draft.nestLeftName || ""}
                onChange={handleFieldChange}
                placeholder="阿橘"
              />
            </label>

            <label>
              头像文字
              <input
                name="nestLeftAvatar"
                type="text"
                maxLength="2"
                value={draft.nestLeftAvatar || ""}
                onChange={handleFieldChange}
                placeholder="阿"
              />
            </label>

            <input
              ref={leftFileInputRef}
              className="hidden-input"
              type="file"
              accept="image/*"
              onChange={(event) => handleImageChange("left", event)}
            />
            <div className="profile-upload-row">
              <button className="ghost-button" type="button" onClick={() => handleChooseImage("left")}>
                上传头像
              </button>
              <button className="ghost-button ghost-button-muted" type="button" onClick={() => handleRemoveImage("left")}>
                移除图片
              </button>
            </div>
          </section>

          <section className="nest-editor-card">
            <div className="nest-editor-preview">
              <div className="nest-mini-avatar alt">
                {draft.nestRightAvatarImage ? (
                  <img className="avatar-image" src={draft.nestRightAvatarImage} alt="右侧头像预览" />
                ) : (
                  <span>{draft.nestRightAvatar || "窝"}</span>
                )}
              </div>
              <div>
                <p className="session-label">右侧角色</p>
                <h3 className="profile-name">{draft.nestRightName || "小窝"}</h3>
              </div>
            </div>

            <label>
              名字
              <input
                name="nestRightName"
                type="text"
                maxLength="12"
                value={draft.nestRightName || ""}
                onChange={handleFieldChange}
                placeholder="小窝"
              />
            </label>

            <label>
              头像文字
              <input
                name="nestRightAvatar"
                type="text"
                maxLength="2"
                value={draft.nestRightAvatar || ""}
                onChange={handleFieldChange}
                placeholder="窝"
              />
            </label>

            <input
              ref={rightFileInputRef}
              className="hidden-input"
              type="file"
              accept="image/*"
              onChange={(event) => handleImageChange("right", event)}
            />
            <div className="profile-upload-row">
              <button className="ghost-button" type="button" onClick={() => handleChooseImage("right")}>
                上传头像
              </button>
              <button className="ghost-button ghost-button-muted" type="button" onClick={() => handleRemoveImage("right")}>
                移除图片
              </button>
            </div>
          </section>
        </div>

        <label>
          起始日期
          <input
            name="nestStartDate"
            type="date"
            value={draft.nestStartDate || ""}
            onChange={handleFieldChange}
          />
        </label>

        <p className="settings-note">
          保存后会按你设置的起始日期重新开始计数；头像支持上传本地图片，不上传时会显示文字头像。
        </p>

        <button className="primary-button" type="submit">
          保存小窝信息
        </button>
      </form>
    </dialog>
  );
}

function ChecklistEditor({ open, checklist, onClose, onSave }) {
  const dialogRef = useRef(null);
  const [draft, setDraft] = useState(checklist);

  useEffect(() => {
    setDraft(checklist);
  }, [checklist]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function updateSection(sectionId, updater) {
    setDraft((current) =>
      current.map((section) =>
        section.id === sectionId ? updater(section) : section
      )
    );
  }

  function handleSectionLabelChange(sectionId, value) {
    updateSection(sectionId, (section) => ({
      ...section,
      label: value
    }));
  }

  function handleItemChange(sectionId, itemId, value) {
    updateSection(sectionId, (section) => ({
      ...section,
      items: section.items.map((item) =>
        item.id === itemId ? { ...item, label: value } : item
      )
    }));
  }

  function handleItemCheckedChange(sectionId, itemId, checked) {
    updateSection(sectionId, (section) => ({
      ...section,
      items: section.items.map((item) =>
        item.id === itemId ? { ...item, checked } : item
      )
    }));
  }

  function handleAddSection() {
    setDraft((current) => [
      ...current,
      {
        id: createId(),
        label: "新分组",
        items: [{ id: createId(), label: "新的提醒", checked: false }]
      }
    ]);
  }

  function handleRemoveSection(sectionId) {
    setDraft((current) =>
      current.length > 1 ? current.filter((section) => section.id !== sectionId) : current
    );
  }

  function handleAddItem(sectionId) {
    updateSection(sectionId, (section) => ({
      ...section,
      items: [...section.items, { id: createId(), label: "新的提醒", checked: false }]
    }));
  }

  function handleRemoveItem(sectionId, itemId) {
    updateSection(sectionId, (section) => ({
      ...section,
      items:
        section.items.length > 1
          ? section.items.filter((item) => item.id !== itemId)
          : section.items
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave(draft);
    onClose();
  }

  return (
    <dialog className="settings-dialog" ref={dialogRef} onClose={onClose}>
      <form className="settings-panel checklist-editor-panel" method="dialog" onSubmit={handleSubmit}>
        <div className="settings-header">
          <div>
            <p className="settings-kicker">清单编辑</p>
            <h2>请记住</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="checklist-editor-groups">
          {draft.map((section) => (
            <section key={section.id} className="checklist-editor-card">
              <div className="checklist-editor-section-head">
                <label>
                  分组标题
                  <input
                    type="text"
                    value={section.label}
                    onChange={(event) => handleSectionLabelChange(section.id, event.target.value)}
                    placeholder="分组标题"
                  />
                </label>
                <button className="ghost-button ghost-button-muted" type="button" onClick={() => handleRemoveSection(section.id)}>
                  删除分组
                </button>
              </div>

              <div className="checklist-editor-items">
                {section.items.map((item) => (
                  <div key={item.id} className="checklist-editor-item-row">
                    <label className="checklist-editor-checkbox">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) => handleItemCheckedChange(section.id, item.id, event.target.checked)}
                      />
                      <span>默认勾选</span>
                    </label>

                    <input
                      className="checklist-editor-input"
                      type="text"
                      value={item.label}
                      onChange={(event) => handleItemChange(section.id, item.id, event.target.value)}
                      placeholder="提醒内容"
                    />

                    <button className="ghost-button ghost-button-muted" type="button" onClick={() => handleRemoveItem(section.id, item.id)}>
                      删除
                    </button>
                  </div>
                ))}
              </div>

              <button className="ghost-button" type="button" onClick={() => handleAddItem(section.id)}>
                新增提醒
              </button>
            </section>
          ))}
        </div>

        <div className="checklist-editor-footer">
          <button className="ghost-button" type="button" onClick={handleAddSection}>
            新增分组
          </button>
          <button className="primary-button" type="submit">
            保存清单
          </button>
        </div>
      </form>
    </dialog>
  );
}

function formatDateHeader(dateValue) {
  const date = new Date(dateValue);
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(date);

  const month = parts.find((part) => part.type === "month")?.value.toUpperCase() || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  const hour = parts.find((part) => part.type === "hour")?.value || "";
  const minute = parts.find((part) => part.type === "minute")?.value || "";
  const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value.toUpperCase() || "";

  return `${month} ${day} AT ${hour}:${minute} ${dayPeriod}`;
}

function shouldShowDateHeader(message, previousMessage) {
  if (!previousMessage) {
    return true;
  }

  const currentTimestamp = new Date(message.timestamp).getTime();
  const previousTimestamp = new Date(previousMessage.timestamp).getTime();
  const thirtyMinutes = 30 * 60 * 1000;

  return (
    message.role !== previousMessage.role ||
    currentTimestamp - previousTimestamp > thirtyMinutes
  );
}

function MessageGroup({ message, previousMessage, onAssistantAvatarClick }) {
  const showHeader = shouldShowDateHeader(message, previousMessage);

  return (
    <section className="message-group">
      {showHeader ? (
        <div className={`date-header-row ${message.role}`}>
          {message.role === "assistant" ? (
            <Avatar
              text={message.avatar || "AI"}
              image={message.avatarImage}
              clickable
              onClick={onAssistantAvatarClick}
              label="编辑对方头像和备注"
            />
          ) : null}

          <p className="message-date">{formatDateHeader(message.timestamp)}</p>

          {message.role === "user" ? <Avatar text="我" /> : null}
        </div>
      ) : null}

      <article className={`message-row ${message.role}`}>
        <div className="bubble-row">
          <div className="bubble">
            {message.pending ? (
              <span className="typing" aria-label="正在输入">
                <span></span>
                <span></span>
                <span></span>
              </span>
            ) : message.imageDataUrl ? (
              <img
                className="message-image"
                src={message.imageDataUrl}
                alt={message.imageName || "已添加的图片"}
              />
            ) : (
              message.content
            )}
          </div>
        </div>
      </article>
    </section>
  );
}

function ModeSwitchMenu({ open, currentMode, onSelectMode, onOpenSettings }) {
  if (!open) {
    return null;
  }

  const options = [
    { value: "mock", label: "Mock 模式" },
    { value: "openai-compatible", label: "OpenAI Compatible" }
  ];

  return (
    <div className="mode-menu" role="menu" aria-label="模式切换">
      <p className="mode-menu-title">模式</p>

      {options.map((option) => (
        <button
          key={option.value}
          className="mode-menu-item"
          type="button"
          role="menuitemradio"
          aria-checked={currentMode === option.value}
          onClick={() => onSelectMode(option.value)}
        >
          <span>{option.label}</span>
          {currentMode === option.value ? <span className="mode-check">✓</span> : null}
        </button>
      ))}

      <div className="mode-menu-divider"></div>

      <button className="mode-menu-item" type="button" onClick={onOpenSettings}>
        <span>模型设置</span>
        <span className="mode-chevron">›</span>
      </button>
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15 18 9 12l6-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13 2 4.8 13.2h6.5L10.9 22 19.2 9.8h-6.5L13 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3 20 18-8L3 4v6l11 2-11 2v6Z" fill="currentColor" />
    </svg>
  );
}

function ChatTabIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 18.5c-2.5 0-4.5-1.9-4.5-4.3V8.8C2.5 6.4 4.5 4.5 7 4.5h10c2.5 0 4.5 1.9 4.5 4.3v5.4c0 2.4-2 4.3-4.5 4.3H11l-4 3v-3H7Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function HomeTabIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 11.5 12 5l8 6.5v7a1.5 1.5 0 0 1-1.5 1.5h-3.5V14h-6v6H5.5A1.5 1.5 0 0 1 4 18.5v-7Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.5s-7-4.4-7-10.2c0-2.3 1.9-4.3 4.2-4.3 1.5 0 2.9.8 3.8 2.1C13.9 6.8 15.3 6 16.8 6 19.1 6 21 8 21 10.3c0 5.8-7 10.2-7 10.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m12.8 6.7 4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function parseDateOnly(dateStr) {
  if (!dateStr) {
    return null;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function daysSince(dateStr) {
  const start = parseDateOnly(dateStr);
  if (!start) {
    return 0;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatSinceDate(dateStr) {
  const date = parseDateOnly(dateStr);
  if (!date) {
    return "----.--.--";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function NestPage({ settings, onSaveHeroSettings, onSaveChecklist }) {
  const checklist = settings.nestChecklist || [];
  const leftFileInputRef = useRef(null);
  const rightFileInputRef = useRef(null);
  const checklistClickTimerRef = useRef(null);
  const [heroDraft, setHeroDraft] = useState({
    nestLeftName: settings.nestLeftName || "",
    nestLeftAvatar: settings.nestLeftAvatar || "",
    nestLeftAvatarImage: settings.nestLeftAvatarImage || "",
    nestRightName: settings.nestRightName || "",
    nestRightAvatar: settings.nestRightAvatar || "",
    nestRightAvatarImage: settings.nestRightAvatarImage || "",
    nestStartDate: settings.nestStartDate || ""
  });
  const [checklistDraft, setChecklistDraft] = useState(checklist);
  const [activeHeroEditor, setActiveHeroEditor] = useState(null);
  const [activeChecklistEditor, setActiveChecklistEditor] = useState(null);

  useEffect(() => {
    setHeroDraft({
      nestLeftName: settings.nestLeftName || "",
      nestLeftAvatar: settings.nestLeftAvatar || "",
      nestLeftAvatarImage: settings.nestLeftAvatarImage || "",
      nestRightName: settings.nestRightName || "",
      nestRightAvatar: settings.nestRightAvatar || "",
      nestRightAvatarImage: settings.nestRightAvatarImage || "",
      nestStartDate: settings.nestStartDate || ""
    });
  }, [
    settings.nestLeftName,
    settings.nestLeftAvatar,
    settings.nestLeftAvatarImage,
    settings.nestRightName,
    settings.nestRightAvatar,
    settings.nestRightAvatarImage,
    settings.nestStartDate
  ]);

  useEffect(() => {
    setChecklistDraft(checklist);
  }, [checklist]);

  useEffect(() => {
    return () => {
      if (checklistClickTimerRef.current) {
        window.clearTimeout(checklistClickTimerRef.current);
      }
    };
  }, []);

  function persistHero(nextDraft) {
    onSaveHeroSettings({ ...settings, ...nextDraft });
  }

  function handleHeroFieldChange(event) {
    const { name, value } = event.target;
    setHeroDraft((current) => ({
      ...current,
      [name]: name.includes("Avatar") && !name.includes("Image") ? value.slice(0, 2) : value
    }));
  }

  function handleHeroEditorBlur(event) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    persistHero(heroDraft);
    setActiveHeroEditor(null);
  }

  function handleHeroEditorKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      persistHero(heroDraft);
      setActiveHeroEditor(null);
      event.currentTarget.blur();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setHeroDraft({
        nestLeftName: settings.nestLeftName || "",
        nestLeftAvatar: settings.nestLeftAvatar || "",
        nestLeftAvatarImage: settings.nestLeftAvatarImage || "",
        nestRightName: settings.nestRightName || "",
        nestRightAvatar: settings.nestRightAvatar || "",
        nestRightAvatarImage: settings.nestRightAvatarImage || "",
        nestStartDate: settings.nestStartDate || ""
      });
      setActiveHeroEditor(null);
      event.currentTarget.blur();
    }
  }

  function handleChooseHeroImage(side) {
    if (side === "left") {
      leftFileInputRef.current?.click();
      return;
    }

    rightFileInputRef.current?.click();
  }

  function handleHeroImageChange(side, event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const imageKey = side === "left" ? "nestLeftAvatarImage" : "nestRightAvatarImage";
    const reader = new FileReader();
    reader.onload = () => {
      const imageValue = typeof reader.result === "string" ? reader.result : "";
      const nextDraft = {
        ...heroDraft,
        [imageKey]: imageValue
      };
      setHeroDraft(nextDraft);
      persistHero(nextDraft);
    };
    reader.readAsDataURL(file);
  }

  function updateChecklist(updater, persist = false) {
    const nextChecklist = updater(checklistDraft);
    setChecklistDraft(nextChecklist);

    if (persist) {
      onSaveChecklist(nextChecklist);
    }
  }

  function toggleItem(sectionId, itemId) {
    updateChecklist(
      (current) =>
        current.map((section) =>
          section.id !== sectionId
            ? section
            : {
                ...section,
                items: section.items.map((item) =>
                  item.id !== itemId ? item : { ...item, checked: !item.checked }
                )
              }
        ),
      true
    );
  }

  function handleSectionLabelChange(sectionId, value) {
    updateChecklist((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, label: value } : section
      )
    );
  }

  function handleChecklistItemChange(sectionId, itemId, value) {
    updateChecklist((current) =>
      current.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, label: value } : item
              )
            }
      )
    );
  }

  function handleChecklistTextClick(sectionId, itemId) {
    if (checklistClickTimerRef.current) {
      window.clearTimeout(checklistClickTimerRef.current);
    }

    checklistClickTimerRef.current = window.setTimeout(() => {
      toggleItem(sectionId, itemId);
      checklistClickTimerRef.current = null;
    }, 220);
  }

  function handleChecklistTextDoubleClick(sectionId, itemId) {
    if (checklistClickTimerRef.current) {
      window.clearTimeout(checklistClickTimerRef.current);
      checklistClickTimerRef.current = null;
    }

    setActiveChecklistEditor({
      type: "item",
      sectionId,
      itemId
    });
  }

  function handleChecklistTextBlur(event) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    onSaveChecklist(checklistDraft);
    setActiveChecklistEditor(null);
  }

  function handleChecklistTextKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSaveChecklist(checklistDraft);
      setActiveChecklistEditor(null);
      event.currentTarget.blur();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setChecklistDraft(checklist);
      setActiveChecklistEditor(null);
      event.currentTarget.blur();
    }
  }

  function handleAddChecklistSection() {
    updateChecklist(
      (current) => [
        ...current,
        {
          id: createId(),
          label: "新分组",
          items: [{ id: createId(), label: "新的提醒", checked: false }]
        }
      ],
      true
    );
  }

  function handleRemoveChecklistSection(sectionId) {
    updateChecklist(
      (current) =>
        current.length > 1 ? current.filter((section) => section.id !== sectionId) : current,
      true
    );
  }

  function handleAddChecklistItem(sectionId) {
    updateChecklist(
      (current) =>
        current.map((section) =>
          section.id !== sectionId
            ? section
            : {
                ...section,
                items: [...section.items, { id: createId(), label: "新的提醒", checked: false }]
              }
        ),
      true
    );
  }

  function handleRemoveChecklistItem(sectionId, itemId) {
    updateChecklist(
      (current) =>
        current.map((section) =>
          section.id !== sectionId
            ? section
            : {
                ...section,
                items:
                  section.items.length > 1
                    ? section.items.filter((item) => item.id !== itemId)
                    : section.items
              }
        ),
      true
    );
  }

  const previewHero = activeHeroEditor ? heroDraft : settings;
  const days = daysSince(previewHero.nestStartDate);

  return (
    <div className="nest-page">
      <section className="nest-hero">
        <input
          ref={leftFileInputRef}
          className="hidden-input"
          type="file"
          accept="image/*"
          onChange={(event) => handleHeroImageChange("left", event)}
        />
        <input
          ref={rightFileInputRef}
          className="hidden-input"
          type="file"
          accept="image/*"
          onChange={(event) => handleHeroImageChange("right", event)}
        />

        <div className="nest-avatars">
          <div className="nest-avatar-stack">
            <button className="nest-avatar-button" type="button" onClick={() => handleChooseHeroImage("left")}>
              <div className="nest-mini-avatar">
                {previewHero.nestLeftAvatarImage ? (
                  <img className="avatar-image" src={previewHero.nestLeftAvatarImage} alt={previewHero.nestLeftName || "左侧头像"} />
                ) : (
                  <span>{previewHero.nestLeftAvatar || "阿"}</span>
                )}
              </div>
            </button>

            {activeHeroEditor === "left" ? (
              <div className="nest-inline-editor" onBlur={handleHeroEditorBlur} onKeyDown={handleHeroEditorKeyDown}>
                <input
                  name="nestLeftName"
                  type="text"
                  value={heroDraft.nestLeftName}
                  onChange={handleHeroFieldChange}
                  placeholder="左侧名字"
                  autoFocus
                />
                <input
                  name="nestLeftAvatar"
                  type="text"
                  maxLength="2"
                  value={heroDraft.nestLeftAvatar}
                  onChange={handleHeroFieldChange}
                  placeholder="头像字"
                />
              </div>
            ) : (
              <button className="plain-inline-trigger" type="button" onClick={() => setActiveHeroEditor("left")}>
                {settings.nestLeftName || "阿橘"}
              </button>
            )}
          </div>

          <div className="nest-heart-wrap">
            <HeartIcon />
          </div>

          <div className="nest-avatar-stack">
            <button className="nest-avatar-button" type="button" onClick={() => handleChooseHeroImage("right")}>
              <div className="nest-mini-avatar alt">
                {previewHero.nestRightAvatarImage ? (
                  <img className="avatar-image" src={previewHero.nestRightAvatarImage} alt={previewHero.nestRightName || "右侧头像"} />
                ) : (
                  <span>{previewHero.nestRightAvatar || "窝"}</span>
                )}
              </div>
            </button>

            {activeHeroEditor === "right" ? (
              <div className="nest-inline-editor" onBlur={handleHeroEditorBlur} onKeyDown={handleHeroEditorKeyDown}>
                <input
                  name="nestRightName"
                  type="text"
                  value={heroDraft.nestRightName}
                  onChange={handleHeroFieldChange}
                  placeholder="右侧名字"
                  autoFocus
                />
                <input
                  name="nestRightAvatar"
                  type="text"
                  maxLength="2"
                  value={heroDraft.nestRightAvatar}
                  onChange={handleHeroFieldChange}
                  placeholder="头像字"
                />
              </div>
            ) : (
              <button className="plain-inline-trigger" type="button" onClick={() => setActiveHeroEditor("right")}>
                {settings.nestRightName || "小窝"}
              </button>
            )}
          </div>
        </div>

        <div className="nest-day-counter">{days}</div>
        {activeHeroEditor === "date" ? (
          <div className="nest-date-editor" onBlur={handleHeroEditorBlur} onKeyDown={handleHeroEditorKeyDown}>
            <input
              name="nestStartDate"
              type="date"
              value={heroDraft.nestStartDate}
              onChange={handleHeroFieldChange}
              autoFocus
            />
          </div>
        ) : (
          <button className="plain-inline-trigger nest-since-button" type="button" onClick={() => setActiveHeroEditor("date")}>
            SINCE {formatSinceDate(settings.nestStartDate)}
          </button>
        )}
        <div className="nest-pill">离下一个纪念点还有 {Math.max(0, 1000 - days)} 天</div>
      </section>

      <section className="nest-card daily-card">
        <div className="section-title-row">
          <span className="section-emoji">💌</span>
          <span className="section-title">今日小纸条</span>
        </div>
        <p className="daily-copy">
          今天也要好好吃饭、慢慢休息。
          <br />
          忙的时候记得回来看看这里，我们把喜欢的日常一点点存起来。
        </p>
        <p className="daily-sign">- 来自你的小窝</p>
      </section>

      <section className="nest-card checklist-card">
        <div className="card-header-row">
          <div className="section-title-row">
            <span className="section-emoji">🌿</span>
            <span className="section-title">请记住</span>
          </div>
        </div>

        <div className="checklist-groups">
          {checklistDraft.map((section) => (
            <div key={section.id} className="checklist-group">
              {activeChecklistEditor?.type === "section" && activeChecklistEditor.sectionId === section.id ? (
                <div className="checklist-inline-group-head" onBlur={handleChecklistTextBlur} onKeyDown={handleChecklistTextKeyDown}>
                  <input
                    className="checklist-inline-group-input"
                    type="text"
                    value={section.label}
                    onChange={(event) => handleSectionLabelChange(section.id, event.target.value)}
                    placeholder="分组标题"
                    autoFocus
                  />
                  <button className="ghost-button ghost-button-muted inline-mini-button" type="button" onClick={() => handleRemoveChecklistSection(section.id)}>
                    删组
                  </button>
                </div>
              ) : (
                <div className="checklist-inline-group-head">
                  <button
                    className="plain-inline-trigger checklist-label-trigger"
                    type="button"
                    onClick={() => setActiveChecklistEditor({ type: "section", sectionId: section.id })}
                  >
                    {section.label}
                  </button>
                </div>
              )}

              <div className="checklist-items">
                {section.items.map((item) =>
                  activeChecklistEditor?.type === "item" &&
                  activeChecklistEditor.sectionId === section.id &&
                  activeChecklistEditor.itemId === item.id ? (
                    <div key={item.id} className="checklist-inline-item-edit" onBlur={handleChecklistTextBlur} onKeyDown={handleChecklistTextKeyDown}>
                      <label className="checklist-inline-toggle">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleItem(section.id, item.id)}
                        />
                      </label>
                      <input
                        className="checklist-inline-item-input"
                        type="text"
                        value={item.label}
                        onChange={(event) => handleChecklistItemChange(section.id, item.id, event.target.value)}
                        placeholder="提醒内容"
                        autoFocus
                      />
                      <button className="ghost-button ghost-button-muted inline-mini-button" type="button" onClick={() => handleRemoveChecklistItem(section.id, item.id)}>
                        删除
                      </button>
                    </div>
                  ) : (
                    <div key={item.id} className="checklist-inline-read-row">
                      <button className="checklist-toggle-button" type="button" onClick={() => toggleItem(section.id, item.id)} aria-label={item.checked ? "取消勾选" : "勾选"}>
                        <span className={`checkbox-dot ${item.checked ? "checked" : ""}`}>
                          {item.checked ? "✓" : ""}
                        </span>
                      </button>
                      <button
                        className={`checklist-text-button ${item.checked ? "checked-text" : ""}`}
                        type="button"
                        onClick={() => handleChecklistTextClick(section.id, item.id)}
                        onDoubleClick={() => handleChecklistTextDoubleClick(section.id, item.id)}
                      >
                        {item.label}
                      </button>
                    </div>
                  )
                )}

                {activeChecklistEditor?.sectionId === section.id ? (
                  <button className="ghost-button checklist-add-button" type="button" onClick={() => handleAddChecklistItem(section.id)}>
                    新增提醒
                  </button>
                ) : null}
              </div>
            </div>
          ))}

          {activeChecklistEditor ? (
            <button className="ghost-button checklist-add-section-button" type="button" onClick={handleAddChecklistSection}>
              新增分组
            </button>
          ) : null}
        </div>
      </section>

      <section className="feature-grid">
        {nestFeatureCards.map((feature) => (
          <button
            key={feature.title}
            className={`feature-card feature-${feature.tone}`}
            type="button"
          >
            <span className="feature-emoji">{feature.emoji}</span>
            <div>
              <p className="feature-title">{feature.title}</p>
              <p className="feature-subtitle">{feature.subtitle}</p>
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}

function ChatScreen({
  settings,
  messages,
  input,
  pendingImage,
  isLoading,
  settingsOpen,
  profileEditorOpen,
  modeMenuOpen,
  messageListRef,
  textareaRef,
  imageInputRef,
  composerRef,
  setInput,
  setPendingImage,
  setSettingsOpen,
  setProfileEditorOpen,
  setModeMenuOpen,
  onBack,
  onSubmit,
  onSelectMode,
  onOpenSettings,
  onHandleImageInputChange
}) {
  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function handleAddImage() {
    imageInputRef.current?.click();
  }

  function handleRemovePendingImage() {
    setPendingImage(null);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function openProfileEditor() {
    setProfileEditorOpen(true);
  }

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <IconButton label="返回功能页" onClick={onBack}>
          <BackIcon />
        </IconButton>

        <div className="chat-title-wrap">
          <Avatar
            text={settings.contactAvatar || "AI"}
            image={settings.contactAvatarImage}
            clickable
            onClick={openProfileEditor}
            className="header-avatar"
            label="编辑对方头像和备注"
          />

          <button
            className="chat-title chat-title-button"
            type="button"
            onClick={openProfileEditor}
            aria-label="编辑备注和头像"
          >
            <p className="chat-subtitle">Chat</p>
            <h1>{settings.contactName || "联系人工助手"}</h1>
          </button>
        </div>

        <IconButton label="连接配置" onClick={() => setSettingsOpen(true)}>
          <MoreIcon />
        </IconButton>
      </header>

      <section className="messages-area">
        <div className="messages" ref={messageListRef}>
          {messages.map((message, index) => (
            <MessageGroup
              key={message.id}
              message={{
                ...message,
                avatar: message.role === "assistant" ? settings.contactAvatar || "AI" : "我",
                avatarImage: message.role === "assistant" ? settings.contactAvatarImage : ""
              }}
              previousMessage={messages[index - 1]}
              onAssistantAvatarClick={openProfileEditor}
            />
          ))}
        </div>
      </section>

      <form className="composer" ref={composerRef} onSubmit={onSubmit}>
        <ModeSwitchMenu
          open={modeMenuOpen}
          currentMode={settings.mode}
          onSelectMode={onSelectMode}
          onOpenSettings={onOpenSettings}
        />

        <button
          className="composer-icon"
          type="button"
          aria-label="添加图片"
          onClick={handleAddImage}
        >
          <PlusIcon />
        </button>

        <input
          ref={imageInputRef}
          className="hidden-input"
          type="file"
          accept="image/*"
          onChange={onHandleImageInputChange}
        />

        {pendingImage ? (
          <div className="pending-image-preview">
            <img src={pendingImage.dataUrl} alt={pendingImage.name || "待发送图片"} />
            <button
              className="pending-image-remove"
              type="button"
              aria-label="移除待发送图片"
              onClick={handleRemovePendingImage}
            >
              ×
            </button>
          </div>
        ) : null}

        <label className="composer-input-wrap" htmlFor="messageInput">
          <textarea
            id="messageInput"
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            rows="1"
            maxLength="4000"
            placeholder="发送消息..."
          />
        </label>

        <button
          className="mode-trigger"
          type="button"
          aria-label="切换模式"
          aria-haspopup="menu"
          aria-expanded={modeMenuOpen}
          onClick={() => setModeMenuOpen((open) => !open)}
        >
          <BoltIcon />
        </button>

        <button
          className="send-button"
          type="submit"
          aria-label="发送"
          disabled={isLoading || (!input.trim() && !pendingImage)}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

function BottomNav({ activeTab, onChange }) {
  const items = [
    { id: "chat", label: "聊天", icon: ChatTabIcon },
    { id: "nest", label: "小窝", icon: HomeTabIcon }
  ];

  return (
    <nav className="bottom-nav" aria-label="底部导航">
      <div className="bottom-nav-inner">
        {items.map((item) => {
          const active = item.id === activeTab;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              className={`bottom-nav-item ${active ? "active" : ""}`}
              type="button"
              onClick={() => onChange(item.id)}
            >
              <span className="bottom-nav-icon">
                <Icon />
              </span>
              <span className="bottom-nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function App() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("nest");
  const messageListRef = useRef(null);
  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);
  const composerRef = useRef(null);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) {
      return;
    }

    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    const node = messageListRef.current;
    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [messages, activeTab]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  useEffect(() => {
    if (!modeMenuOpen) {
      return;
    }

    function handlePointerDown(event) {
      if (!composerRef.current?.contains(event.target)) {
        setModeMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [modeMenuOpen]);

  function registerServiceWorker() {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  function handleSaveSettings(nextSettings) {
    const saved = saveSettings(nextSettings);
    setSettings(saved);
    setSettingsOpen(false);
  }

  function handleProfileUpdate(nextSettings) {
    const saved = saveSettings(nextSettings);
    setSettings(saved);
  }

  function handleNestHeroUpdate(nextSettings) {
    const saved = saveSettings(nextSettings);
    setSettings(saved);
  }

  function handleChecklistUpdate(nextChecklist) {
    const saved = saveSettings({ ...settings, nestChecklist: nextChecklist });
    setSettings(saved);
  }

  function handleSelectMode(mode) {
    const saved = saveSettings({ ...settings, mode });
    setSettings(saved);
    setModeMenuOpen(false);
  }

  function handleOpenModelSettings() {
    setModeMenuOpen(false);
    setSettingsOpen(true);
  }

  function handleImageInputChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = typeof reader.result === "string" ? reader.result : "";

      if (!imageDataUrl) {
        return;
      }

      setPendingImage({
        dataUrl: imageDataUrl,
        name: file.name
      });

      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();

    if ((!trimmed && !pendingImage) || isLoading) {
      return;
    }

    const timestamp = new Date().toISOString();
    const userMessages = [];

    if (pendingImage) {
      userMessages.push({
        id: createId(),
        role: "user",
        content: "",
        imageDataUrl: pendingImage.dataUrl,
        imageName: pendingImage.name,
        timestamp
      });
    }

    if (trimmed) {
      userMessages.push({
        id: createId(),
        role: "user",
        content: trimmed,
        timestamp
      });
    }

    const pendingMessage = {
      id: createId(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      pending: true
    };

    const nextMessages = [...messages, ...userMessages, pendingMessage];
    setMessages(nextMessages);
    setInput("");
    setPendingImage(null);
    setIsLoading(true);
    setActiveTab("chat");

    try {
      const reply = await getAssistantReply(
        nextMessages.filter((item) => !item.pending),
        settings
      );

      setMessages((current) =>
        current.map((message) =>
          message.id === pendingMessage.id
            ? {
                ...message,
                pending: false,
                content: reply,
                timestamp: new Date().toISOString()
              }
            : message
        )
      );
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingMessage.id
            ? {
                ...message,
                pending: false,
                content: `请求失败：${error.message || "未知错误"}`,
                timestamp: new Date().toISOString()
              }
            : message
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="app-shell">
        <main className="phone-frame">
          <div className="tab-screen">
            {activeTab === "chat" ? (
              <ChatScreen
                settings={settings}
                messages={messages}
                input={input}
                pendingImage={pendingImage}
                isLoading={isLoading}
                settingsOpen={settingsOpen}
                profileEditorOpen={profileEditorOpen}
                modeMenuOpen={modeMenuOpen}
                messageListRef={messageListRef}
                textareaRef={textareaRef}
                imageInputRef={imageInputRef}
                composerRef={composerRef}
                setInput={setInput}
                setPendingImage={setPendingImage}
                setSettingsOpen={setSettingsOpen}
                setProfileEditorOpen={setProfileEditorOpen}
                setModeMenuOpen={setModeMenuOpen}
                onBack={() => setActiveTab("nest")}
                onSubmit={handleSubmit}
                onSelectMode={handleSelectMode}
                onOpenSettings={handleOpenModelSettings}
                onHandleImageInputChange={handleImageInputChange}
              />
            ) : (
              <NestPage
                settings={settings}
                onSaveHeroSettings={handleNestHeroUpdate}
                onSaveChecklist={handleChecklistUpdate}
              />
            )}
          </div>

          {activeTab === "nest" ? <BottomNav activeTab={activeTab} onChange={setActiveTab} /> : null}
        </main>
      </div>

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
      <ProfileQuickEditor
        open={profileEditorOpen}
        settings={settings}
        onClose={() => setProfileEditorOpen(false)}
        onSave={handleProfileUpdate}
      />
    </>
  );
}
