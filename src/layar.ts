import {
    STORAGE_KEYS,
    getCalledTicket,
    getQueues,
    getWaitingTickets,
} from "./storage.js";
import type { QueueType } from "./types.js";

const POLL_MS = 2000;
const SPEECH_DELAY_MS = 700;

// ---------- Helper DOM ----------

function requireEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Elemen #${id} tidak ditemukan di halaman.`);
    return el as T;
}

function create<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

const grid = requireEl<HTMLElement>("display-grid");
const updatedEl = requireEl<HTMLElement>("updated");
const soundBtn = requireEl<HTMLButtonElement>("sound-toggle");
const fullscreenBtn = requireEl<HTMLButtonElement>("fullscreen-toggle");

// ---------- Kartu layar ----------

interface CardRefs {
    root: HTMLElement;
    calledBox: HTMLElement;
    ticket: HTMLElement;
    emptyBox: HTMLElement;
    waiting: HTMLElement;
}

const cards = new Map<string, CardRefs>();
let lastSignature: string | null = null;

/** Nomor tiket yang terakhir tampil per kode antrian, untuk mendeteksi panggilan baru. */
const lastCalled = new Map<string, string>();

function buildCard(queue: QueueType): CardRefs {
    const root = create("article", "card card-display");

    const head = create("header", "card-head");
    head.append(create("h2", "", queue.name), create("span", "badge", queue.code));

    const display = create("div", "display");

    const calledBox = create("div");
    const ticket = create("p", "called-number");
    calledBox.append(create("p", "called-state", "Dipanggil"), ticket);

    const emptyBox = create("div");
    emptyBox.append(
        create("p", "empty-title", "Belum ada nomor dipanggil"),
        create("p", "empty-hint", "Nomor akan muncul setelah operator memanggil tiket.")
    );

    display.append(calledBox, emptyBox);

    const waiting = create("p", "waiting");

    root.append(head, display, waiting);
    return { root, calledBox, ticket, emptyBox, waiting };
}

function buildCards(queues: QueueType[]): void {
    cards.clear();

    if (queues.length === 0) {
        const empty = create("div", "empty-state");
        empty.append(
            create("strong", "", "Belum ada jenis antrian aktif"),
            create("span", "", "Layanan akan tampil di sini setelah admin mengaktifkannya.")
        );
        grid.replaceChildren(empty);
        return;
    }

    const refs = queues.map((queue) => {
        const card = buildCard(queue);
        cards.set(queue.code, card);
        return card.root;
    });
    grid.replaceChildren(...refs);
}

// ---------- Suara panggilan ----------

let soundOn = false;
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
    const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    return audioCtx;
}

/** Dua nada naik-turun sebagai penanda sebelum nomor diucapkan. */
function playChime(): void {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [659.25, 523.25].forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + index * 0.32;

        osc.type = "sine";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.32);
    });
}

const DIGIT_WORDS = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];

/** "A-012" -> "A, nol satu dua" supaya dibaca per angka oleh speech synthesis. */
function spellTicket(ticketId: string): string {
    const [code = "", digits = ""] = ticketId.split("-");
    const spoken = digits
        .split("")
        .map((d) => DIGIT_WORDS[Number(d)] ?? d)
        .join(" ");
    return `${code}, ${spoken}`;
}

function announce(ticketId: string, queueName: string): void {
    if (!soundOn) return;

    playChime();

    if (!("speechSynthesis" in window)) return;
    window.setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(
            `Nomor antrian ${spellTicket(ticketId)}. Silakan menuju ${queueName}.`
        );
        utterance.lang = "id-ID";
        utterance.rate = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }, SPEECH_DELAY_MS);
}

function updateSoundButton(): void {
    soundBtn.textContent = soundOn ? "Suara aktif" : "Suara mati";
    soundBtn.setAttribute("aria-pressed", String(soundOn));
}

soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    updateSoundButton();

    if (soundOn) {
        // Klik pengguna diperlukan browser untuk mengizinkan audio; nada ini juga jadi uji suara.
        void getAudioContext()?.resume();
        playChime();
    } else if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
});

// ---------- Render data ----------

function flash(root: HTMLElement): void {
    root.classList.remove("flash");
    void root.offsetWidth; // paksa reflow agar animasi bisa diputar ulang
    root.classList.add("flash");
}

function render(): void {
    const queues = getQueues().filter((queue) => queue.isActive);
    const signature = JSON.stringify(queues.map((q) => [q.code, q.name]));

    if (signature !== lastSignature) {
        lastSignature = signature;
        buildCards(queues);
    }

    for (const queue of queues) {
        const card = cards.get(queue.code);
        if (!card) continue;

        const called = getCalledTicket(queue.code);
        const previous = lastCalled.get(queue.code);

        card.calledBox.hidden = !called;
        card.emptyBox.hidden = Boolean(called);
        card.root.classList.toggle("is-called", Boolean(called));
        card.ticket.textContent = called ? called.id : "";
        card.waiting.textContent = `${getWaitingTickets(queue.code).length} tiket menunggu`;

        // Panggilan baru = nomor berubah setelah render pertama untuk jenis ini.
        if (called && previous !== undefined && previous !== called.id) {
            flash(card.root);
            announce(called.id, queue.name);
        }
        lastCalled.set(queue.code, called ? called.id : "");
    }

    updatedEl.textContent = `Diperbarui ${new Date().toLocaleTimeString("id-ID")}`;
}

// ---------- Layar penuh ----------

function updateFullscreenButton(): void {
    fullscreenBtn.textContent = document.fullscreenElement
        ? "Keluar layar penuh"
        : "Layar penuh";
}

async function toggleFullscreen(): Promise<void> {
    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await document.documentElement.requestFullscreen();
        }
    } catch (error) {
        console.error("Layar penuh tidak dapat diaktifkan:", error);
    }
}

if (!document.fullscreenEnabled) {
    fullscreenBtn.hidden = true;
} else {
    fullscreenBtn.addEventListener("click", () => {
        void toggleFullscreen();
    });
    document.addEventListener("fullscreenchange", updateFullscreenButton);
}

// ---------- Mulai ----------

updateSoundButton();
updateFullscreenButton();
render();
window.setInterval(render, POLL_MS);

window.addEventListener("storage", (event) => {
    if (
        event.key === null ||
        event.key === STORAGE_KEYS.queues ||
        event.key === STORAGE_KEYS.tickets
    ) {
        render();
    }
});
