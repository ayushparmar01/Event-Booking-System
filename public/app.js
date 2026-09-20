"use strict";

/* =========================================================
   CampusPass frontend
   Talks to the Express API at /api (same server, no CORS needed)
   ========================================================= */

const API = "/api";

const state = {
  token: localStorage.getItem("cp_token") || "",
  user: safeParse(localStorage.getItem("cp_user")),
  events: [],
  categories: [],
  category: "",        // active category filter ("" = all)
  pendingBookId: null, // event to book right after login
  pendingView: null    // page to open right after login
};

let bookCtx = null;    // event currently open in the booking dialog
let toastTimer;

function safeParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/* ---------- Small helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Escape text before putting it inside HTML (stops XSS from event titles etc.)
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtMonth = (d) => new Date(d).toLocaleString("en-IN", { month: "short" });
const fmtDay = (d) => new Date(d).getDate();
const fmtTime = (d) => new Date(d).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" });
const fmtFull = (d) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const money = (n) => (Number(n) === 0 ? "Free" : "\u20B9" + Number(n).toLocaleString("en-IN"));
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const PIN =
  '<svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true"><path d="M6 13s5-4.2 5-7.6A5 5 0 0 0 1 5.4C1 8.8 6 13 6 13Z" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="5.5" r="1.7" fill="currentColor"/></svg>';

function toast(message, type = "ok") {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast " + type;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3800);
}

/* ---------- API wrapper ---------- */

async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = "Bearer " + state.token;

  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Cannot reach the server. Check that it is running.");
  }

  let data = {};
  try { data = await res.json(); } catch { /* response had no JSON */ }

  // Token expired or invalid (but not a wrong password on the login form)
  if (res.status === 401 && state.token && !path.startsWith("/auth")) {
    logout(false);
    throw new Error("Your session ended. Log in again.");
  }
  if (!res.ok) throw new Error(data.message || "Something went wrong. Try again.");
  return data;
}

/* ---------- Session ---------- */

function saveSession(data) {
  const u = data.user;
  state.token = data.token;
  state.user = { id: u.id || u._id, name: u.name, email: u.email, role: u.role };
  localStorage.setItem("cp_token", state.token);
  localStorage.setItem("cp_user", JSON.stringify(state.user));
  renderAccount();
}

function logout(showMessage = true) {
  state.token = "";
  state.user = null;
  localStorage.removeItem("cp_token");
  localStorage.removeItem("cp_user");
  renderAccount();
  if (showMessage) toast("You are logged out.");
  go("events");
}

function renderAccount() {
  const box = $("#account");
  const u = state.user;
  if (u && state.token) {
    box.innerHTML =
      `<span class="who">${esc(u.name)}</span>` +
      `<button class="btn ghost small" type="button" data-action="logout">Log out</button>`;
  } else {
    box.innerHTML =
      `<button class="btn ghost small" type="button" data-action="open-auth" data-id="login">Log in</button>` +
      `<button class="btn primary small" type="button" data-action="open-auth" data-id="register">Sign up</button>`;
  }
  $("#nav-bookings").hidden = !(u && state.token);
  $("#nav-admin").hidden = !(u && state.token && u.role === "admin");
}

/* ---------- Routing (#events, #bookings, #admin) ---------- */

function go(view) {
  if (location.hash === "#" + view) route();
  else location.hash = view;
}

function route() {
  const wanted = location.hash.replace("#", "");
  const view = ["events", "bookings", "admin"].includes(wanted) ? wanted : "events";
  const loggedIn = Boolean(state.user && state.token);

  if (view !== "events" && !loggedIn) {
    state.pendingView = view;
    openAuth("login");
    location.hash = "events";
    return;
  }
  if (view === "admin" && state.user.role !== "admin") {
    toast("Only admins can open that page.", "error");
    location.hash = "events";
    return;
  }

  $$(".view").forEach((v) => { v.hidden = v.id !== "view-" + view; });
  $$("[data-nav]").forEach((a) => {
    if (a.dataset.nav === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });

  if (view === "events") loadEvents();
  if (view === "bookings") loadMyBookings();
  if (view === "admin") loadAdmin();
}

/* ---------- Events page ---------- */

function seatInfo(e) {
  const left = e.availableSeats ?? 0;
  const total = e.totalSeats || 1;
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  let label = `${left} of ${total} seats left`;
  let level = "";
  if (left === 0) { label = "Sold out"; level = "out"; }
  else if (left <= Math.max(3, total * 0.15)) { label = `Only ${left} left`; level = "low"; }
  return { left, pct, label, level };
}

function eventTicket(e) {
  const s = seatInfo(e);
  const action = s.left === 0
    ? `<span class="note">No seats left</span>`
    : `<button class="btn primary" type="button" data-action="book" data-id="${esc(e._id)}">Book seats</button>`;

  return `
    <article class="ticket ${s.left === 0 ? "is-off" : ""}">
      <div class="stub">
        <span class="stub-month">${esc(fmtMonth(e.date))}</span>
        <span class="stub-day">${esc(fmtDay(e.date))}</span>
        <span class="stub-time">${esc(fmtTime(e.date))}</span>
      </div>
      <div class="ticket-body">
        <span class="pill">${esc(e.category ? e.category.name : "General")}</span>
        <h3>${esc(e.title)}</h3>
        <p class="loc">${PIN}<span>${esc(e.location)}</span></p>
        <p class="desc">${esc(e.description)}</p>
        <div class="seatbar ${s.level}" aria-hidden="true"><span style="width:${s.pct}%"></span></div>
        <div class="ticket-foot">
          <div>
            <span class="price">${esc(money(e.price))}</span>
            <span class="seat-label ${s.level}">${esc(s.label)}</span>
          </div>
          ${action}
        </div>
      </div>
    </article>`;
}

function renderChips() {
  const chips = [{ _id: "", name: "All events" }, ...state.categories];
  $("#chips").innerHTML = chips
    .map((c) =>
      `<button class="chip" type="button" data-action="filter" data-id="${esc(c._id)}" aria-pressed="${state.category === c._id}">${esc(c.name)}</button>`)
    .join("");
}

function renderEvents() {
  const now = new Date();
  const list = state.events
    .filter((e) => new Date(e.date) >= now)
    .filter((e) => !state.category || (e.category && e.category._id === state.category));

  $("#event-list").innerHTML = list.length
    ? list.map(eventTicket).join("")
    : `<div class="empty"><p>${state.category ? "No upcoming events in this category." : "No upcoming events yet. Check back soon."}</p></div>`;
}

async function loadEvents() {
  try {
    const [cats, evs] = await Promise.all([api("/categories"), api("/events")]);
    state.categories = cats.categories;
    state.events = evs.events;
    if (state.category && !state.categories.some((c) => c._id === state.category)) state.category = "";
    renderChips();
    renderEvents();
  } catch (err) {
    $("#event-list").innerHTML = `<div class="empty"><p>${esc(err.message)}</p></div>`;
  }
}

/* ---------- Auth dialog ---------- */

function setAuthTab(tab) {
  const isLogin = tab === "login";
  $("#login-form").hidden = !isLogin;
  $("#register-form").hidden = isLogin;
  $("#auth-title").textContent = isLogin ? "Log in" : "Create account";
  $$("#auth-dialog .tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.id === tab)));
  $$("#auth-dialog .form-error").forEach((p) => { p.textContent = ""; });
}

function openAuth(tab = "login") {
  setAuthTab(tab);
  const dlg = $("#auth-dialog");
  if (!dlg.open) dlg.showModal();
}

function afterAuth(data) {
  saveSession(data);
  $("#auth-dialog").close();
  $$("#auth-dialog form").forEach((f) => f.reset());

  if (state.pendingBookId) {
    // the booking dialog opens next, so no toast (it would hide behind the dialog)
    const id = state.pendingBookId;
    state.pendingBookId = null;
    openBook(id);
    return;
  }

  toast(`Welcome, ${state.user.name}.`);
  if (state.pendingView) {
    const v = state.pendingView;
    state.pendingView = null;
    go(v);
  }
}

async function submitAuth(ev, path) {
  ev.preventDefault();
  const form = ev.target;
  const errorBox = $(".form-error", form);
  const button = $("button[type=submit]", form);
  const body = Object.fromEntries(new FormData(form));
  if (body.email) body.email = body.email.trim();
  errorBox.textContent = "";
  button.disabled = true;
  try {
    afterAuth(await api(path, { method: "POST", body }));
  } catch (err) {
    errorBox.textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

/* ---------- Booking dialog ---------- */

function updateTotal() {
  const n = Number($("#book-seats").value);
  $("#book-total").textContent = Number.isInteger(n) && n >= 1 ? money(bookCtx.price * n) : "-";
}

function stepSeats(delta) {
  const input = $("#book-seats");
  const next = Math.min(bookCtx.availableSeats, Math.max(1, (Number(input.value) || 1) + delta));
  input.value = next;
  updateTotal();
}

function openBook(id) {
  if (!(state.user && state.token)) {
    state.pendingBookId = id;
    openAuth("login");
    return;
  }
  const e = state.events.find((x) => x._id === id);
  if (!e) return;

  bookCtx = e;
  $("#book-event").innerHTML =
    `<strong>${esc(e.title)}</strong><span>${esc(fmtFull(e.date))}</span><span>${esc(e.location)}</span>`;
  const input = $("#book-seats");
  input.max = e.availableSeats;
  input.value = 1;
  $("#book-hint").textContent = `${plural(e.availableSeats, "seat")} left, ${money(e.price)} per seat.`;
  $("#book-error").textContent = "";
  updateTotal();
  const dlg = $("#book-dialog");
  if (!dlg.open) dlg.showModal();
}

async function submitBooking(ev) {
  ev.preventDefault();
  const seats = Number($("#book-seats").value);
  const errorBox = $("#book-error");

  if (!Number.isInteger(seats) || seats < 1 || seats > bookCtx.availableSeats) {
    errorBox.textContent = `Choose between 1 and ${bookCtx.availableSeats} seats.`;
    return;
  }

  const button = $("#book-confirm");
  button.disabled = true;
  errorBox.textContent = "";
  try {
    await api("/bookings", { method: "POST", body: { eventId: bookCtx._id, seats } });
    $("#book-dialog").close();
    toast(`Booked ${plural(seats, "seat")} for ${bookCtx.title}.`);
    go("bookings");
  } catch (err) {
    errorBox.textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

/* ---------- My bookings ---------- */

function bookingTicket(b) {
  const e = b.event;
  const cancelled = b.status === "cancelled";
  const stub = e
    ? `<span class="stub-month">${esc(fmtMonth(e.date))}</span><span class="stub-day">${esc(fmtDay(e.date))}</span><span class="stub-time">${esc(fmtTime(e.date))}</span>`
    : `<span class="stub-day">-</span>`;

  return `
    <article class="ticket ${cancelled || !e ? "is-off" : ""}">
      <div class="stub">${stub}</div>
      <div class="ticket-body">
        <span class="pill ${cancelled ? "pill-red" : "pill-green"}">${cancelled ? "Cancelled" : "Confirmed"}</span>
        <h3>${e ? esc(e.title) : "Event removed"}</h3>
        <p class="loc">${PIN}<span>${e ? esc(e.location) : "This event was deleted by an admin."}</span></p>
        <p class="detail"><strong>${esc(plural(b.seats, "seat"))}</strong>, total <strong>${esc(money(b.totalPrice))}</strong></p>
        <p class="detail">Booked on ${esc(fmtFull(b.createdAt))}</p>
        <div class="ticket-foot">
          <span></span>
          ${cancelled ? "" : `<button class="btn danger small" type="button" data-action="cancel" data-id="${esc(b._id)}">Cancel booking</button>`}
        </div>
      </div>
    </article>`;
}

async function loadMyBookings() {
  const box = $("#booking-list");
  try {
    const { bookings } = await api("/bookings/my");
    box.innerHTML = bookings.length
      ? bookings.map(bookingTicket).join("")
      : `<div class="empty"><p>You have not booked anything yet.</p><a class="btn primary" href="#events">Browse events</a></div>`;
  } catch (err) {
    box.innerHTML = `<div class="empty"><p>${esc(err.message)}</p></div>`;
  }
}

async function cancelBooking(id) {
  if (!confirm("Cancel this booking? The seats go back to the event.")) return;
  try {
    await api(`/bookings/${id}/cancel`, { method: "PUT" });
    toast("Booking cancelled.");
    route(); // reload whichever page we are on
  } catch (err) {
    toast(err.message, "error");
  }
}

/* ---------- Admin ---------- */

function renderCategorySelect() {
  const select = $("#ev-category");
  select.innerHTML = state.categories.map((c) => `<option value="${esc(c._id)}">${esc(c.name)}</option>`).join("");
  $("#ev-category-hint").hidden = state.categories.length > 0;
}

function renderAdminEvents() {
  const now = new Date();
  $("#admin-events").innerHTML = state.events.length
    ? state.events.map((e) => `
        <div class="admin-row">
          <div>
            <strong>${esc(e.title)}</strong>
            <span>${esc(fmtFull(e.date))}${new Date(e.date) < now ? " (ended)" : ""}</span>
            <span>${esc(e.availableSeats)} of ${esc(e.totalSeats)} seats left, ${esc(money(e.price))}</span>
          </div>
          <button class="btn danger small" type="button" data-action="delete-event" data-id="${esc(e._id)}">Delete</button>
        </div>`).join("")
    : `<p class="hint">No events yet. Add one with the form.</p>`;
}

function renderAdminBookings(bookings) {
  $("#admin-bookings").innerHTML = bookings.length
    ? `<table>
        <thead><tr><th scope="col">Booked by</th><th scope="col">Event</th><th scope="col">Seats</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${bookings.map((b) => `
          <tr>
            <td>${esc(b.user ? b.user.name : "Deleted user")}<span class="hint">${esc(b.user ? b.user.email : "")}</span></td>
            <td>${esc(b.event ? b.event.title : "Event removed")}</td>
            <td>${esc(b.seats)}</td>
            <td>${esc(money(b.totalPrice))}</td>
            <td><span class="pill ${b.status === "cancelled" ? "pill-red" : "pill-green"}">${b.status === "cancelled" ? "Cancelled" : "Confirmed"}</span></td>
            <td>${b.status === "confirmed" ? `<button class="btn danger small" type="button" data-action="cancel" data-id="${esc(b._id)}">Cancel</button>` : ""}</td>
          </tr>`).join("")}
        </tbody></table>`
    : `<p class="hint">No bookings yet.</p>`;
}

async function loadAdmin() {
  try {
    const [cats, evs, bks] = await Promise.all([api("/categories"), api("/events"), api("/bookings")]);
    state.categories = cats.categories;
    state.events = evs.events;
    renderCategorySelect();
    renderAdminEvents();
    renderAdminBookings(bks.bookings);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function deleteEvent(id) {
  const e = state.events.find((x) => x._id === id);
  if (!confirm(`Delete "${e ? e.title : "this event"}"? Its bookings will lose their event details.`)) return;
  try {
    await api(`/events/${id}`, { method: "DELETE" });
    toast("Event deleted.");
    loadAdmin();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function submitCategory(ev) {
  ev.preventDefault();
  const form = ev.target;
  try {
    await api("/categories", { method: "POST", body: { name: String(new FormData(form).get("name")).trim() } });
    toast("Category added.");
    form.reset();
    loadAdmin();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function submitEvent(ev) {
  ev.preventDefault();
  const form = ev.target;
  const errorBox = $(".form-error", form);
  const d = Object.fromEntries(new FormData(form));
  errorBox.textContent = "";
  try {
    await api("/events", {
      method: "POST",
      body: {
        title: d.title.trim(),
        description: d.description.trim(),
        date: new Date(d.date).toISOString(), // keeps the browser's timezone
        location: d.location.trim(),
        price: Number(d.price),
        totalSeats: Number(d.totalSeats),
        category: d.category
      }
    });
    toast("Event added.");
    form.reset();
    loadAdmin();
  } catch (err) {
    errorBox.textContent = err.message;
  }
}

/* ---------- Wire everything up ---------- */

const actions = {
  "open-auth": (id) => openAuth(id),
  "auth-tab": (id) => setAuthTab(id),
  close: (_id, el) => el.closest("dialog").close(),
  logout: () => logout(),
  filter: (id) => { state.category = id; renderChips(); renderEvents(); },
  book: (id) => openBook(id),
  "seat-minus": () => stepSeats(-1),
  "seat-plus": () => stepSeats(1),
  cancel: (id) => cancelBooking(id),
  "delete-event": (id) => deleteEvent(id)
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el.dataset.id, el);
});

// Clicking the dark backdrop closes a dialog
$$("dialog").forEach((dlg) => {
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
});
// If the login dialog is dismissed, forget what the person was trying to do
$("#auth-dialog").addEventListener("close", () => {
  if (!state.user) { state.pendingBookId = null; state.pendingView = null; }
});

$("#login-form").addEventListener("submit", (ev) => submitAuth(ev, "/auth/login"));
$("#register-form").addEventListener("submit", (ev) => submitAuth(ev, "/auth/register"));
$("#book-form").addEventListener("submit", submitBooking);
$("#book-seats").addEventListener("input", updateTotal);
$("#cat-form").addEventListener("submit", submitCategory);
$("#event-form").addEventListener("submit", submitEvent);

window.addEventListener("hashchange", route);
renderAccount();
route();
