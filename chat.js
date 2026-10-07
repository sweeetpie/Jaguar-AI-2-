/* =========================================================
   Jaguar AI 2 — chat.js
   Frontend controller for index.html
   ========================================================= */

(() => {
  "use strict";

  const GATEWAY_BASE = "https://ai-gateway.vercel.sh/v1";
  const MODELS_URL = `${GATEWAY_BASE}/models`;
  const CHAT_URL = `${GATEWAY_BASE}/chat/completions`;

  const $ = (id) => document.getElementById(id);

  const messagesEl = $("messages");
  const modelEl = $("model");
  const modeEl = $("mode");
  const statusEl = $("status");

  const apiKeyEl = $("apiKey");
  const themeEl = $("theme");
  const reasoningEl = $("reasoning");
  const compactEl = $("compact");

  const fileInput = $("fileInput");
  const imageInput = $("imageInput");

  const sendBtn = $("send");
  const promptEl = $("prompt");

  let models = [];
  let conversations = [];
  let currentConversationId = null;

  let attachedFiles = [];
  let attachedImages = [];

  /* ---------------------------------------------------------
     Storage
     --------------------------------------------------------- */

  const STORAGE = {
    apiKey: "jaguar_ai_2_api_key",
    theme: "jaguar_ai_2_theme",
    reasoning: "jaguar_ai_2_reasoning",
    compact: "jaguar_ai_2_compact",
    conversations: "jaguar_ai_2_conversations"
  };

  function loadStorage() {
    try {
      if (apiKeyEl) {
        apiKeyEl.value = localStorage.getItem(STORAGE.apiKey) || "";
      }

      if (themeEl) {
        themeEl.value =
          localStorage.getItem(STORAGE.theme) ||
          document.documentElement.dataset.theme ||
          "brown";
      }

      if (reasoningEl) {
        reasoningEl.value =
          localStorage.getItem(STORAGE.reasoning) || "medium";
      }

      if (compactEl) {
        compactEl.checked =
          localStorage.getItem(STORAGE.compact) === "true";
      }

      const saved = localStorage.getItem(STORAGE.conversations);

      if (saved) {
        conversations = JSON.parse(saved);

        if (!Array.isArray(conversations)) {
          conversations = [];
        }
      }
    } catch (err) {
      console.warn("Storage load failed:", err);
      conversations = [];
    }

    applyTheme();
  }

  function saveStorage() {
    try {
      if (apiKeyEl) {
        localStorage.setItem(STORAGE.apiKey, apiKeyEl.value.trim());
      }

      if (themeEl) {
        localStorage.setItem(STORAGE.theme, themeEl.value);
      }

      if (reasoningEl) {
        localStorage.setItem(STORAGE.reasoning, reasoningEl.value);
      }

      if (compactEl) {
        localStorage.setItem(STORAGE.compact, compactEl.checked);
      }

      localStorage.setItem(
        STORAGE.conversations,
        JSON.stringify(conversations)
      );
    } catch (err) {
      console.warn("Storage save failed:", err);
    }
  }

  /* ---------------------------------------------------------
     Theme
     --------------------------------------------------------- */

  function applyTheme() {
    const theme =
      themeEl?.value ||
      localStorage.getItem(STORAGE.theme) ||
      "brown";

    if (theme === "brown") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = theme;
    }

    if (compactEl?.checked) {
      document.body.classList.add("compact");
    } else {
      document.body.classList.remove("compact");
    }
  }

  /* ---------------------------------------------------------
     Conversations
     --------------------------------------------------------- */

  function createConversation() {
    const conversation = {
      id:
        "chat_" +
        Date.now() +
        "_" +
        Math.random().toString(36).slice(2, 8),

      title: "New conversation",

      messages: [],

      createdAt: Date.now(),

      updatedAt: Date.now()
    };

    conversations.unshift(conversation);
    currentConversationId = conversation.id;

    saveStorage();

    return conversation;
  }

  function getCurrentConversation() {
    return conversations.find(
      (c) => c.id === currentConversationId
    );
  }

  function ensureConversation() {
    let conversation = getCurrentConversation();

    if (!conversation) {
      conversation = createConversation();
    }

    return conversation;
  }

  function updateConversationTitle(text) {
    const conversation = getCurrentConversation();

    if (!conversation) return;

    const clean = String(text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) return;

    conversation.title =
      clean.length > 42
        ? clean.slice(0, 42) + "…"
        : clean;

    conversation.updatedAt = Date.now();

    saveStorage();
  }

  /* ---------------------------------------------------------
     Rendering
     --------------------------------------------------------- */

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function simpleMarkdown(text) {
    let html = escapeHTML(text);

    html = html.replace(
      /```([\w+-]*)\n?([\s\S]*?)```/g,
      (_, lang, code) => {
        const language = lang || "code";

        return `
          <div class="code-wrap">
            <div class="codebar">
              <span>${escapeHTML(language)}</span>
              <div class="code-actions">
                <button class="copy-code" type="button">Copy</button>
                <button class="download-code" type="button">Download</button>
              </div>
            </div>
            <pre><code data-language="${escapeHTML(
              language
            )}">${code}</code></pre>
          </div>
        `;
      }
    );

    html = html.replace(
      /`([^`\n]+)`/g,
      "<code>$1</code>"
    );

    html = html.replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );

    html = html.replace(
      /\*(.+?)\*/g,
      "<em>$1</em>"
    );

    html = html.replace(
      /^### (.+)$/gm,
      "<h3>$1</h3>"
    );

    html = html.replace(
      /^## (.+)$/gm,
      "<h2>$1</h2>"
    );

    html = html.replace(
      /^# (.+)$/gm,
      "<h1>$1</h1>"
    );

    html = html.replace(
      /^\s*[-*] (.+)$/gm,
      "<li>$1</li>"
    );

    html = html.replace(
      /(<li>.*<\/li>)/gs,
      "<ul>$1</ul>"
    );

    html = html.replace(
      /\n{2,}/g,
      "</p><p>"
    );

    html = html.replace(
      /\n/g,
      "<br>"
    );

    return `<p>${html}</p>`;
  }

  function addMessage(role, content, extra = {}) {
    if (!messagesEl) return null;

    const welcome = messagesEl.querySelector(".welcome");

    if (welcome) {
      welcome.remove();
    }

    const row = document.createElement("div");

    row.className =
      "message-row " +
      (role === "user" ? "user-row" : "assistant-row");

    const bubble = document.createElement("div");

    bubble.className =
      "message " +
      (role === "user" ? "user-message" : "assistant-message");

    bubble.dataset.role = role;

    if (extra.id) {
      bubble.dataset.messageId = extra.id;
    }

    const body = document.createElement("div");

    body.className = "message-body";

    if (extra.html) {
      body.innerHTML = extra.html;
    } else if (role === "assistant") {
      body.innerHTML = simpleMarkdown(content);
    } else {
      body.textContent = content;
    }

    bubble.appendChild(body);

    const actions = document.createElement("div");

    actions.className = "msg-actions";

    if (role === "assistant") {
      actions.innerHTML = `
        <button type="button" data-action="copy">Copy</button>
        <button type="button" data-action="retry">Retry</button>
      `;
    } else {
      actions.innerHTML = `
        <button type="button" data-action="edit">Edit</button>
      `;
    }

    bubble.appendChild(actions);

    row.appendChild(bubble);
    messagesEl.appendChild(row);

    bindMessageActions(row);

    scrollMessages();

    return bubble;
  }

  function scrollMessages() {
    if (!messagesEl) return;

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function clearMessages() {
    if (!messagesEl) return;

    messagesEl.innerHTML = `
      <div class="welcome">
        <div style="font-size:68px;line-height:1">🐆</div>
        <h1>Jaguar AI 2</h1>
        <p>
          Chat, code, create images and prepare videos
          with the Vercel AI Gateway.
        </p>
        <div class="quick">
          <button data-q="Build a complete responsive HTML, CSS and JavaScript page">
            Build a website
          </button>
          <button data-q="Explain this code step by step">
            Explain code
          </button>
          <button data-q="Give me five creative image prompts">
            Creative ideas
          </button>
        </div>
      </div>
    `;

    bindQuickButtons();
  }

  function renderConversation() {
    const conversation = getCurrentConversation();

    clearMessages();

    if (!conversation) return;

    for (const message of conversation.messages) {
      if (message.role === "user") {
        addMessage("user", message.content);
      } else if (message.role === "assistant") {
        addMessage("assistant", message.content);
      }
    }
  }

  /* ---------------------------------------------------------
     Message actions
     --------------------------------------------------------- */

  function bindMessageActions(row) {
    row.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.action;

        const bubble = row.querySelector(".message");
        const body = row.querySelector(".message-body");

        if (!bubble || !body) return;

        if (action === "copy") {
          const text = body.innerText || "";

          await copyText(text);

          button.textContent = "Copied";

          setTimeout(() => {
            button.textContent = "Copy";
          }, 1200);
        }

        if (action === "edit") {
          const text = body.innerText || "";

          if (promptEl) {
            promptEl.value = text;
            promptEl.focus();

            autoResizePrompt();
          }

          const conversation = getCurrentConversation();

          if (conversation) {
            const index = conversation.messages.findIndex(
              (m) =>
                m.role === "user" &&
                m.content === text
            );

            if (index !== -1) {
              conversation.messages =
                conversation.messages.slice(0, index);

              saveStorage();
              renderConversation();
            }
          }
        }

        if (action === "retry") {
          retryLastAssistant();
        }
      });
    });

    row.querySelectorAll(".copy-code").forEach((button) => {
      button.addEventListener("click", async () => {
        const code =
          button.closest(".code-wrap")
            ?.querySelector("code")
            ?.textContent || "";

        await copyText(code);

        button.textContent = "Copied";

        setTimeout(() => {
          button.textContent = "Copy";
        }, 1200);
      });
    });

    row.querySelectorAll(".download-code").forEach((button) => {
      button.addEventListener("click", () => {
        const code =
          button.closest(".code-wrap")
            ?.querySelector("code")
            ?.textContent || "";

        const language =
          button.closest(".code-wrap")
            ?.querySelector("code")
            ?.dataset.language || "txt";

        downloadCode(code, language);
      });
    });
  }

  async function retryLastAssistant() {
    const conversation = getCurrentConversation();

    if (!conversation) return;

    let lastUser = null;

    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      if (conversation.messages[i].role === "user") {
        lastUser = conversation.messages[i];
        break;
      }
    }

    if (!lastUser) return;

    while (
      conversation.messages.length &&
      conversation.messages[
        conversation.messages.length - 1
      ].role === "assistant"
    ) {
      conversation.messages.pop();
    }

    saveStorage();

    renderConversation();

    await sendMessage(lastUser.content, {
      saveUserMessage: false
    });
  }

  /* ---------------------------------------------------------
     Clipboard / downloads
     --------------------------------------------------------- */

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");

      textarea.value = text;
      document.body.appendChild(textarea);

      textarea.select();

      document.execCommand("copy");

      textarea.remove();
    }
  }

  function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function downloadCode(code, language) {
    const extensions = {
      html: "html",
      css: "css",
      javascript: "js",
      js: "js",
      typescript: "ts",
      ts: "ts",
      json: "json",
      python: "py",
      py: "py",
      java: "java",
      c: "c",
      cpp: "cpp",
      csharp: "cs",
      cs: "cs",
      php: "php",
      ruby: "rb",
      go: "go",
      rust: "rs",
      sql: "sql",
      bash: "sh",
      shell: "sh",
      markdown: "md",
      md: "md"
    };

    const extension =
      extensions[String(language).toLowerCase()] || "txt";

    downloadFile(
      new Blob([code], {
        type: "text/plain;charset=utf-8"
      }),
      `jaguar-code.${extension}`
    );
  }

  /* ---------------------------------------------------------
     Gateway models
     --------------------------------------------------------- */

  async function loadModels() {
    try {
      setStatus("Loading Gateway…");

      const response = await fetch(MODELS_URL);

      if (!response.ok) {
        throw new Error(
          `Model catalog returned ${response.status}`
        );
      }

      const data = await response.json();

      models = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.models)
        ? data.models
        : [];

      populateModels();

      setStatus(
        models.length
          ? `${models.length} models`
          : "Gateway ready"
      );
    } catch (err) {
      console.error(err);

      setStatus("Gateway unavailable");

      if (modelEl) {
        modelEl.innerHTML = `
          <option value="">
            Gateway models unavailable
          </option>
        `;
      }
    }
  }

  function modelLabel(model) {
    return (
      model.name ||
      model.display_name ||
      model.id ||
      "Unknown model"
    );
  }

  function populateModels() {
    if (!modelEl) return;

    modelEl.innerHTML = "";

    const usable = models.filter((model) => {
      const id = String(model.id || "").toLowerCase();

      return !(
        id.includes("embedding") ||
        id.includes("rerank")
      );
    });

    for (const model of usable) {
      const option = document.createElement("option");

      option.value = model.id;

      option.textContent = modelLabel(model);

      modelEl.appendChild(option);
    }

    if (!modelEl.options.length) {
      modelEl.innerHTML = `
        <option value="">
          Select a Gateway model
        </option>
      `;
    }
  }

  /* ---------------------------------------------------------
     API request
     --------------------------------------------------------- */

  function getApiKey() {
    return apiKeyEl?.value.trim() || "";
  }

  function getSelectedModel() {
    return modelEl?.value || "";
  }

  function getReasoning() {
    return reasoningEl?.value || "medium";
  }

  function setStatus(text) {
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  function buildSystemPrompt() {
    return `
You are Jaguar AI 2, a helpful general-purpose AI assistant.

Give accurate, useful answers.
When writing code, provide complete runnable code when appropriate.
Use Markdown for formatting.
Put source code inside fenced code blocks with the correct language.
Do not claim that you performed an action that you did not actually perform.
`.trim();
  }

  function buildGatewayMessages(conversation) {
    const result = [
      {
        role: "system",
        content: buildSystemPrompt()
      }
    ];

    for (const message of conversation.messages) {
      if (
        message.role !== "user" &&
        message.role !== "assistant"
      ) {
        continue;
      }

      result.push({
        role: message.role,
        content: message.content
      });
    }

    return result;
  }

  async function sendGatewayRequest(messages) {
    const key = getApiKey();

    if (!key) {
      throw new Error(
        "Add your Vercel AI Gateway API key in Settings first."
      );
    }

    const model = getSelectedModel();

    if (!model) {
      throw new Error("Select a Gateway model first.");
    }

    const body = {
      model,
      messages,
      stream: true
    };

    const reasoning = getReasoning();

    if (
      reasoning &&
      reasoning !== "off"
    ) {
      body.reasoning_effort = reasoning;
    }

    const response = await fetch(CHAT_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },

      body: JSON.stringify(body)
    });

    if (!response.ok) {
      let detail = "";

      try {
        const data = await response.json();

        detail =
          data?.error?.message ||
          data?.message ||
          JSON.stringify(data);
      } catch {
        detail = await response.text();
      }

      throw new Error(
        `Gateway error ${response.status}: ${detail}`
      );
    }

    return response;
  }

  /* ---------------------------------------------------------
     Streaming
     --------------------------------------------------------- */

  async function streamAssistant(response, bubble) {
    if (!response.body) {
      throw new Error("Streaming is not supported by this response.");
    }

    const reader = response.body.getReader();

    const decoder = new TextDecoder("utf-8");

    let buffer = "";

    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, {
        stream: true
      });

      const lines = buffer.split("\n");

      buffer = lines.pop() || "";

      for (let line of lines) {
        line = line.trim();

        if (!line) continue;

        if (line.startsWith("data:")) {
          line = line.slice(5).trim();
        }

        if (line === "[DONE]") {
          continue;
        }

        let data;

        try {
          data = JSON.parse(line);
        } catch {
          continue;
        }

        const delta =
          data?.choices?.[0]?.delta?.content;

        if (typeof delta === "string") {
          fullText += delta;

          const body =
            bubble.querySelector(".message-body");

          if (body) {
            body.innerHTML =
              simpleMarkdown(fullText);
          }

          scrollMessages();
        }
      }
    }

    return fullText;
  }

  /* ---------------------------------------------------------
     Send message
     --------------------------------------------------------- */

  async function sendMessage(text, options = {}) {
    const clean = String(text || "").trim();

    if (!clean) return;

    const conversation = ensureConversation();

    const saveUserMessage =
      options.saveUserMessage !== false;

    if (saveUserMessage) {
      conversation.messages.push({
        role: "user",
        content: clean,
        createdAt: Date.now()
      });

      if (
        conversation.title === "New conversation"
      ) {
        updateConversationTitle(clean);
      }
    }

    saveStorage();

    addMessage("user", clean);

    if (promptEl) {
      promptEl.value = "";

      autoResizePrompt();
    }

    setStatus("Thinking…");

    sendBtn?.setAttribute("disabled", "disabled");

    try {
      const response =
        await sendGatewayRequest(
          buildGatewayMessages(conversation)
        );

      const bubble = addMessage(
        "assistant",
        "Thinking…"
      );

      if (!bubble) {
        throw new Error("Could not create response message.");
      }

      const answer =
        await streamAssistant(
          response,
          bubble
        );

      conversation.messages.push({
        role: "assistant",
        content: answer,
        createdAt: Date.now()
      });

      conversation.updatedAt = Date.now();

      saveStorage();

      setStatus("Ready");
    } catch (err) {
      console.error(err);

      addMessage(
        "assistant",
        `**Error:** ${err.message || "Something went wrong."}`
      );

      setStatus("Error");
    } finally {
      sendBtn?.removeAttribute("disabled");
    }
  }

  /* ---------------------------------------------------------
     Image generation
     --------------------------------------------------------- */

  async function generateImage(prompt) {
    const key = getApiKey();

    if (!key) {
      throw new Error(
        "Add your Vercel AI Gateway API key in Settings first."
      );
    }

    const model = getSelectedModel();

    if (!model) {
      throw new Error("Select an image-capable model.");
    }

    /*
      Image generation APIs vary between providers/models.
      The Gateway model catalog should be used to select a
      model that supports image generation.
    */

    const response = await fetch(
      `${GATEWAY_BASE}/images/generations`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },

        body: JSON.stringify({
          model,
          prompt
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();

      throw new Error(
        `Image generation failed (${response.status}): ${text}`
      );
    }

    return response.json();
  }

  function renderGeneratedImage(data) {
    const url =
      data?.data?.[0]?.url ||
      data?.data?.[0]?.b64_json;

    if (!url) {
      addMessage(
        "assistant",
        "The image model returned no displayable image."
      );

      return;
    }

    let imageUrl = url;

    if (!String(url).startsWith("data:")) {
      imageUrl = url;
    } else if (
      data?.data?.[0]?.b64_json
    ) {
      imageUrl =
        `data:image/png;base64,${data.data[0].b64_json}`;
    }

    const html = `
      <div class="media-card">
        <img
          src="${escapeHTML(imageUrl)}"
          alt="Generated image"
          loading="lazy"
        />

        <div class="media-actions">
          <a
            href="${escapeHTML(imageUrl)}"
            download="jaguar-generated-image.png"
          >
            Save image
          </a>
        </div>
      </div>
    `;

    addMessage(
      "assistant",
      "",
      { html }
    );
  }

  /* ---------------------------------------------------------
     Video mode
     --------------------------------------------------------- */

  async function generateVideo(prompt) {
    /*
      Video generation is provider/model specific.
      Jaguar AI 2 intentionally does not pretend that every
      Gateway model accepts the same video endpoint.

      If the selected Gateway model exposes a video API,
      the appropriate server-side integration should be used.
    */

    addMessage(
      "assistant",
      `Video generation requested:

"${prompt}"

The selected Gateway model must expose a compatible video-generation API. Video generation should normally be routed through a server-side endpoint so provider credentials and long-running jobs are not exposed in the browser.`
    );
  }

  /* ---------------------------------------------------------
     Mode handling
     --------------------------------------------------------- */

  async function handleSubmit() {
    const text = promptEl?.value.trim();

    if (!text) return;

    const mode = modeEl?.value || "chat";

    try {
      if (mode === "chat") {
        await sendMessage(text);
        return;
      }

      if (mode === "image") {
        addMessage(
          "user",
          text
        );

        setStatus("Generating image…");

        const data =
          await generateImage(text);

        renderGeneratedImage(data);

        setStatus("Ready");

        return;
      }

      if (mode === "video") {
        addMessage(
          "user",
          text
        );

        setStatus("Preparing video…");

        await generateVideo(text);

        setStatus("Ready");
      }
    } catch (err) {
      console.error(err);

      addMessage(
        "assistant",
        `**Error:** ${err.message || "Generation failed."}`
      );

      setStatus("Error");
    }
  }

  /* ---------------------------------------------------------
     Attachments
     --------------------------------------------------------- */

  function setupFileInputs() {
    fileInput?.addEventListener("change", () => {
      const files = Array.from(
        fileInput.files || []
      );

      attachedFiles.push(...files);

      showAttachmentNotice(files);

      fileInput.value = "";
    });

    imageInput?.addEventListener("change", () => {
      const files = Array.from(
        imageInput.files || []
      );

      attachedImages.push(...files);

      showAttachmentNotice(files);

      imageInput.value = "";
    });
  }

  function showAttachmentNotice(files) {
    if (!files.length) return;

    const names = files
      .map((file) => file.name)
      .join(", ");

    setStatus(
      `${files.length} attachment${
        files.length === 1 ? "" : "s"
      } selected`
    );

    console.log(
      "Jaguar AI attachments:",
      names
    );
  }

  /* ---------------------------------------------------------
     Prompt input
     --------------------------------------------------------- */

  function autoResizePrompt() {
    if (!promptEl) return;

    promptEl.style.height = "auto";

    promptEl.style.height =
      Math.min(
        promptEl.scrollHeight,
        220
      ) + "px";
  }

  function setupPrompt() {
    promptEl?.addEventListener("input", autoResizePrompt);

    promptEl?.addEventListener("keydown", (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        handleSubmit();
      }
    });
  }

  /* ---------------------------------------------------------
     Quick prompts
     --------------------------------------------------------- */

  function bindQuickButtons() {
    document
      .querySelectorAll("[data-q]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const text = button.dataset.q || "";

          if (promptEl) {
            promptEl.value = text;

            autoResizePrompt();

            promptEl.focus();
          }
        });
      });
  }

  /* ---------------------------------------------------------
     Settings
     --------------------------------------------------------- */

  function setupSettings() {
    apiKeyEl?.addEventListener(
      "change",
      saveStorage
    );

    themeEl?.addEventListener(
      "change",
      () => {
        applyTheme();
        saveStorage();
      }
    );

    reasoningEl?.addEventListener(
      "change",
      saveStorage
    );

    compactEl?.addEventListener(
      "change",
      () => {
        applyTheme();
        saveStorage();
      }
    );
  }

  /* ---------------------------------------------------------
     Generic modal helpers
     --------------------------------------------------------- */

  function openModal(id) {
    const modal = $(id);

    if (!modal) return;

    modal.classList.add("open");

    modal.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  function closeModal(id) {
    const modal = $(id);

    if (!modal) return;

    modal.classList.remove("open");

    modal.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  function setupModalEvents() {
    document.addEventListener("click", (event) => {
      const target =
        event.target.closest("[data-modal-open]");

      if (target) {
        openModal(
          target.dataset.modalOpen
        );
      }

      const close =
        event.target.closest("[data-modal-close]");

      if (close) {
        closeModal(
          close.dataset.modalClose
        );
      }
    });

    document
      .querySelectorAll(".modal")
      .forEach((modal) => {
        modal.addEventListener("click", (event) => {
          if (
            event.target === modal
          ) {
            modal.classList.remove("open");

            modal.setAttribute(
              "aria-hidden",
              "true"
            );
          }
        });
      });
  }

  /* ---------------------------------------------------------
     New chat / clear
     --------------------------------------------------------- */

  function newChat() {
    createConversation();

    clearMessages();

    setStatus("Ready");
  }

  function clearCurrentChat() {
    const conversation =
      getCurrentConversation();

    if (!conversation) {
      clearMessages();
      return;
    }

    conversation.messages = [];

    conversation.title =
      "New conversation";

    conversation.updatedAt =
      Date.now();

    saveStorage();

    clearMessages();

    setStatus("Ready");
  }

  /* ---------------------------------------------------------
     Buttons
     --------------------------------------------------------- */

  function setupButtons() {
    sendBtn?.addEventListener(
      "click",
      handleSubmit
    );

    document
      .querySelectorAll("[data-new-chat]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          newChat
        );
      });

    document
      .querySelectorAll("[data-clear-chat]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          clearCurrentChat
        );
      });

    document
      .querySelectorAll("[data-files]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => fileInput?.click()
        );
      });

    document
      .querySelectorAll("[data-images]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => imageInput?.click()
        );
      });
  }

  /* ---------------------------------------------------------
     Keyboard shortcuts
     --------------------------------------------------------- */

  document.addEventListener("keydown", (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();

      promptEl?.focus();
    }

    if (
      event.key === "Escape"
    ) {
      document
        .querySelectorAll(".modal.open")
        .forEach((modal) => {
          modal.classList.remove("open");
        });
    }
  });

  /* ---------------------------------------------------------
     Initialization
     --------------------------------------------------------- */

  async function init() {
    loadStorage();

    setupPrompt();

    setupButtons();

    setupFileInputs();

    setupSettings();

    setupModalEvents();

    bindQuickButtons();

    if (!currentConversationId) {
      if (conversations.length) {
        currentConversationId =
          conversations[0].id;
      } else {
        createConversation();
      }
    }

    renderConversation();

    await loadModels();

    setStatus(
      models.length
        ? `${models.length} models`
        : "Gateway ready"
    );
  }

  init();

  /* ---------------------------------------------------------
     Expose a small public API
     --------------------------------------------------------- */

  window.JaguarAI = {
    sendMessage,
    newChat,
    clearCurrentChat,
    loadModels,
    generateImage,
    copyText,
    downloadCode
  };
})();
