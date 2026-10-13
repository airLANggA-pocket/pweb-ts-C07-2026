export const STORAGE_KEYS = {
    session: "session",
    queues: "queues",
    tickets: "tickets",
};
function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    }
    catch {
        return fallback;
    }
}
function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}
export function getSession() {
    const session = readJSON(STORAGE_KEYS.session, null);
    return session && session.token ? session : null;
}
export function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.session);
}
export function isAdminRole(role) {
    return role === "admin" || role === "moderator";
}
// ---------- Jenis antrian ----------
export function getQueues() {
    return readJSON(STORAGE_KEYS.queues, []);
}
export function saveQueues(queues) {
    writeJSON(STORAGE_KEYS.queues, queues);
}
// ---------- Tiket: baca & tulis ----------
export function getTickets() {
    return readJSON(STORAGE_KEYS.tickets, []);
}
export function saveTickets(tickets) {
    writeJSON(STORAGE_KEYS.tickets, tickets);
}
export function resetTickets() {
    localStorage.removeItem(STORAGE_KEYS.tickets);
}
/** Nomor urut dari id tiket, "C-012" -> 12 */
export function ticketNumber(ticket) {
    const n = parseInt(ticket.id.split("-")[1] ?? "", 10);
    return Number.isNaN(n) ? 0 : n;
}
export function createTicket(queueCode, priority) {
    const tickets = getTickets();
    const lastNumber = tickets
        .filter((t) => t.queueCode === queueCode)
        .reduce((max, t) => Math.max(max, ticketNumber(t)), 0);
    const ticket = {
        id: `${queueCode}-${(lastNumber + 1).toString().padStart(3, "0")}`,
        queueCode,
        priority,
        status: "Menunggu",
        timestamp: Date.now(),
    };
    tickets.push(ticket);
    saveTickets(tickets);
    return ticket;
}
// ---------- Tiket: prioritas & query ----------
export const PRIORITY_RANK = {
    VIP: 0,
    Disabilitas: 1,
    Lansia: 2,
    Normal: 3,
};
/** Urut berdasarkan prioritas, lalu waktu datang (FIFO), lalu nomor. */
export function compareTickets(a, b) {
    return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.timestamp - b.timestamp ||
        ticketNumber(a) - ticketNumber(b));
}
/** Tiket status "Menunggu" untuk satu jenis antrian, sudah terurut prioritas. */
export function getWaitingTickets(queueCode) {
    return getTickets()
        .filter((t) => t.queueCode === queueCode && t.status === "Menunggu")
        .sort(compareTickets);
}
/** Tiket yang sedang dipanggil untuk satu jenis antrian (maks. 1). */
export function getCalledTicket(queueCode) {
    return (getTickets().find((t) => t.queueCode === queueCode && t.status === "Dipanggil") ?? null);
}
export function getSkippedTickets(queueCode) {
    return getTickets()
        .filter((t) => t.queueCode === queueCode && t.status === "Dilewati")
        .sort(compareTickets);
}
export function countFinished(queueCode) {
    return getTickets().filter((t) => t.queueCode === queueCode && t.status === "Selesai").length;
}
// ---------- Tiket: aksi operator ----------
export function callNext(queueCode) {
    const tickets = getTickets();
    const next = tickets
        .filter((t) => t.queueCode === queueCode && t.status === "Menunggu")
        .sort(compareTickets)[0];
    if (!next)
        return null;
    tickets.forEach((t) => {
        if (t.queueCode === queueCode && t.status === "Dipanggil") {
            t.status = "Selesai";
        }
    });
    next.status = "Dipanggil";
    saveTickets(tickets);
    return next;
}
/** Selesai: tutup tiket yang sedang dipanggil tanpa memanggil berikutnya. */
export function finishTicket(ticketId) {
    const tickets = getTickets();
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status !== "Dipanggil")
        return false;
    ticket.status = "Selesai";
    saveTickets(tickets);
    return true;
}
/** Lewati: tiket yang tidak hadir ditandai "Dilewati". */
export function skipTicket(ticketId) {
    const tickets = getTickets();
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status !== "Dipanggil")
        return false;
    ticket.status = "Dilewati";
    saveTickets(tickets);
    return true;
}
export function requeueTicket(ticketId) {
    const tickets = getTickets();
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status !== "Dilewati")
        return false;
    ticket.status = "Menunggu";
    ticket.timestamp = Date.now();
    saveTickets(tickets);
    return true;
}
