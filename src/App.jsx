import { useEffect, useRef, useState } from "react";
import { getAssistantReply } from "./chat-client.js";
import { loadSettings, saveSettings } from "./storage.js";
import { useKeyboardCompat } from "./useKeyboardCompat.js";

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
  { id: "diary", title: "我们的日记", subtitle: "把细碎的开心都收进来", emoji: "📝", tone: "warm" },
  { id: "album", title: "记忆相册", subtitle: "留给以后反复翻看的瞬间", emoji: "🖼️", tone: "lavender" },
  { id: "plants", title: "我的植物", subtitle: "照料一座安静的小森林", emoji: "🪴", tone: "sage" },
  { id: "wishlist", title: "心愿清单", subtitle: "想做的事慢慢实现", emoji: "💍", tone: "rose" }
];

const statusMoodOptions = [
  { value: "晴朗", accent: "glow" },
  { value: "想念", accent: "rose" },
  { value: "轻松", accent: "mist" },
  { value: "心动", accent: "warm" }
];

const nestPlantSuggestions = [
  { emoji: "🪴", name: "绿萝", species: "黄金葛", days: 2, waterLevel: 0.34 },
  { emoji: "🌵", name: "多肉", species: "仙人掌科", days: 8, waterLevel: 0.78 },
  { emoji: "🌿", name: "薄荷", species: "Mentha", days: 1, waterLevel: 0.58 },
  { emoji: "🌼", name: "小雏菊", species: "Daisy", days: 4, waterLevel: 0.43 },
  { emoji: "🍀", name: "幸运草", species: "Oxalis", days: 6, waterLevel: 0.68 },
  { emoji: "🌸", name: "樱花", species: "Cherry Blossom", days: 3, waterLevel: 0.51 },
  { emoji: "🌺", name: "扶桑花", species: "Hibiscus", days: 5, waterLevel: 0.56 },
  { emoji: "🌻", name: "向日葵", species: "Sunflower", days: 7, waterLevel: 0.72 },
  { emoji: "🌷", name: "郁金香", species: "Tulipa", days: 2, waterLevel: 0.47 },
  { emoji: "🌱", name: "小芽", species: "Seedling", days: 1, waterLevel: 0.62 },
  { emoji: "🍃", name: "小叶子", species: "Leaf Vine", days: 4, waterLevel: 0.64 },
  { emoji: "🌾", name: "芦苇", species: "Reed Grass", days: 6, waterLevel: 0.53 },
  { emoji: "🪷", name: "睡莲", species: "Water Lily", days: 5, waterLevel: 0.69 },
  { emoji: "🫐", name: "蓝莓", species: "Blueberry", days: 3, waterLevel: 0.59 },
  { emoji: "🍓", name: "草莓", species: "Strawberry", days: 4, waterLevel: 0.61 }
];

function getStatusMoodAccent(moodValue) {
  return statusMoodOptions.find((mood) => mood.value === moodValue)?.accent || "glow";
}

function createPastTimestamp(hoursAgo) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function createStatusComment(id, authorName, authorHandle, content, hoursAgo, own = false) {
  return {
    id,
    authorName,
    authorHandle,
    content,
    timestamp: createPastTimestamp(hoursAgo),
    own
  };
}

const defaultStatusPosts = [
  {
    id: "status-1",
    author: "left",
    own: false,
    mood: "晴朗",
    content: "今天的风很轻，想到你就顺手把云也记下来了。等晚一点，我们去吃喜欢的那家小店吧。",
    imageDataUrl: "",
    imageName: "",
    timestamp: createPastTimestamp(2),
    likes: 18,
    comments: 0,
    commentsList: [],
    liked: false
  },
  {
    id: "status-2",
    author: "right",
    own: true,
    mood: "想念",
    content: "路过便利店的时候看见草莓牛奶，突然觉得平凡的一天也可以因为一句“到家了吗”变得很柔软。",
    imageDataUrl: "",
    imageName: "",
    timestamp: createPastTimestamp(11),
    likes: 27,
    comments: 0,
    commentsList: [],
    liked: true
  },
  {
    id: "status-3",
    author: "left",
    own: false,
    mood: "轻松",
    content: "把今天的小碎片放在这里存档：有认真吃饭，有记得喝水，也有偷偷想你很多次。",
    imageDataUrl: "",
    imageName: "",
    timestamp: createPastTimestamp(29),
    likes: 13,
    comments: 0,
    commentsList: [],
    liked: false
  }
];

function getDefaultStatusPosts() {
  return defaultStatusPosts.map((post) => ({
    ...post,
    commentsList: Array.isArray(post.commentsList) ? post.commentsList.map((comment) => ({ ...comment })) : []
  }));
}

function normalizeStatusComments(commentsList) {
  if (!Array.isArray(commentsList)) {
    return [];
  }

  return commentsList
    .map((comment, index) => {
      if (!comment || typeof comment !== "object") {
        return null;
      }

      return {
        id: comment.id || `comment-${index + 1}`,
        authorName: typeof comment.authorName === "string" && comment.authorName.trim() ? comment.authorName.trim() : "访客",
        authorHandle: typeof comment.authorHandle === "string" && comment.authorHandle.trim() ? comment.authorHandle.trim() : "guest",
        content: typeof comment.content === "string" ? comment.content : "",
        timestamp: typeof comment.timestamp === "string" ? comment.timestamp : new Date().toISOString(),
        own: Boolean(comment.own)
      };
    })
    .filter((comment) => comment && comment.content.trim());
}

function normalizeStatusPosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return getDefaultStatusPosts();
  }

  const nextPosts = posts
    .map((post, index) => {
      if (!post || typeof post !== "object") {
        return null;
      }

      const fallbackMood = statusMoodOptions[index % statusMoodOptions.length]?.value || "晴朗";
      const commentsList = normalizeStatusComments(post.commentsList);

      return {
        id: post.id || `status-${index + 1}`,
        author: post.author === "right" ? "right" : "left",
        own: typeof post.own === "boolean" ? post.own : post.author === "right",
        mood: typeof post.mood === "string" && post.mood.trim() ? post.mood.trim() : fallbackMood,
        content: typeof post.content === "string" ? post.content : "",
        imageDataUrl: typeof post.imageDataUrl === "string" ? post.imageDataUrl : "",
        imageName: typeof post.imageName === "string" ? post.imageName : "",
        timestamp: typeof post.timestamp === "string" ? post.timestamp : new Date().toISOString(),
        likes: Number.isFinite(post.likes) ? Math.max(0, post.likes) : 0,
        comments: commentsList.length,
        commentsList,
        liked: Boolean(post.liked)
      };
    })
    .filter((post) => post && (post.content.trim() || post.imageDataUrl));

  return nextPosts.length > 0 ? nextPosts : getDefaultStatusPosts();
}

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
  const [isTestingModel, setIsTestingModel] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    setDraft(settings);
    setTestResult(null);
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
    setTestResult(null);
  }

  function handleResetModel() {
    setDraft((current) => ({ ...current, model: "gpt-4o-mini" }));
    setTestResult(null);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave(draft);
  }

  async function handleTestModel() {
    setIsTestingModel(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/test-model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          settings: {
            apiKey: draft.apiKey,
            baseUrl: draft.baseUrl,
            chatPath: draft.chatPath,
            model: draft.model,
            systemPrompt: draft.systemPrompt
          }
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setTestResult({
          status: "error",
          message: data.error || `Request failed: ${response.status}`,
          endpoint: data.endpoint || draft.baseUrl,
          model: data.model || draft.model
        });
        return;
      }

      setTestResult({
        status: "success",
        message: data.content || "Model request succeeded.",
        endpoint: data.endpoint || draft.baseUrl,
        model: data.model || draft.model
      });
    } catch (error) {
      setTestResult({
        status: "error",
        message: error.message || "Model test failed.",
        endpoint: draft.baseUrl,
        model: draft.model
      });
    } finally {
      setIsTestingModel(false);
    }
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

        <button className="ghost-button ghost-button-muted" type="button" onClick={handleResetModel}>
          Reset Model to gpt-4o-mini
        </button>

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

        <div className="settings-action-row">
          <button
            className="ghost-button ghost-button-muted"
            type="button"
            onClick={handleTestModel}
            disabled={isTestingModel}
          >
            {isTestingModel ? "Testing..." : "Test Model"}
          </button>

          <button className="primary-button" type="submit">
            保存配置
          </button>
        </div>

        {testResult ? (
          <div className={`settings-test-result ${testResult.status}`}>
            <p className="settings-test-title">
              {testResult.status === "success" ? "Model Test Succeeded" : "Model Test Failed"}
            </p>
            <p className="settings-test-meta">Model: {testResult.model || "-"}</p>
            <p className="settings-test-meta">Endpoint: {testResult.endpoint || "-"}</p>
            <p className="settings-test-message">{testResult.message}</p>
          </div>
        ) : null}
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
            <h3 className="profile-name">{draft.contactName || "联系人助手"}</h3>
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
              placeholder="联系人助手"
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
                  <span>{draft.nestLeftAvatar || "A"}</span>
                )}
              </div>
              <div>
                <p className="session-label">左侧角色</p>
                <h3 className="profile-name">{draft.nestLeftName || "阿杉"}</h3>
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
                placeholder="阿杉"
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
                placeholder="A"
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
                  <span>{draft.nestRightAvatar || "B"}</span>
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
                placeholder="B"
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
          保存后会按你设置的起始日期重新计算天数；头像支持上传本地图片，不上传时会显示文字头像。
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
            <h2>提醒事项</h2>
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

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 7.5h14M9.5 7.5V5.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7M8.3 10.3v6.5M12 10.3v6.5M15.7 10.3v6.5M7.4 19.5h9.2c.8 0 1.4-.6 1.5-1.4l.7-10.6H5.2l.7 10.6c.1.8.7 1.4 1.5 1.4Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.5 18.5c-2.2 0-4-1.7-4-3.8V8.9c0-2.1 1.8-3.8 4-3.8h11c2.2 0 4 1.7 4 3.8v5.8c0 2.1-1.8 3.8-4 3.8H11l-4.5 3v-3H6.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m6 9 6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function getPlantStage(plant) {
  const growthScore = plant.days * 8 + plant.waterLevel * 100;

  if (growthScore >= 120) {
    return { label: "繁茂", emoji: "✨", tone: "mature" };
  }

  if (growthScore >= 80) {
    return { label: "生长", emoji: "🌿", tone: "growing" };
  }

  if (growthScore >= 40) {
    return { label: "幼苗", emoji: "🌱", tone: "sprout" };
  }

  return { label: "新芽", emoji: "🌰", tone: "seed" };
}

function formatGardenClock(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function StatusTabIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.5 7.5h11M6.5 12h7M6.5 16.5h9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.5 5.5h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6.2L8 21v-2.5H4.5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"
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

function formatStatusTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60)));
  if (diffMinutes < 1) {
    return "刚刚";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} 天前`;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getStatusProfile(settings) {
  return {
    name: "早",
    handle: "asa",
    avatar: settings.statusAvatar || "早",
    image: settings.statusAvatarImage || "",
    note: settings.statusLittleUpdate || "little updates",
    bio: settings.statusSignature || "把喜欢、心情和每天的小碎片，慢慢留在这里。"
  };
}

function getStatusAuthor(settings) {
  return getStatusProfile(settings);
}

function getNestDailyCard(settings) {
  return {
    content:
      settings.nestDailyNote ||
      "今天也要好好吃饭、慢慢休息。\n忙的时候记得回来看看这里，我们把喜欢的日常一点点存起来。",
    signature: settings.nestDailySign || "来自你的小窝"
  };
}

function createStatusPost({ content, mood, imageDataUrl = "", imageName = "", own = true }) {
  return {
    id: createId(),
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

function StatusProfileEditor({ open, settings, onClose, onSave }) {
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
      [name]: name === "statusAvatar" ? value.slice(0, 2) : value
    }));
  }

  function handleChooseImage() {
    fileInputRef.current?.click();
  }

  function handleRemoveImage() {
    setDraft((current) => ({
      ...current,
      statusAvatarImage: ""
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
        statusAvatarImage: typeof reader.result === "string" ? reader.result : ""
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
            <p className="settings-kicker">Status 编辑</p>
            <h2>个人页设置</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="profile-preview">
          <Avatar
            text={draft.statusAvatar || "早"}
            image={draft.statusAvatarImage}
            className="profile-avatar profile-avatar-large"
            label="状态页头像预览"
          />
          <div>
            <p className="session-label">状态主页</p>
            <h3 className="profile-name">早</h3>
            <p className="status-editor-handle">@asa</p>
          </div>
        </div>

        <div className="profile-fields">
          <label>
            头像文字
            <input
              name="statusAvatar"
              type="text"
              maxLength="2"
              value={draft.statusAvatar || ""}
              onChange={handleFieldChange}
              placeholder="早"
            />
          </label>

          <label>
            little updates
            <input
              name="statusLittleUpdate"
              type="text"
              maxLength="28"
              value={draft.statusLittleUpdate || ""}
              onChange={handleFieldChange}
              placeholder="little updates"
            />
          </label>

          <label>
            个人签名
            <textarea
              name="statusSignature"
              rows="3"
              maxLength="80"
              value={draft.statusSignature || ""}
              onChange={handleFieldChange}
              placeholder="把喜欢、心情和每天的小碎片，慢慢留在这里。"
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
          这里可以单独设置 Status 页头像、签名和顶部的小标签，不会影响聊天或小窝头像。
        </p>

        <button className="primary-button" type="submit">
          保存 Status 主页
        </button>
      </form>
    </dialog>
  );
}

function PlantComposerDialog({ open, onClose, onCreate }) {
  const dialogRef = useRef(null);
  const [draftName, setDraftName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(nestPlantSuggestions[0]?.emoji || "🪴");

  useEffect(() => {
    if (open) {
      setDraftName("");
      setSelectedEmoji(nestPlantSuggestions[0]?.emoji || "🪴");
    }
  }, [open]);

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

  function handleSubmit(event) {
    event.preventDefault();
    const preset = nestPlantSuggestions.find((plant) => plant.emoji === selectedEmoji) || nestPlantSuggestions[0];
    onCreate({
      emoji: selectedEmoji,
      name: draftName.trim() || preset.name,
      species: preset.species,
      days: 1,
      waterLevel: 0.62
    });
  }

  return (
    <dialog className="sheet-dialog plant-dialog" ref={dialogRef} onClose={onClose}>
      <form className="sheet-panel plant-dialog-panel" method="dialog" onSubmit={handleSubmit}>
        <div className="sheet-handle" aria-hidden="true"></div>
        <div className="sheet-header">
          <div>
            <p className="settings-kicker">Plant</p>
            <h2>种下新植物</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <label className="settings-field">
          <span>植物名字</span>
          <input
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="给它起个名字"
            maxLength="12"
          />
        </label>

        <div className="plant-picker-block">
          <span className="settings-field-label">选择植物</span>
          <div className="plant-emoji-picker" role="list" aria-label="选择植物图标">
            {nestPlantSuggestions.map((plant) => (
              <button
                key={`${plant.emoji}-${plant.name}`}
                className={`plant-emoji-option ${selectedEmoji === plant.emoji ? "active" : ""}`}
                type="button"
                onClick={() => setSelectedEmoji(plant.emoji)}
                title={plant.name}
              >
                <span>{plant.emoji}</span>
              </button>
            ))}
          </div>
        </div>

        <button className="primary-button plant-dialog-submit" type="submit">
          种下植物
        </button>
      </form>
    </dialog>
  );
}

function PlantGardenPage({ plants, gardenDays, feedItems, onBack, onOpenComposer, onWaterPlant, onDeletePlant }) {
  const healthyCount = plants.filter((plant) => plant.waterLevel >= 0.72).length;
  const thirstyCount = plants.filter((plant) => plant.waterLevel < 0.42).length;

  return (
    <section className="plant-garden-page">
      <div className="plant-garden-topbar">
        <button className="ghost-button plant-garden-back" type="button" onClick={onBack}>
          <BackIcon />
          <span>返回小窝</span>
        </button>
      </div>

      <header className="plant-garden-header">
        <div className="plant-garden-deco">🌿</div>
        <h2>小森林花园</h2>
        <p>A quiet place where little things grow</p>
      </header>

      <div className="plant-garden-toolbar">
        <div className="plant-season-pill">
          <span className="plant-season-dot"></span>
          <span>初夏 · 万物生长</span>
        </div>
        <button className="plant-primary-button" type="button" onClick={onOpenComposer}>
          <PlusIcon />
          <span>种下新植物</span>
        </button>
      </div>

      <div className="plant-stats-grid">
        <article className="plant-stat-card">
          <span className="plant-stat-number">{plants.length}</span>
          <span className="plant-stat-label">植物总数</span>
        </article>
        <article className="plant-stat-card">
          <span className="plant-stat-number">{healthyCount}</span>
          <span className="plant-stat-label">状态稳定</span>
        </article>
        <article className="plant-stat-card">
          <span className="plant-stat-number">{thirstyCount}</span>
          <span className="plant-stat-label">等待浇水</span>
        </article>
        <article className="plant-stat-card">
          <span className="plant-stat-number">{gardenDays}</span>
          <span className="plant-stat-label">花园天数</span>
        </article>
      </div>

      {plants.length > 0 ? (
        <div className="plant-garden-grid">
          {plants.map((plant) => {
            const stage = getPlantStage(plant);
            const waterPercent = Math.round(plant.waterLevel * 100);

            return (
              <article key={plant.id} className="garden-plant-card">
                <div className="garden-plant-head">
                  <div className="garden-plant-visual">{plant.emoji}</div>
                  <div className="garden-plant-meta">
                    <h3>{plant.name}</h3>
                    <p>{plant.species || "神秘植物"}</p>
                    <span className={`garden-stage-badge stage-${stage.tone}`}>{stage.emoji} {stage.label}</span>
                  </div>
                  <button className="garden-plant-remove" type="button" aria-label={`移除${plant.name}`} onClick={() => onDeletePlant(plant.id)}>
                    ×
                  </button>
                </div>

                <div className="garden-progress-section">
                  <div className="garden-progress-row">
                    <span>💧 水分状态</span>
                    <span>{waterPercent}%</span>
                  </div>
                  <div className="garden-progress-track">
                    <span className="garden-progress-fill water" style={{ width: `${waterPercent}%` }}></span>
                  </div>
                </div>

                <div className="garden-plant-footer">
                  <span className="garden-last-care">养了 {plant.days} 天</span>
                  <button className="garden-water-button" type="button" onClick={() => onWaterPlant(plant.id)}>
                    浇水
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="plant-garden-empty">
          <div className="plant-garden-empty-icon">🌱</div>
          <p>你的小森林还空着，点上面的按钮种下第一株植物吧。</p>
        </div>
      )}

      <section className="plant-feed-card">
        <div className="plant-feed-title">🍃 花园日志</div>
        <div className="plant-feed-list">
          {feedItems.map((item) => (
            <div key={item.id} className="plant-feed-item">
              <span className="plant-feed-time">{item.time}</span>
              <span className="plant-feed-icon">{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function NestPage({ settings, onSaveHeroSettings, onSaveChecklist, onSavePlants }) {
  const checklist = settings.nestChecklist || [];
  const plants = settings.nestPlants || [];
  const dailyCard = getNestDailyCard(settings);
  const nestPageRef = useRef(null);
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
  const [plantsDraft, setPlantsDraft] = useState(plants);
  const [activeHeroEditor, setActiveHeroEditor] = useState(null);
  const [activeChecklistEditor, setActiveChecklistEditor] = useState(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [activeNestView, setActiveNestView] = useState("home");
  const [plantComposerOpen, setPlantComposerOpen] = useState(false);
  const [plantFeed, setPlantFeed] = useState(() => [
    {
      id: createId(),
      time: "刚刚",
      icon: "🌿",
      text: "花园悄悄开门了，等待你的第一株植物。"
    }
  ]);

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
    setPlantsDraft(plants);
  }, [plants]);

  useEffect(() => {
    if (activeChecklistEditor) {
      setChecklistOpen(true);
    }
  }, [activeChecklistEditor]);

  useEffect(() => {
    return () => {
      if (checklistClickTimerRef.current) {
        window.clearTimeout(checklistClickTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeHeroEditor && !activeChecklistEditor) {
      return;
    }

    let frameId = 0;
    let settleTimeoutId = 0;

    function keepEditorInView() {
      const pageNode = nestPageRef.current;
      if (!pageNode) {
        return;
      }

      const focusedControl = pageNode.querySelector("input:focus, textarea:focus, select:focus");
      const target =
        focusedControl?.closest(".checklist-inline-item-edit, .checklist-inline-group-head, .nest-inline-editor, .nest-date-editor") ||
        focusedControl;

      if (!target) {
        return;
      }

      target.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "auto"
      });
    }

    frameId = window.requestAnimationFrame(keepEditorInView);
    settleTimeoutId = window.setTimeout(keepEditorInView, 180);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      window.clearTimeout(settleTimeoutId);
    };
  }, [activeHeroEditor, activeChecklistEditor]);

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

  function persistPlants(nextPlants) {
    setPlantsDraft(nextPlants);
    onSavePlants(nextPlants);
  }

  function pushPlantFeed(icon, text) {
    const nextEntry = {
      id: createId(),
      time: formatGardenClock(),
      icon,
      text
    };

    setPlantFeed((current) => [nextEntry, ...current].slice(0, 8));
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

  function handleAddPlant() {
    setPlantComposerOpen(true);
  }

  function handleCreatePlant(nextPlant) {
    const nextPlants = [
      ...plantsDraft,
      {
        id: createId(),
        emoji: nextPlant.emoji,
        name: nextPlant.name,
        species: nextPlant.species,
        days: nextPlant.days,
        waterLevel: nextPlant.waterLevel
      }
    ];

    persistPlants(nextPlants);
    setPlantComposerOpen(false);
    setActiveNestView("plants");
    pushPlantFeed("🌱", `种下了「${nextPlant.name}」，它开始在花园里慢慢长大。`);
  }

  function handleWaterPlant(plantId) {
    let wateredPlantName = "";
    const nextPlants = plantsDraft.map((plant) =>
      plant.id !== plantId
        ? plant
        : {
            ...plant,
            days: plant.days + 1,
            species: plant.species || "",
            name: (() => {
              wateredPlantName = plant.name;
              return plant.name;
            })(),
            waterLevel: Math.min(1, Math.round((plant.waterLevel + 0.22) * 100) / 100)
          }
    );

    persistPlants(nextPlants);
    if (wateredPlantName) {
      pushPlantFeed("💧", `给「${wateredPlantName}」浇了水，叶片看起来更有精神了。`);
    }
  }

  function handleDeletePlant(plantId) {
    const targetPlant = plantsDraft.find((plant) => plant.id === plantId);
    const nextPlants = plantsDraft.filter((plant) => plant.id !== plantId);
    persistPlants(nextPlants);
    if (targetPlant) {
      pushPlantFeed("🍂", `「${targetPlant.name}」离开了花园，愿它在别处继续生长。`);
    }
  }

  const previewHero = activeHeroEditor ? heroDraft : settings;
  const days = daysSince(previewHero.nestStartDate);

  if (activeNestView === "plants") {
    return (
      <>
        <PlantGardenPage
          plants={plantsDraft}
          gardenDays={Math.max(days, 1)}
          feedItems={plantFeed}
          onBack={() => setActiveNestView("home")}
          onOpenComposer={() => setPlantComposerOpen(true)}
          onWaterPlant={handleWaterPlant}
          onDeletePlant={handleDeletePlant}
        />
        <PlantComposerDialog
          open={plantComposerOpen}
          onClose={() => setPlantComposerOpen(false)}
          onCreate={handleCreatePlant}
        />
      </>
    );
  }

  return (
    <>
      <div className="nest-page" ref={nestPageRef}>
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

      <section className="nest-hero">
        <div className="nest-avatars">
          <div className="nest-avatar-stack">
            <button className="nest-avatar-button" type="button" onClick={() => handleChooseHeroImage("left")}>
              <div className="nest-mini-avatar">
                {previewHero.nestLeftAvatarImage ? (
                  <img className="avatar-image" src={previewHero.nestLeftAvatarImage} alt={previewHero.nestLeftName || "左侧头像"} />
                ) : (
                  <span>{previewHero.nestLeftAvatar || "A"}</span>
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
                {settings.nestLeftName || "阿杉"}
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
                  <span>{previewHero.nestRightAvatar || "B"}</span>
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
        <p className="daily-copy">{dailyCard.content}</p>
        <p className="daily-sign">- {dailyCard.signature}</p>
      </section>

      <section className="nest-card checklist-card">
        <button
          className={`checklist-accordion-trigger ${checklistOpen ? "open" : ""}`}
          type="button"
          onClick={() => setChecklistOpen((current) => !current)}
          aria-expanded={checklistOpen}
        >
          <div className="section-title-row">
            <span className="section-emoji">🌷</span>
            <span className="section-title">请记住</span>
          </div>
          <span className="checklist-accordion-icon" aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </button>

        {checklistOpen ? (
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
        ) : null}
      </section>

      <section className="feature-grid">
        {nestFeatureCards.map((feature) => (
          <button
            key={feature.id}
            className={`feature-card feature-${feature.tone}`}
            type="button"
            onClick={() => {
              if (feature.id === "plants") {
                setActiveNestView("plants");
              }
            }}
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
      <PlantComposerDialog
        open={plantComposerOpen}
        onClose={() => setPlantComposerOpen(false)}
        onCreate={handleCreatePlant}
      />
    </>
  );
}

function StatusComposerDialog({
  open,
  onClose,
  draft,
  pendingImage,
  activeMood,
  authorName,
  authorHandle,
  authorAvatar,
  authorAvatarImage,
  onDraftChange,
  onImageChange,
  onRemoveImage,
  onMoodChange,
  onPublish
}) {
  const dialogRef = useRef(null);
  const imageInputRef = useRef(null);

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

  function handleChooseImage() {
    imageInputRef.current?.click();
  }

  return (
    <dialog className="sheet-dialog status-compose-dialog" ref={dialogRef} onClose={onClose}>
      <form
        className="sheet-panel status-compose-panel"
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onPublish();
        }}
      >
        <div className="sheet-handle" aria-hidden="true"></div>

        <div className="sheet-header">
          <div>
            <p className="settings-kicker">发状态</p>
            <h2>写一条新的贴文</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="status-composer-head status-composer-head-dialog">
          <div className="status-author-block">
            <Avatar
              text={authorAvatar}
              image={authorAvatarImage}
              className="status-avatar status-avatar-large"
              label={authorName}
            />
            <div>
              <p className="status-author-name">{authorName}</p>
              <p className="status-author-tip">@{authorHandle} · 轻轻写下一条今天的状态</p>
            </div>
          </div>
          <span className="status-draft-badge">贴文模块</span>
        </div>

        <div className="status-mood-row" role="list" aria-label="选择状态心情">
          {statusMoodOptions.map((mood) => (
            <button
              key={mood.value}
              className={`status-mood-chip status-mood-${mood.accent} ${activeMood === mood.value ? "active" : ""}`}
              type="button"
              onClick={() => onMoodChange(mood.value)}
            >
              #{mood.value}
            </button>
          ))}
        </div>

        <div className="status-compose-tools">
          <button className="ghost-button" type="button" onClick={handleChooseImage}>
            添加图片
          </button>
          <input
            ref={imageInputRef}
            className="hidden-input"
            type="file"
            accept="image/*"
            onChange={onImageChange}
          />
        </div>

        {pendingImage ? (
          <div className="status-image-preview">
            <img src={pendingImage.dataUrl} alt={pendingImage.name || "待发送图片"} />
            <button
              className="status-image-remove"
              type="button"
              aria-label="移除待发送图片"
              onClick={onRemoveImage}
            >
              ×
            </button>
          </div>
        ) : null}

        <textarea
          className="status-textarea"
          rows="5"
          maxLength="240"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="记录一句今天想留下的话，比如此刻的心情、见到的风景，或者突然想告诉对方的小事。"
        />

        <div className="status-composer-footer">
          <p className="status-hint">已输入 {draft.trim().length} / 240 字</p>
          <button className="status-publish-button" type="submit" disabled={!draft.trim() && !pendingImage}>
            发布状态
          </button>
        </div>
      </form>
    </dialog>
  );
}

function StatusPage({ settings, onSaveStatusPosts, onSaveStatusProfile }) {
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [activeMood, setActiveMood] = useState(statusMoodOptions[0].value);
  const [posts, setPosts] = useState(() => normalizeStatusPosts(settings.statusPosts));
  const [composerOpen, setComposerOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const statusProfile = getStatusProfile(settings);
  const totalLikes = posts.reduce((sum, post) => sum + post.likes, 0);

  useEffect(() => {
    setPosts(normalizeStatusPosts(settings.statusPosts));
  }, [settings.statusPosts]);

  function persistPosts(nextPosts) {
    setPosts(nextPosts);
    onSaveStatusPosts(nextPosts);
  }

  function handlePublish() {
    const content = draft.trim();
    if (!content && !pendingImage) {
      return;
    }

    const nextPosts = [
      createStatusPost({
        content,
        mood: activeMood,
        imageDataUrl: pendingImage?.dataUrl || "",
        imageName: pendingImage?.name || ""
      }),
      ...posts
    ];

    persistPosts(nextPosts);
    setDraft("");
    setPendingImage(null);
    setComposerOpen(false);
  }

  function handleStatusImageChange(event) {
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
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveStatusImage() {
    setPendingImage(null);
  }

  function handleToggleLike(postId) {
    const nextPosts = posts.map((post) =>
      post.id !== postId
        ? post
        : {
            ...post,
            liked: !post.liked,
            likes: Math.max(0, post.likes + (post.liked ? -1 : 1))
          }
    );

    persistPosts(nextPosts);
  }

  function handleDeletePost(postId) {
    const nextPosts = posts.filter((post) => post.id !== postId);
    persistPosts(nextPosts);
  }

  function handleToggleComments(postId) {
    setExpandedComments((current) => ({
      ...current,
      [postId]: !current[postId]
    }));
  }

  function handleCommentDraftChange(postId, value) {
    setCommentDrafts((current) => ({
      ...current,
      [postId]: value
    }));
  }

  function handleAddComment(postId) {
    const content = (commentDrafts[postId] || "").trim();
    if (!content) {
      return;
    }

    const nextPosts = posts.map((post) => {
      if (post.id !== postId) {
        return post;
      }

      const nextCommentsList = [
        ...post.commentsList,
        {
          id: createId(),
          authorName: "我",
          authorHandle: "me",
          content,
          timestamp: new Date().toISOString(),
          own: true
        }
      ];

      return {
        ...post,
        commentsList: nextCommentsList,
        comments: nextCommentsList.length
      };
    });

    persistPosts(nextPosts);
    setExpandedComments((current) => ({ ...current, [postId]: true }));
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
  }

  function handleDeleteComment(postId, commentId) {
    const nextPosts = posts.map((post) => {
      if (post.id !== postId) {
        return post;
      }

      const nextCommentsList = post.commentsList.filter((comment) => comment.id !== commentId);
      return {
        ...post,
        commentsList: nextCommentsList,
        comments: nextCommentsList.length
      };
    });

    persistPosts(nextPosts);
  }

  return (
    <>
      <div className="status-page">
        <section className="nest-card status-hero-card">
          <button
            className="status-edit-profile-button"
            type="button"
            onClick={() => setProfileEditorOpen(true)}
          >
            编辑主页
          </button>

          <button
            className="status-open-composer-button"
            type="button"
            aria-label="发布状态"
            onClick={() => setComposerOpen(true)}
          >
            <PlusIcon />
          </button>

          <div className="status-hero-top">
            <p className="status-kicker">Status</p>
            <div className="status-floating-note">{statusProfile.note}</div>
            <Avatar
              text={statusProfile.avatar}
              image={statusProfile.image}
              className="status-avatar status-hero-avatar"
              clickable
              onClick={() => setProfileEditorOpen(true)}
              label="编辑 Status 头像"
            />
            <div className="status-profile-copy">
              <h2 className="status-title">{statusProfile.name}</h2>
              <p className="status-handle">@{statusProfile.handle}</p>
              <p className="status-subtitle">{statusProfile.bio}</p>
            </div>

            <div className="status-sections" aria-label="状态分区">
              <button className="status-section-pill" type="button">
                说说
              </button>
              <button className="status-section-pill active" type="button">
                动态
              </button>
              <button className="status-section-pill" type="button">
                相册
              </button>
            </div>

            <div className="status-stats">
              <div className="status-stat-pill">
                <span className="status-stat-value">{totalLikes}</span>
                <span className="status-stat-label">累计点赞</span>
              </div>
              <div className="status-stat-pill">
                <span className="status-stat-value">{posts.length}</span>
                <span className="status-stat-label">状态数量</span>
              </div>
              <div className="status-stat-pill">
                <span className="status-stat-value">{activeMood}</span>
                <span className="status-stat-label">今日气泡</span>
              </div>
            </div>
          </div>
        </section>

        <section className="status-feed" aria-label="状态贴文列表">
          {posts.map((post) => {
            const author = getStatusAuthor(settings);
            const deletable = Boolean(post.own);
            const commentsOpen = Boolean(expandedComments[post.id]);

            return (
              <article key={post.id} className="nest-card status-card">
                <div className="status-card-head">
                  <div className="status-author-block">
                    <Avatar
                      text={author.avatar}
                      image={author.image}
                      className="status-avatar"
                      label={author.name}
                    />
                    <div>
                      <p className="status-author-name">{author.name}</p>
                      <p className="status-time">@{author.handle} · {formatStatusTime(post.timestamp)}</p>
                    </div>
                  </div>

                  <div className="status-card-tools">
                    {deletable ? (
                      <button
                        className="status-delete-button"
                        type="button"
                        aria-label="删除这条状态"
                        onClick={() => handleDeletePost(post.id)}
                      >
                        <TrashIcon />
                      </button>
                    ) : null}
                    <span className={`status-tag status-mood-${getStatusMoodAccent(post.mood)}`}>#{post.mood}</span>
                  </div>
                </div>

                {post.content ? <p className="status-content">{post.content}</p> : null}
                {post.imageDataUrl ? (
                  <img
                    className="status-post-image"
                    src={post.imageDataUrl}
                    alt={post.imageName || "状态贴文图片"}
                  />
                ) : null}

                <div className="status-card-footer">
                  <div className="status-action-row">
                    <button
                      className={`status-action ${post.liked ? "active" : ""}`}
                      type="button"
                      onClick={() => handleToggleLike(post.id)}
                    >
                      <span className={`status-heart ${post.liked ? "active" : ""}`}>{post.liked ? "♥" : "♡"}</span>
                      <span>{post.likes}</span>
                    </button>
                    <button
                      className={`status-action ${commentsOpen ? "active" : ""}`}
                      type="button"
                      aria-label="评论入口"
                      onClick={() => handleToggleComments(post.id)}
                    >
                      <CommentIcon />
                      <span>{post.comments}</span>
                    </button>
                  </div>
                  <div className="status-meta">
                    <span>{post.comments} 条回应</span>
                  </div>
                </div>

                {commentsOpen ? (
                  <section className="status-comments-panel" aria-label="评论区">
                    <div className="status-comments-list">
                      {post.commentsList.length > 0 ? (
                        post.commentsList.map((comment) => (
                          <article key={comment.id} className="status-comment-item">
                            <div className={`status-comment-avatar ${comment.own ? "own" : ""}`}>
                              {comment.own ? "我" : "早"}
                            </div>
                            <div className="status-comment-body">
                              <div className="status-comment-head">
                                <div className="status-comment-meta">
                                  <span className="status-comment-author">{comment.authorName}</span>
                                  <span className="status-comment-time">
                                    @{comment.authorHandle} · {formatStatusTime(comment.timestamp)}
                                  </span>
                                </div>
                                {comment.own ? (
                                  <button
                                    className="status-comment-delete"
                                    type="button"
                                    aria-label="删除这条评论"
                                    onClick={() => handleDeleteComment(post.id, comment.id)}
                                  >
                                    <TrashIcon />
                                  </button>
                                ) : null}
                              </div>
                              <p className="status-comment-content">{comment.content}</p>
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="status-comments-empty">还没有评论，来留下第一句吧。</p>
                      )}
                    </div>

                    <div className="status-comment-composer">
                      <div className="status-comment-avatar own">我</div>
                      <div className="status-comment-input-wrap">
                        <input
                          className="status-comment-input"
                          type="text"
                          maxLength="120"
                          value={commentDrafts[post.id] || ""}
                          onChange={(event) => handleCommentDraftChange(post.id, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleAddComment(post.id);
                            }
                          }}
                          placeholder="友善的评论是交流的起点"
                        />
                        <button
                          className="status-comment-submit"
                          type="button"
                          onClick={() => handleAddComment(post.id)}
                          disabled={!(commentDrafts[post.id] || "").trim()}
                        >
                          发送
                        </button>
                      </div>
                    </div>
                  </section>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>

      <StatusComposerDialog
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        draft={draft}
        pendingImage={pendingImage}
        activeMood={activeMood}
        authorName={statusProfile.name}
        authorHandle={statusProfile.handle}
        authorAvatar={statusProfile.avatar}
        authorAvatarImage={statusProfile.image}
        onDraftChange={setDraft}
        onImageChange={handleStatusImageChange}
        onRemoveImage={handleRemoveStatusImage}
        onMoodChange={setActiveMood}
        onPublish={handlePublish}
      />
      <StatusProfileEditor
        open={profileEditorOpen}
        settings={settings}
        onClose={() => setProfileEditorOpen(false)}
        onSave={onSaveStatusProfile}
      />
    </>
  );
}

function ChatScreen({
  settings,
  messages,
  input,
  pendingImage,
  isLoading,
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
  onComposerPointerDown,
  onBack,
  onSubmit,
  onSelectMode,
  onOpenSettings,
  onImageInputChange
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
            <h1>{settings.contactName || "联系人助手"}</h1>
          </button>
        </div>

        <IconButton label="连接设置" onClick={() => setSettingsOpen(true)}>
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
          onChange={onImageInputChange}
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

        <div className="composer-pill">
          <label
            className="composer-input-wrap"
            htmlFor="messageInput"
            onPointerDown={onComposerPointerDown}
          >
            <textarea
              id="messageInput"
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows="1"
              maxLength="4000"
              placeholder="⊹ ♡┈┈ 𓏴 𝒫𝒾𝓃𝓀 𝒱𝑒𝓁𝓋𝑒𝓉 𓏴 ┈┈♡ ⊹"
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
        </div>

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
    { id: "nest", label: "小窝", icon: HomeTabIcon },
    { id: "status", label: "状态", icon: StatusTabIcon }
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
  const settingsRef = useRef(settings);
  const { onComposerPointerDown } = useKeyboardCompat({
    activeTab,
    composerRef,
    input,
    messageListRef,
    messages,
    textareaRef
  });

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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

  function handleNestPlantsUpdate(nextPlants) {
    const saved = saveSettings({ ...settings, nestPlants: nextPlants });
    setSettings(saved);
  }

  function handleStatusPostsUpdate(nextPosts) {
    const saved = saveSettings({ ...settings, statusPosts: nextPosts });
    setSettings(saved);
  }

  function handleStatusProfileUpdate(nextSettings) {
    const saved = saveSettings(nextSettings);
    setSettings(saved);
  }

  function buildAssistantAppContext(currentSettings) {
    const dailyCard = getNestDailyCard(currentSettings);
    return {
      dailyNote: dailyCard,
      plants: (currentSettings.nestPlants || []).map((plant) => ({
        id: plant.id,
        name: plant.name,
        species: plant.species,
        waterLevel: plant.waterLevel,
        days: plant.days
      })),
      statusProfile: getStatusProfile(currentSettings),
      allowedStatusMoods: statusMoodOptions.map((mood) => mood.value)
    };
  }

  function applyAssistantActions(actions) {
    if (!actions || typeof actions !== "object") {
      return;
    }

    let nextSettings = settingsRef.current;
    let hasUpdates = false;

    if (actions.dailyNote && typeof actions.dailyNote === "object") {
      const nextContent =
        typeof actions.dailyNote.content === "string" && actions.dailyNote.content.trim()
          ? actions.dailyNote.content.trim()
          : nextSettings.nestDailyNote;
      const nextSignature =
        typeof actions.dailyNote.signature === "string" && actions.dailyNote.signature.trim()
          ? actions.dailyNote.signature.trim()
          : nextSettings.nestDailySign;

      if (
        nextContent !== nextSettings.nestDailyNote ||
        nextSignature !== nextSettings.nestDailySign
      ) {
        nextSettings = saveSettings({
          ...nextSettings,
          nestDailyNote: nextContent,
          nestDailySign: nextSignature
        });
        hasUpdates = true;
      }
    }

    if (actions.waterPlant && typeof actions.waterPlant === "object") {
      const targetName =
        typeof actions.waterPlant.name === "string" ? actions.waterPlant.name.trim() : "";
      const targetId =
        typeof actions.waterPlant.id === "string" ? actions.waterPlant.id.trim() : "";
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

        nextSettings = saveSettings({
          ...nextSettings,
          nestPlants: nextPlants
        });
        hasUpdates = true;
      }
    }

    if (actions.createStatus && typeof actions.createStatus === "object") {
      const nextContent =
        typeof actions.createStatus.content === "string"
          ? actions.createStatus.content.trim()
          : "";
      const nextMood = statusMoodOptions.some((mood) => mood.value === actions.createStatus.mood)
        ? actions.createStatus.mood
        : statusMoodOptions[0].value;

      if (nextContent) {
        const nextPosts = [
          createStatusPost({
            content: nextContent,
            mood: nextMood
          }),
          ...normalizeStatusPosts(nextSettings.statusPosts)
        ];

        nextSettings = saveSettings({
          ...nextSettings,
          statusPosts: nextPosts
        });
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      setSettings(nextSettings);
    }
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
        settings,
        buildAssistantAppContext(settingsRef.current)
      );
      const replyContent =
        typeof reply === "string" ? reply : reply?.content || "我已经帮你处理好了。";
      const replyActions = typeof reply === "string" ? null : reply?.actions || null;

      if (replyActions) {
        applyAssistantActions(replyActions);
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === pendingMessage.id
            ? {
                ...message,
                pending: false,
                content: replyContent,
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
      <div className={`app-shell app-shell-${activeTab}`}>
        <main className={`phone-frame phone-frame-${activeTab}`}>
          <div className="tab-screen">
            {activeTab === "chat" ? (
              <ChatScreen
                settings={settings}
                messages={messages}
                input={input}
                pendingImage={pendingImage}
                isLoading={isLoading}
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
                onComposerPointerDown={onComposerPointerDown}
                onBack={() => setActiveTab("nest")}
                onSubmit={handleSubmit}
                onSelectMode={handleSelectMode}
                onOpenSettings={handleOpenModelSettings}
                onImageInputChange={handleImageInputChange}
              />
            ) : activeTab === "status" ? (
              <StatusPage
                settings={settings}
                onSaveStatusPosts={handleStatusPostsUpdate}
                onSaveStatusProfile={handleStatusProfileUpdate}
              />
            ) : (
              <NestPage
                settings={settings}
                onSaveHeroSettings={handleNestHeroUpdate}
                onSaveChecklist={handleChecklistUpdate}
                onSavePlants={handleNestPlantsUpdate}
              />
            )}
          </div>

          {activeTab !== "chat" ? <BottomNav activeTab={activeTab} onChange={setActiveTab} /> : null}
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
