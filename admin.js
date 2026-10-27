// ===== Supabase 연결 정보 (공개 키만 쓴다) =====
const SUPABASE_URL = "https://niyjorqwktmohieigqnm.supabase.co";
const SUPABASE_KEY = "sb_publishable_dgiPqxOb1_sl6kMsXx4gJA_D7b7XTtu";
const BUCKET = "resume";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// 올릴 수 있는 파일 종류와 새 파일 이름에 붙일 끝말
const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const FILE_TYPES = Object.assign({ "application/pdf": "pdf" }, IMAGE_TYPES);

// 로그인 정보 (access_token, refresh_token, 끝나는 시각, 이메일)
let session = null;

// ===== 브라우저에 로그인 정보 저장 (막혀 있어도 동작하게) =====
function saveSession(s) {
  session = s;
  try {
    if (s) localStorage.setItem("resume_admin_session", JSON.stringify(s));
    else localStorage.removeItem("resume_admin_session");
  } catch (e) {
    // 저장이 막힌 브라우저면 이 탭에서만 로그인 상태가 유지된다
  }
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("resume_admin_session"));
  } catch (e) {
    return null;
  }
}

function sessionFrom(data) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    email: data.user ? data.user.email : "",
  };
}

// ===== Supabase Auth (로그인·토큰 새로 받기·로그아웃) =====
async function auth(path, body) {
  const res = await fetch(SUPABASE_URL + "/auth/v1/" + path, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(function () {
    return {};
  });
  if (!res.ok) {
    const error = new Error(data.error_description || data.msg || "로그인 실패");
    error.status = res.status;
    throw error;
  }
  return data;
}

// 토큰이 곧 끝나면 새로 받아 둔다
async function freshToken() {
  if (!session) throw new Error("로그인이 필요해요");
  if (Date.now() > session.expires_at - 60 * 1000) {
    try {
      const data = await auth("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
      saveSession(sessionFrom(data));
    } catch (e) {
      saveSession(null);
      showView("login");
      throw new Error("로그인이 끝났어요. 다시 로그인해 주세요.");
    }
  }
  return session.access_token;
}

// ===== Supabase 표 요청 (받은 토큰으로) =====
async function db(path, options = {}) {
  const token = await freshToken();
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Prefer: options.prefer || "",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    saveSession(null);
    showView("login");
  }
  if (!res.ok) throw new Error("저장하지 못했어요 (" + res.status + ")");
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ===== 보관함에 파일 올리기 =====
// 잘못된 파일이면 안내 문구를 돌려주고, 괜찮으면 null
function checkFile(file, allowed) {
  if (!allowed[file.type]) {
    return allowed === IMAGE_TYPES
      ? "이미지(PNG·JPG·WEBP·GIF)만 올릴 수 있어요."
      : "이미지(PNG·JPG·WEBP·GIF)나 PDF만 올릴 수 있어요.";
  }
  if (file.size > MAX_SIZE) return "10MB가 넘는 파일은 올릴 수 없어요.";
  return null;
}

// 파일 이름은 영어·숫자로 새로 짓는다. 예) projects/1730000000000-ab12cd.pdf
function newFileName(folder, file) {
  const random = Math.random().toString(36).slice(2, 8);
  return folder + "/" + Date.now() + "-" + random + "." + FILE_TYPES[file.type];
}

async function uploadFile(folder, file) {
  const token = await freshToken();
  const path = newFileName(folder, file);
  const res = await fetch(SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + path, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + token,
      "Content-Type": file.type,
    },
    body: file,
  });
  if (!res.ok) throw new Error("파일을 올리지 못했어요 (" + res.status + ")");
  // 공개 보관함이라 이 주소로 누구나 볼 수 있다
  return SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + path;
}

// ===== 작은 도우미들 =====
function $(id) {
  return document.getElementById(id);
}

function say(id, text, isError) {
  const el = $(id);
  el.textContent = text || "";
  el.classList.toggle("error", !!isError);
}

function makeButton(label, className, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn small " + (className || "");
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function makeThumb(url) {
  const box = document.createElement("div");
  box.className = "row-thumb";
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    box.append(img);
  }
  return box;
}

function makeRow(parts) {
  const li = document.createElement("li");
  li.className = "row";
  li.append.apply(li, parts);
  return li;
}

function makeMain(title, sub) {
  const main = document.createElement("div");
  main.className = "row-main";
  const t = document.createElement("p");
  t.textContent = title;
  t.style.fontWeight = "800";
  const s = document.createElement("p");
  s.className = "row-sub";
  s.textContent = sub;
  main.append(t, s);
  return main;
}

function showView(name) {
  $("login-view").hidden = name !== "login";
  $("denied-view").hidden = name !== "denied";
  $("admin-view").hidden = name !== "admin";
}

// ===== 로그인 · 로그아웃 =====
async function login() {
  const email = $("login-email").value.trim();
  const password = $("login-password").value;
  if (!email || !password) {
    say("login-msg", "이메일과 비밀번호를 적어 주세요.", true);
    return;
  }
  $("login-button").disabled = true;
  say("login-msg", "");
  try {
    const data = await auth("token?grant_type=password", { email: email, password: password });
    saveSession(sessionFrom(data));
    $("login-password").value = "";
    await start();
  } catch (e) {
    say("login-msg", "이메일이나 비밀번호가 맞지 않아요.", true);
  }
  $("login-button").disabled = false;
}

async function logout() {
  if (session) {
    // 서버 쪽 로그인도 끝낸다 (실패해도 이 브라우저에서는 로그아웃)
    fetch(SUPABASE_URL + "/auth/v1/logout", {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + session.access_token },
    }).catch(function () {});
  }
  saveSession(null);
  showView("login");
}

// 로그인한 사람이 관리자인지 보고 알맞은 화면을 연다
async function start() {
  // admins 표는 "자기 줄"만 보이므로, 한 줄이라도 오면 관리자다
  const rows = await db("admins?select=user_id");
  if (!rows || rows.length === 0) {
    showView("denied");
    return;
  }
  $("who").textContent = session.email;
  showView("admin");
  await Promise.all([loadProfile(), loadProjectsAndLikes(), loadGuestbook()]).catch(function (e) {
    say("project-msg", "불러오지 못했어요. 새로고침해 주세요. " + e.message, true);
  });
}

// ===== 프로필 =====
let profilePhotoUrl = null;

function showPhotoPreview(url) {
  const box = $("photo-preview");
  box.textContent = "";
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "프로필 사진";
    box.append(img);
  }
}

async function loadProfile() {
  const rows = await db("profile?select=*&id=eq.1");
  const p = rows[0] || {};
  document.querySelectorAll("[data-profile]").forEach(function (input) {
    input.value = p[input.dataset.profile] || "";
  });
  profilePhotoUrl = p.photo_url || null;
  showPhotoPreview(profilePhotoUrl);
}

async function saveProfile() {
  const file = $("photo-file").files[0];
  if (file) {
    const problem = checkFile(file, IMAGE_TYPES);
    if (problem) {
      say("profile-msg", problem, true);
      return;
    }
  }

  $("profile-save").disabled = true;
  say("profile-msg", "저장하는 중…");
  try {
    if (file) profilePhotoUrl = await uploadFile("profile", file);

    const row = { id: 1, photo_url: profilePhotoUrl, updated_at: new Date().toISOString() };
    document.querySelectorAll("[data-profile]").forEach(function (input) {
      row[input.dataset.profile] = input.value.trim();
    });
    // 줄이 있으면 고치고, 없으면 새로 만든다
    await db("profile?on_conflict=id", {
      method: "POST",
      body: row,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
    $("photo-file").value = "";
    showPhotoPreview(profilePhotoUrl);
    say("profile-msg", "저장했어요. 방문자 화면을 새로고침하면 보여요.");
  } catch (e) {
    say("profile-msg", e.message, true);
  }
  $("profile-save").disabled = false;
}

// ===== 포트폴리오 카드 + 좋아요 =====
let projects = [];
let likeCounts = {};
let editingId = null; // null이면 새 카드 추가

async function loadProjectsAndLikes() {
  const [rows, likes] = await Promise.all([
    db("projects?select=*&order=sort_order.asc,id.asc"),
    db("likes?select=project_id"),
  ]);
  projects = rows;
  likeCounts = {};
  likes.forEach(function (l) {
    likeCounts[l.project_id] = (likeCounts[l.project_id] || 0) + 1;
  });
  renderProjects();
  renderLikes();
}

function renderProjects() {
  const list = $("project-list");
  list.textContent = "";
  if (projects.length === 0) {
    list.innerHTML = '<li class="notice">아직 카드가 없어요.</li>';
    return;
  }
  projects.forEach(function (p, i) {
    const sub = [p.number, p.category].filter(Boolean).join(" · ") + "  ♥ " + (likeCounts[p.id] || 0);
    const buttons = document.createElement("div");
    buttons.className = "row-buttons";
    const up = makeButton("▲ 위로", "light", function () {
      moveProject(i, -1);
    });
    const down = makeButton("▼ 아래로", "light", function () {
      moveProject(i, 1);
    });
    up.disabled = i === 0;
    down.disabled = i === projects.length - 1;
    buttons.append(
      up,
      down,
      makeButton("수정", "light", function () {
        openEditor(p);
      }),
      makeButton("삭제", "danger", function () {
        deleteProject(p);
      })
    );
    list.append(makeRow([makeThumb(p.thumbnail_url), makeMain(p.title, sub), buttons]));
  });
}

function renderLikes() {
  const list = $("like-list");
  list.textContent = "";
  if (projects.length === 0) {
    list.innerHTML = '<li class="notice">카드가 없어요.</li>';
    return;
  }
  projects.forEach(function (p) {
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = "♥ " + (likeCounts[p.id] || 0);
    const buttons = document.createElement("div");
    buttons.className = "row-buttons";
    const reset = makeButton("좋아요 초기화", "danger", function () {
      resetLikes(p);
    });
    reset.disabled = !likeCounts[p.id];
    buttons.append(reset);
    const main = makeMain(p.title, [p.number, p.category].filter(Boolean).join(" · "));
    list.append(makeRow([main, count, buttons]));
  });
}

// 순서 올리기·내리기: 바뀐 순서대로 sort_order를 1, 2, 3… 으로 다시 매긴다
async function moveProject(index, step) {
  const other = index + step;
  if (other < 0 || other >= projects.length) return;
  const order = projects.slice();
  const moved = order[index];
  order[index] = order[other];
  order[other] = moved;

  say("project-msg", "순서를 바꾸는 중…");
  try {
    for (let i = 0; i < order.length; i++) {
      if (order[i].sort_order !== i + 1) {
        await db("projects?id=eq." + order[i].id, { method: "PATCH", body: { sort_order: i + 1 } });
      }
    }
    say("project-msg", "");
  } catch (e) {
    say("project-msg", e.message, true);
  }
  await loadProjectsAndLikes();
}

async function deleteProject(p) {
  if (!confirm("「" + p.title + "」 카드를 지울까요?\n이 카드의 좋아요도 함께 지워져요.")) return;
  try {
    const rows = await db("projects?id=eq." + p.id, { method: "DELETE", prefer: "return=representation" });
    if (!rows || rows.length === 0) throw new Error("지우지 못했어요. 관리자 권한을 확인해 주세요.");
    if (editingId === p.id) closeEditor();
    say("project-msg", "지웠어요.");
  } catch (e) {
    say("project-msg", e.message, true);
  }
  await loadProjectsAndLikes();
}

async function resetLikes(p) {
  if (!confirm("「" + p.title + "」의 좋아요 " + (likeCounts[p.id] || 0) + "개를 모두 지울까요?")) return;
  try {
    const rows = await db("likes?project_id=eq." + p.id, { method: "DELETE", prefer: "return=representation" });
    if (!rows || rows.length === 0) throw new Error("지우지 못했어요. 관리자 권한을 확인해 주세요.");
    say("like-msg", "초기화했어요.");
  } catch (e) {
    say("like-msg", e.message, true);
  }
  await loadProjectsAndLikes();
}

// 카드 추가·수정 폼
function showCurrent(id, label, url) {
  const el = $(id);
  el.textContent = "";
  if (!url) {
    el.textContent = "지금 " + label + " 없음";
    return;
  }
  el.append("지금 " + label + ": ");
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = url.split("/").pop();
  el.append(a);
}

function openEditor(p) {
  editingId = p ? p.id : null;
  $("editor-title").textContent = p ? "카드 수정" : "카드 추가";
  $("p-number").value = p ? p.number : "";
  $("p-category").value = p ? p.category : "";
  $("p-title").value = p ? p.title : "";
  $("p-description").value = p ? p.description : "";
  $("p-tags").value = p ? (p.tags || []).join(", ") : "";
  $("p-thumb").value = "";
  $("p-file").value = "";
  showCurrent("p-thumb-current", "썸네일", p && p.thumbnail_url);
  showCurrent("p-file-current", "첨부 파일", p && p.file_url);
  say("editor-msg", "");
  $("project-editor").hidden = false;
  $("project-editor").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditor() {
  editingId = null;
  $("project-editor").hidden = true;
}

async function saveProject() {
  const title = $("p-title").value.trim();
  if (!title) {
    say("editor-msg", "제목을 적어 주세요.", true);
    return;
  }
  const thumb = $("p-thumb").files[0];
  const file = $("p-file").files[0];
  const problem = (thumb && checkFile(thumb, IMAGE_TYPES)) || (file && checkFile(file, FILE_TYPES));
  if (problem) {
    say("editor-msg", problem, true);
    return;
  }

  $("project-save").disabled = true;
  say("editor-msg", "저장하는 중…");
  try {
    const row = {
      number: $("p-number").value.trim(),
      category: $("p-category").value.trim(),
      title: title,
      description: $("p-description").value.trim(),
      tags: $("p-tags").value.split(",").map(function (t) {
        return t.trim();
      }).filter(Boolean),
    };
    if (thumb) row.thumbnail_url = await uploadFile("projects", thumb);
    if (file) row.file_url = await uploadFile("projects", file);

    if (editingId === null) {
      // 새 카드는 맨 뒤에 붙인다
      const last = projects.reduce(function (max, p) {
        return Math.max(max, p.sort_order);
      }, 0);
      row.sort_order = last + 1;
      await db("projects", { method: "POST", body: row, prefer: "return=minimal" });
    } else {
      await db("projects?id=eq." + editingId, { method: "PATCH", body: row });
    }
    closeEditor();
    say("project-msg", "저장했어요. 방문자 화면을 새로고침하면 보여요.");
    await loadProjectsAndLikes();
  } catch (e) {
    say("editor-msg", e.message, true);
  }
  $("project-save").disabled = false;
}

// ===== 방명록 =====
function formatDate(iso) {
  const d = new Date(iso);
  const pad = function (n) {
    return String(n).padStart(2, "0");
  };
  return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

async function loadGuestbook() {
  const rows = await db("resume_guestbook?select=*&order=created_at.desc");
  const list = $("guest-list");
  list.textContent = "";
  if (rows.length === 0) {
    list.innerHTML = '<li class="notice">아직 방명록 글이 없어요.</li>';
    return;
  }
  rows.forEach(function (g) {
    const main = makeMain(g.nickname + "  ·  " + formatDate(g.created_at), g.message);
    const buttons = document.createElement("div");
    buttons.className = "row-buttons";
    buttons.append(
      makeButton("삭제", "danger", function () {
        deleteGuest(g);
      })
    );
    list.append(makeRow([main, buttons]));
  });
}

async function deleteGuest(g) {
  if (!confirm("「" + g.nickname + "」님의 글을 지울까요?")) return;
  try {
    const rows = await db("resume_guestbook?id=eq." + g.id, { method: "DELETE", prefer: "return=representation" });
    if (!rows || rows.length === 0) throw new Error("지우지 못했어요. 관리자 권한을 확인해 주세요.");
    say("guest-msg", "지웠어요.");
  } catch (e) {
    say("guest-msg", e.message, true);
  }
  await loadGuestbook();
}

// ===== 버튼 연결 =====
$("login-button").addEventListener("click", login);
$("login-password").addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.isComposing) login();
});
$("logout-button").addEventListener("click", logout);
$("denied-logout").addEventListener("click", logout);
$("profile-save").addEventListener("click", saveProfile);
$("project-new").addEventListener("click", function () {
  openEditor(null);
});
$("project-save").addEventListener("click", saveProject);
$("project-cancel").addEventListener("click", closeEditor);

// ===== 처음 열 때: 저장된 로그인이 있으면 이어서 =====
session = readSession();
if (session) {
  start().catch(function () {
    saveSession(null);
    showView("login");
  });
} else {
  showView("login");
}
