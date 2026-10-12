import { Ticket, QueueType } from "./types.js";
import {
    getSession,
    clearSession,
    isAdminRole,
    getQueues,
    getWaitingTickets,
    getCalledTicket,
    getSkippedTickets,
    countFinished,
    callNext,
    finishTicket,
    skipTicket,
    requeueTicket,
    STORAGE_KEYS,
} from "./storage.js";

// --- AUTH GUARD (wajib login, semua role boleh) ---
const session = getSession();
if (!session) {
    window.location.href = "login.html";
    throw new Error("Belum login");
}

// --- ELEMEN DOM ---
const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;

const operatorName = $<HTMLSpanElement>("operatorName");
const operatorRole = $<HTMLSpanElement>("operatorRole");
const adminLink = $<HTMLAnchorElement>("adminLink");
const logoutBtn = $<HTMLButtonElement>("logoutBtn");

const queueSelect = $<HTMLSelectElement>("queueSelect");
const soundToggle = $<HTMLInputElement>("soundToggle");

const currentTicket = $<HTMLDivElement>("currentTicket");
const currentMeta = $<HTMLParagraphElement>("currentMeta");
const nextTicket = $<HTMLSpanElement>("nextTicket");
const nextMeta = $<HTMLSpanElement>("nextMeta");

const statWaiting = $<HTMLSpanElement>("statWaiting");
const statFinished = $<HTMLSpanElement>("statFinished");
const statSkipped = $<HTMLSpanElement>("statSkipped");

const btnNext = $<HTMLButtonElement>("btnNext");
const btnRecall = $<HTMLButtonElement>("btnRecall");
const btnFinish = $<HTMLButtonElement>("btnFinish");
const btnSkip = $<HTMLButtonElement>("btnSkip");

const waitingList = $<HTMLUListElement>("waitingList");
const skippedList = $<HTMLUListElement>("skippedList");
const toast = $<HTMLDivElement>("toast");

const SELECTED_QUEUE_KEY = "operatorQueue";
const SOUND_KEY = "operatorSound";
const POLL_INTERVAL_MS = 2000;

// --- HEADER ---
operatorName.textContent = session.firstName;
operatorRole.textContent = session.role;
if (isAdminRole(session.role)) {
    adminLink.hidden = false; 
}

logoutBtn.addEventListener("click", () => {
    clearSession();
    window.location.href = "login.html";
});

// --- UTIL ---
let toastTimer: number | undefined;
function showToast(message: string): void {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2500);
}

function selectedQueue(): QueueType | undefined {
    return getQueues().find((q) => q.code === queueSelect.value);
}

function buildListItem(
    ticket: Ticket,
    action?: { label: string; onClick: () => void }
): HTMLLIElement {
    const li = document.createElement("li");

    const info = document.createElement("div");
    const id = document.createElement("strong");
    id.textContent = ticket.id;
    const badge = document.createElement("span");
    badge.className = `badge badge-${ticket.priority.toLowerCase()}`;
    badge.textContent = ticket.priority;
    const time = document.createElement("small");
    time.textContent = new Date(ticket.timestamp).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
    });
    info.append(id, badge, time);
    li.appendChild(info);

    if (action) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = action.label;
        btn.addEventListener("click", action.onClick);
        li.appendChild(btn);
    }
    return li;
}

function emptyItem(text: string): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = text;
    return li;
}

// --- SUARA PANGGILAN ---
function announce(ticket: Ticket): void {
    if (!soundToggle.checked || !("speechSynthesis" in window)) return;

    const [code, num] = ticket.id.split("-");
    const queueName = selectedQueue()?.name ?? "";
    const text = `Nomor antrian ${code}, ${parseInt(num, 10)}. Silakan menuju loket ${queueName}.`;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "id-ID";
    utter.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
}

// --- RENDER ---
let renderedQueueSignature = "";

function renderQueueOptions(): void {
    const queues = getQueues();
    const signature = JSON.stringify(queues);
    if (signature === renderedQueueSignature) return;
    renderedQueueSignature = signature;

    const previous = queueSelect.value || localStorage.getItem(SELECTED_QUEUE_KEY) || "";
    queueSelect.innerHTML = "";

    if (queues.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Belum ada jenis antrian";
        queueSelect.appendChild(opt);
        return;
    }

    queues.forEach((q) => {
        const opt = document.createElement("option");
        opt.value = q.code;
        opt.textContent = `${q.name} (${q.code})${q.isActive ? "" : " - nonaktif"}`;
        queueSelect.appendChild(opt);
    });

    queueSelect.value = queues.some((q) => q.code === previous)
        ? previous
        : queues[0].code;
    localStorage.setItem(SELECTED_QUEUE_KEY, queueSelect.value);
}

function render(): void {
    renderQueueOptions();

    const code = queueSelect.value;
    const queue = selectedQueue();

    if (!queue) {
        currentTicket.textContent = "-";
        currentMeta.textContent = "Admin belum membuat jenis antrian.";
        nextTicket.textContent = "-";
        nextMeta.textContent = "";
        statWaiting.textContent = statFinished.textContent = statSkipped.textContent = "0";
        waitingList.replaceChildren(emptyItem("Tidak ada data."));
        skippedList.replaceChildren(emptyItem("Tidak ada data."));
        [btnNext, btnRecall, btnFinish, btnSkip].forEach((b) => (b.disabled = true));
        return;
    }

    const called = getCalledTicket(code);
    const waiting = getWaitingTickets(code);
    const skipped = getSkippedTickets(code);

    // Tiket yang sedang dipanggil
    if (called) {
        currentTicket.textContent = called.id;
        currentMeta.textContent = `Prioritas ${called.priority}`;
    } else {
        currentTicket.textContent = "-";
        currentMeta.textContent = "Belum ada tiket yang dipanggil.";
    }

    // Tiket berikutnya
    if (waiting.length > 0) {
        nextTicket.textContent = waiting[0].id;
        nextMeta.textContent = `Prioritas ${waiting[0].priority}`;
    } else {
        nextTicket.textContent = "-";
        nextMeta.textContent = "Antrian kosong";
    }

    // Statistik
    statWaiting.textContent = String(waiting.length);
    statFinished.textContent = String(countFinished(code));
    statSkipped.textContent = String(skipped.length);

    // Daftar tunggu & dilewati
    waitingList.replaceChildren(
        ...(waiting.length
            ? waiting.map((t) => buildListItem(t))
            : [emptyItem("Tidak ada tiket menunggu.")])
    );
    skippedList.replaceChildren(
        ...(skipped.length
            ? skipped.map((t) =>
                  buildListItem(t, {
                      label: "Kembalikan ke antrian",
                      onClick: () => {
                          requeueTicket(t.id);
                          showToast(`${t.id} dikembalikan ke antrian.`);
                          render();
                      },
                  })
              )
            : [emptyItem("Tidak ada tiket dilewati.")])
    );

    // Status tombol
    btnNext.disabled = waiting.length === 0;
    btnRecall.disabled = !called;
    btnFinish.disabled = !called;
    btnSkip.disabled = !called;
}

// --- AKSI OPERATOR ---
btnNext.addEventListener("click", () => {
    const ticket = callNext(queueSelect.value);
    if (ticket) {
        showToast(`Memanggil ${ticket.id}`);
        announce(ticket);
    } else {
        showToast("Tidak ada tiket yang menunggu.");
    }
    render();
});

btnRecall.addEventListener("click", () => {
    const called = getCalledTicket(queueSelect.value);
    if (called) {
        showToast(`Memanggil ulang ${called.id}`);
        announce(called);
    }
});

btnFinish.addEventListener("click", () => {
    const called = getCalledTicket(queueSelect.value);
    if (called && finishTicket(called.id)) {
        showToast(`${called.id} selesai.`);
    }
    render();
});

btnSkip.addEventListener("click", () => {
    const called = getCalledTicket(queueSelect.value);
    if (called && skipTicket(called.id)) {
        showToast(`${called.id} dilewati.`);
    }
    render();
});

queueSelect.addEventListener("change", () => {
    localStorage.setItem(SELECTED_QUEUE_KEY, queueSelect.value);
    render();
});

soundToggle.checked = localStorage.getItem(SOUND_KEY) !== "off";
soundToggle.addEventListener("change", () => {
    localStorage.setItem(SOUND_KEY, soundToggle.checked ? "on" : "off");
    if (!soundToggle.checked) window.speechSynthesis?.cancel();
});

// --- REAL-TIME: polling + event storage (antar tab) ---
window.setInterval(render, POLL_INTERVAL_MS);
window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.tickets || e.key === STORAGE_KEYS.queues) render();
});

// Inisialisasi awal
render();