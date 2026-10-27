// ===== Supabase 연결 정보 (공개 키만 쓴다) =====
const SUPABASE_URL = "https://niyjorqwktmohieigqnm.supabase.co";
const SUPABASE_KEY = "sb_publishable_dgiPqxOb1_sl6kMsXx4gJA_D7b7XTtu";

// Supabase 표에 요청을 보내는 함수
async function db(path, options = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: options.prefer || "",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const error = new Error("Supabase 요청 실패: " + res.status);
    error.status = res.status;
    throw error;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ===== 브라우저에 저장해 두는 값 (막혀 있어도 화면은 동작하게) =====
function readStore(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // 저장이 막힌 브라우저면 그냥 넘어간다
  }
}

// 이 브라우저의 이름표(client_id). 처음 한 번 만들고 계속 쓴다.
function getClientId() {
  let id = readStore("resume_client_id");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
    writeStore("resume_client_id", id);
  }
  return id;
}

// 이 브라우저에서 좋아요를 누른 카드 번호 목록
function getLikedIds() {
  try {
    return JSON.parse(readStore("resume_liked") || "[]");
  } catch (e) {
    return [];
  }
}

function saveLikedId(projectId) {
  const ids = getLikedIds();
  if (!ids.includes(projectId)) {
    ids.push(projectId);
    writeStore("resume_liked", JSON.stringify(ids));
  }
}

// ===== 프로필 =====
function setText(id, text) {
  document.getElementById(id).textContent = text || "";
}

async function loadProfile() {
  const rows = await db("profile?select=*&id=eq.1");
  const p = rows[0];
  if (!p) return;

  setText("name", p.name);
  setText("job-title", p.title);
  setText("career-badge", p.career_badge);
  setText("info-name", p.name);
  setText("info-email", p.email);
  setText("info-phone", p.phone);
  setText("info-location", p.location);
  setText("intro", p.intro);
  setText("education", p.education);
  setText("skills", p.skills);
  setText("experience", p.experience);
  setText("quote", p.quote ? "“" + p.quote + "”" : "");

  // 한 줄 소개: 이름 부분에만 파란 밑줄
  const headline = document.getElementById("headline");
  headline.textContent = "";
  const text = p.headline || "";
  const at = p.name ? text.indexOf(p.name) : -1;
  if (at === -1) {
    headline.textContent = text;
  } else {
    const nameSpan = document.createElement("span");
    nameSpan.className = "hl-name";
    nameSpan.textContent = p.name;
    headline.append(text.slice(0, at), nameSpan, text.slice(at + p.name.length));
  }

  // 프로필 사진 (없으면 회색 자리 그대로)
  if (p.photo_url) {
    const photo = document.getElementById("photo");
    const img = document.createElement("img");
    img.src = p.photo_url;
    img.alt = (p.name || "") + " 프로필 사진";
    photo.textContent = "";
    photo.append(img);
  }
}

// ===== 포트폴리오 카드 =====
const HEART_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 4.5 7 4.5c2.1 0 3.6 1.1 5 3 1.4-1.9 2.9-3 5-3 3.8 0 6 3.8 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg>';

function makeCard(project, likeCount, liked) {
  const card = document.createElement("article");
  card.className = "card";

  // 카드 윗부분 전체가 "열기" 버튼
  const open = document.createElement("button");
  open.type = "button";
  open.className = "card-open";
  const link = project.file_url || project.thumbnail_url;
  if (link) {
    open.addEventListener("click", function () {
      window.open(link, "_blank", "noopener");
    });
  } else {
    open.disabled = true;
  }

  // 브라우저 창 모양 썸네일
  const browser = document.createElement("span");
  browser.className = "browser";
  browser.innerHTML = '<span class="browser-bar"><i></i><i></i><i></i></span>';
  const view = document.createElement("span");
  view.className = "browser-view";
  if (project.thumbnail_url) {
    const img = document.createElement("img");
    img.src = project.thumbnail_url;
    img.alt = project.title + " 썸네일";
    img.loading = "lazy";
    view.append(img);
  }
  browser.append(view);

  // 번호·분류, 제목, 설명, 태그
  const body = document.createElement("span");
  body.className = "card-body";

  const meta = document.createElement("span");
  meta.className = "card-meta";
  meta.textContent = [project.number, project.category].filter(Boolean).join(" · ");

  const title = document.createElement("span");
  title.className = "card-title";
  title.textContent = project.title;

  const desc = document.createElement("span");
  desc.className = "card-desc";
  desc.textContent = project.description;

  const tags = document.createElement("span");
  tags.className = "tags";
  (project.tags || []).forEach(function (t) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = t;
    tags.append(tag);
  });

  body.append(meta, title, desc, tags);
  open.append(browser, body);

  // 좋아요 버튼
  const foot = document.createElement("div");
  foot.className = "card-foot";
  const like = document.createElement("button");
  like.type = "button";
  like.className = "like" + (liked ? " liked" : "");
  like.setAttribute("aria-label", "좋아요");
  like.innerHTML = HEART_SVG;
  const count = document.createElement("span");
  count.textContent = likeCount;
  like.append(count);
  like.addEventListener("click", function () {
    pressLike(project.id, like, count);
  });
  foot.append(like);

  card.append(open, foot);
  return card;
}

async function pressLike(projectId, button, countEl) {
  if (button.classList.contains("liked") || button.disabled) return;
  button.disabled = true;
  try {
    await db("likes", {
      method: "POST",
      body: { project_id: projectId, client_id: getClientId() },
      prefer: "return=minimal",
    });
    countEl.textContent = Number(countEl.textContent) + 1;
    button.classList.add("liked");
    saveLikedId(projectId);
  } catch (e) {
    if (e.status === 409) {
      // 이 브라우저는 이미 눌렀던 카드
      button.classList.add("liked");
      saveLikedId(projectId);
    } else {
      alert("좋아요를 저장하지 못했어요. 잠시 후 다시 눌러 주세요.");
    }
  }
  button.disabled = false;
}

async function loadProjects() {
  const box = document.getElementById("cards");
  const [projects, likes] = await Promise.all([
    db("projects?select=*&order=sort_order.asc,id.asc"),
    db("likes?select=project_id"),
  ]);

  // 카드별 좋아요 수 세기
  const counts = {};
  likes.forEach(function (l) {
    counts[l.project_id] = (counts[l.project_id] || 0) + 1;
  });

  const likedIds = getLikedIds();
  box.textContent = "";
  if (projects.length === 0) {
    box.innerHTML = '<p class="notice">아직 등록된 포트폴리오가 없어요.</p>';
    return;
  }
  projects.forEach(function (p) {
    box.append(makeCard(p, counts[p.id] || 0, likedIds.includes(p.id)));
  });
}

// ===== 방명록 =====
function formatDate(iso) {
  const d = new Date(iso);
  const pad = function (n) {
    return String(n).padStart(2, "0");
  };
  return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function makeGuestItem(entry) {
  const li = document.createElement("li");
  li.className = "gb-item";

  const head = document.createElement("div");
  head.className = "gb-head";
  const nick = document.createElement("span");
  nick.className = "gb-nick";
  nick.textContent = entry.nickname;
  const date = document.createElement("span");
  date.className = "gb-date";
  date.textContent = formatDate(entry.created_at);
  head.append(nick, date);

  const msg = document.createElement("p");
  msg.className = "gb-msg";
  msg.textContent = entry.message;

  li.append(head, msg);
  return li;
}

function showEmptyGuestbook() {
  const list = document.getElementById("gb-list");
  if (list.children.length === 0) {
    list.innerHTML = '<li class="notice">첫 번째 한마디를 남겨 주세요.</li>';
  }
}

async function loadGuestbook() {
  const list = document.getElementById("gb-list");
  const rows = await db("resume_guestbook?select=*&order=created_at.desc");
  list.textContent = "";
  rows.forEach(function (row) {
    list.append(makeGuestItem(row));
  });
  showEmptyGuestbook();
}

async function submitGuestbook() {
  const nickInput = document.getElementById("gb-nickname");
  const msgInput = document.getElementById("gb-message");
  const button = document.getElementById("gb-submit");
  const status = document.getElementById("gb-status");
  const nickname = nickInput.value.trim();
  const message = msgInput.value.trim();

  if (!nickname || !message) {
    status.textContent = "별명과 한마디를 모두 적어 주세요.";
    return;
  }

  button.disabled = true;
  status.textContent = "";
  try {
    const rows = await db("resume_guestbook", {
      method: "POST",
      body: { nickname: nickname, message: message },
      prefer: "return=representation",
    });
    const list = document.getElementById("gb-list");
    const empty = list.querySelector(".notice");
    if (empty) empty.remove();
    list.prepend(makeGuestItem(rows[0]));   // 목록 맨 위에 넣는다
    msgInput.value = "";
  } catch (e) {
    status.textContent = "남기지 못했어요. 잠시 후 다시 눌러 주세요.";
  }
  button.disabled = false;
}

document.getElementById("gb-submit").addEventListener("click", submitGuestbook);
document.getElementById("gb-message").addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.isComposing) submitGuestbook();
});

// ===== 처음 열 때 모두 불러오기 =====
loadProfile().catch(function () {
  setText("headline", "프로필을 불러오지 못했어요.");
});
loadProjects().catch(function () {
  document.getElementById("cards").innerHTML = '<p class="notice">포트폴리오를 불러오지 못했어요.</p>';
});
loadGuestbook().catch(function () {
  document.getElementById("gb-list").innerHTML = '<li class="notice">방명록을 불러오지 못했어요.</li>';
});
