// chatPage.ts
export {};

interface Message {
  sender: string;
  text: string;
  timestamp: Date;
}

interface Conversation {
  [username: string]: Message[];
}

const users: string[] = [];
for (let i = 0; i < 100; i++) {
  users.push("user" + i);
}

const conversations: Conversation = {};

let activeUser: string | null = null;

const userListDiv = document.querySelector<HTMLDivElement>(".user-list")!;
const chatBlock = document.querySelector<HTMLDivElement>(".chat-block")!;

// -------------------------------------
// RENDER USER LIST
// -------------------------------------
users.forEach((name) => {
  const userItem = document.createElement('div'); 
  userItem.className = 'user-item';
  const img = document.createElement('img');
  img.className = 'img_profile';
  img.src = `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 10) % 5}.png`;
  img.alt = '';
  const txt = document.createElement('p');
  txt.className = 'name_profile';
  txt.textContent = name;
  userItem.appendChild(img);
  userItem.appendChild(txt);

  userItem.addEventListener("click", () => {
    document.querySelectorAll('.user-item.selected').forEach(el => {
      el.classList.remove('selected');
    });
    userItem.classList.add('selected');
    activeUser = name;
    renderChat();
  });

  userListDiv.appendChild(userItem);
});

// -------------------------------------
// RENDER CHAT PANEL (messages + input)
// -------------------------------------
function renderChat() {
  if (!activeUser) return;

  // Initialize conversation if new (placeholders)
  if (!conversations[activeUser]) {
    conversations[activeUser] = [
      { sender: activeUser, text: "Hey! This is a placeholder message.", timestamp: new Date() },
      { sender: "me", text: "Nice, just testing the chat UI!", timestamp: new Date() },
      { sender: activeUser, text: "Looks good so far 👍", timestamp: new Date() },
    ];
  }

  // Build the chat UI using DOM APIs instead of innerHTML to avoid
  // invalid nesting (which can move the form outside the container).
  chatBlock.innerHTML = "";

  const header = document.createElement("div");
  header.className = "chat-header";
  header.textContent = activeUser;

  const messagesDiv = document.createElement("div");
  messagesDiv.className = "chat-messages";
  messagesDiv.setAttribute("role", "log");
  messagesDiv.setAttribute("aria-live", "polite");

  const form = document.createElement("form");
  form.className = "chat-input-form";
  form.method = "post";
  form.action = "#";
  form.setAttribute("novalidate", "");

  const input = document.createElement("div");
  input.className = "chat-input";
  // Use a data-attribute for the placeholder so CSS can show it via ::before
  const placeholderText = `Type a message to @${activeUser}`;
  input.dataset.placeholder = placeholderText;
  input.contentEditable = "true";
  // mark empty initially so placeholder appears (requires CSS that shows placeholder when .empty)
  input.classList.add("empty");

  const sendBtn = document.createElement("button");
  sendBtn.type = "submit";
  sendBtn.className = "chat-send-btn";
  sendBtn.textContent = "Send";
  sendBtn.hidden = true; // initially hidden

  form.appendChild(input);
  form.appendChild(sendBtn);

  chatBlock.appendChild(header);
  chatBlock.appendChild(messagesDiv);
  chatBlock.appendChild(form);

  // Render existing messages (escape HTML then convert newlines to <br> so breaks are preserved)
  messagesDiv.innerHTML = conversations[activeUser]
    .map((msg) => {
      const safe = escapeHtml(msg.text).replace(/\n/g, "<br>");
      return `
      <div class="chat-message ${msg.sender === 'me' ? 'me' : 'them'}">
        <span>${safe}</span>
      </div>`;
    })
    .join("");

  // Auto-scroll to bottom
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  // Helper to submit message
  function submitMessage() {
    const text = input.textContent?.trim() || "";
    if (!text) return;

    conversations[activeUser || ""].push({
      sender: "me",
      text,
      timestamp: new Date(),
    });

    input.textContent = "";
    // mark empty so placeholder reappears and hide send button
    input.classList.add("empty");
    sendBtn.hidden = true;
    renderChat(); // re-render to show the new message
  }

  // PRIMARY: intercept submit and stop other handlers from running
  form.addEventListener("submit", (e) => {
    e.preventDefault();                 // prevent default navigation
    submitMessage();
  });

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    // Ignore composition events (IME) to avoid interfering with input
    if ((e as any).isComposing) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
    // If Shift+Enter, do nothing here so the textarea inserts a newline naturally.
  });

  input.addEventListener("input", () => {
    // Auto-resize logic and placeholder behaviour
    if (input.textContent!.trim() === "") {
      input.classList.add("empty");
      input.textContent = ""; // clear any whitespace
      sendBtn.hidden = true;
    } else {
      input.classList.remove("empty");
      sendBtn.hidden = false;
    }
  });
}

// Small helper to avoid XSS from message text
function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}