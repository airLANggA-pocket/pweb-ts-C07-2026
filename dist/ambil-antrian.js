import { STORAGE_KEYS, createTicket, getQueues, getWaitingTickets, } from "./storage.js";
const REFRESH_MS = 2000;
const RESULT_VISIBLE_MS = 20000;
const COOLDOWN_MS = 800;
const PRIORITIES = ["Normal", "Lansia", "Disabilitas", "VIP"];
const EXTRA_PRIORITIES = ["Lansia", "Disabilitas", "VIP"];
// ---------- Helper DOM ----------
function requireEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`Elemen #${id} tidak ditemukan di halaman.`);
    return el;
}
function create(tag, className, text) {
    const el = document.createElement(tag);
    if (className)
        el.className = className;
    if (text !== undefined)
        el.textContent = text;
    return el;
}
function isPriority(value) {
    return PRIORITIES.includes(value);
}
const grid = requireEl("queue-grid");
const statusEl = requireEl("status");
const noticeEl = requireEl("notice");
const resultEl = requireEl("result");
const resultNumberEl = requireEl("result-number");
const resultQueueEl = requireEl("result-queue");
const resultMetaEl = requireEl("result-meta");
const resultCloseBtn = requireEl("result-close");
// ---------- Render kartu jenis antrian ----------
/** Referensi elemen jumlah tiket menunggu per kode, diisi saat kartu dibangun. */
const waitingEls = new Map();
let lastSignature = null;
function getActiveQueues() {
    return getQueues().filter((queue) => queue.isActive);
}
function buildCard(queue) {
    const card = create("article", "card card-take");
    const head = create("header", "card-head");
    head.append(create("h2", "", queue.name), create("span", "badge", queue.code));
    const takeBtn = create("button", "btn-primary", "Ambil nomor");
    takeBtn.type = "button";
    takeBtn.dataset.code = queue.code;
    takeBtn.dataset.priority = "Normal";
    takeBtn.setAttribute("aria-label", `Ambil nomor antrian ${queue.name}`);
    const priority = create("div", "priority");
    priority.append(create("p", "priority-label", "Ambil dengan prioritas"));
    const chips = create("div", "chips");
    for (const level of EXTRA_PRIORITIES) {
        const chip = create("button", "chip", level);
        chip.type = "button";
        chip.dataset.code = queue.code;
        chip.dataset.priority = level;
        chip.setAttribute("aria-label", `Ambil nomor antrian ${queue.name} dengan prioritas ${level}`);
        chips.append(chip);
    }
    priority.append(chips);
    const waiting = create("p", "waiting");
    waitingEls.set(queue.code, waiting);
    card.append(head, takeBtn, priority, waiting);
    return card;
}
function buildCards(queues) {
    waitingEls.clear();
    if (queues.length === 0) {
        const empty = create("div", "empty-state");
        empty.append(create("strong", "", "Belum ada layanan yang tersedia"), create("span", "", "Silakan hubungi petugas untuk mendapatkan nomor antrian."));
        grid.replaceChildren(empty);
        return;
    }
    grid.replaceChildren(...queues.map(buildCard));
}
function updateWaiting(queues) {
    for (const queue of queues) {
        const el = waitingEls.get(queue.code);
        if (el)
            el.textContent = `${getWaitingTickets(queue.code).length} menunggu`;
    }
}
/**
 * Sinkronkan tampilan dengan Local Storage.
 * Kartu hanya dibangun ulang jika daftar jenis aktif berubah,
 * sehingga tombol tidak berkedip tiap polling.
 */
function refresh() {
    const queues = getActiveQueues();
    const signature = JSON.stringify(queues.map((q) => [q.code, q.name]));
    if (signature !== lastSignature) {
        lastSignature = signature;
        buildCards(queues);
    }
    updateWaiting(queues);
    statusEl.textContent = `Jenis antrian baru muncul otomatis. Data diperbarui ${new Date().toLocaleTimeString("id-ID")}.`;
}
// ---------- Hasil & pesan ----------
let resultTimer;
function showNotice(message) {
    noticeEl.textContent = message;
    noticeEl.hidden = false;
}
function hideNotice() {
    noticeEl.hidden = true;
}
function hideResult() {
    window.clearTimeout(resultTimer);
    resultEl.hidden = true;
}
function describeAhead(ticket) {
    const position = getWaitingTickets(ticket.queueCode).findIndex((t) => t.id === ticket.id);
    const ahead = Math.max(position, 0);
    return ahead === 0
        ? "Tidak ada tiket menunggu di depan Anda."
        : `${ahead} tiket menunggu di depan Anda.`;
}
function showResult(ticket, queue) {
    resultNumberEl.textContent = ticket.id;
    resultQueueEl.textContent = queue.name;
    resultMetaEl.textContent = `Prioritas ${ticket.priority}. ${describeAhead(ticket)}`;
    resultEl.hidden = false;
    resultEl.scrollIntoView({ block: "nearest" });
    // Kosongkan layar otomatis agar siap untuk pengunjung berikutnya.
    window.clearTimeout(resultTimer);
    resultTimer = window.setTimeout(hideResult, RESULT_VISIBLE_MS);
}
// ---------- Ambil tiket ----------
let cooldown = false;
function takeTicket(code, priority) {
    if (cooldown)
        return;
    // Baca ulang dari storage: admin bisa menonaktifkan layanan
    // saat halaman ini belum sempat diperbarui.
    const queue = getQueues().find((q) => q.code === code);
    if (!queue || !queue.isActive) {
        hideResult();
        showNotice(`Layanan ${queue ? queue.name : code} sedang tidak tersedia. Silakan pilih layanan lain.`);
        refresh();
        return;
    }
    // Tahan ketukan ganda yang tidak disengaja pada layar sentuh.
    cooldown = true;
    window.setTimeout(() => {
        cooldown = false;
    }, COOLDOWN_MS);
    hideNotice();
    const ticket = createTicket(code, priority);
    showResult(ticket, queue);
    refresh();
}
grid.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element))
        return;
    const button = target.closest("button[data-code]");
    if (!button)
        return;
    const { code, priority } = button.dataset;
    if (!code || !isPriority(priority))
        return;
    takeTicket(code, priority);
});
resultCloseBtn.addEventListener("click", hideResult);
// ---------- Pembaruan otomatis ----------
// Polling untuk perubahan di tab yang sama atau browser tanpa event storage.
window.setInterval(refresh, REFRESH_MS);
// Event storage memberi pembaruan instan saat admin mengubah data dari tab lain.
window.addEventListener("storage", (event) => {
    if (event.key === null ||
        event.key === STORAGE_KEYS.queues ||
        event.key === STORAGE_KEYS.tickets) {
        refresh();
    }
});
refresh();
