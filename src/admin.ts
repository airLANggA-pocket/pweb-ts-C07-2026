import { UserSession, QueueType, Ticket, Priority } from "./types.js";

// --- AUTH GUARD ---
const sessionStr = localStorage.getItem("session");
if (!sessionStr) {
    window.location.href = "login.html";
} else {
    const session: UserSession = JSON.parse(sessionStr);
    if (session.role !== "admin" && session.role !== "moderator") {
        window.location.href = "login.html"; // Paksa keluar jika bukan admin
    }
    (document.getElementById("adminName") as HTMLSpanElement).textContent = session.firstName;
    (document.getElementById("adminRole") as HTMLSpanElement).textContent = session.role;
}

// --- LOGOUT ---
document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("session");
    window.location.href = "login.html";
});

// --- MANAJEMEN JENIS ANTRIAN ---
const queueForm = document.getElementById("queueForm") as HTMLFormElement;
const queueList = document.getElementById("queueList") as HTMLUListElement;
const queueSelect = document.getElementById("queueSelect") as HTMLSelectElement;

function getQueues(): QueueType[] {
    return JSON.parse(localStorage.getItem("queues") || "[]");
}

function saveQueues(queues: QueueType[]) {
    localStorage.setItem("queues", JSON.stringify(queues));
    renderQueues();
}

function renderQueues() {
    const queues = getQueues();
    queueList.innerHTML = "";
    queueSelect.innerHTML = '<option value="">Pilih jenis antrian</option>';

    queues.forEach((q, index) => {
        // Render di daftar (kiri)
        const li = document.createElement("li");
        li.innerHTML = `
            <div><strong>${q.name.toUpperCase()} (${q.code})</strong> <br> <small>${q.isActive ? 'Aktif' : 'Nonaktif'}</small></div>
            <div>
                <button onclick="toggleQueue(${index})">${q.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button onclick="deleteQueue(${index})" style="color: red; border: 1px solid red; background: transparent;">Hapus</button>
            </div>
        `;
        queueList.appendChild(li);

        // Render di select manual (kanan) - hanya yang aktif
        if (q.isActive) {
            const option = document.createElement("option");
            option.value = q.code;
            option.textContent = `${q.name} (${q.code})`;
            queueSelect.appendChild(option);
        }
    });
}

/// Fungsi global untuk button onclick HTML
(window as any).toggleQueue = (index: number) => {
    const queues = getQueues();
    // Tambahkan pengecekan if ini
    if (queues[index]) { 
        queues[index].isActive = !queues[index].isActive;
        saveQueues(queues);
    }
};

(window as any).deleteQueue = (index: number) => {
    const queues = getQueues();
    if (queues[index]) {
        queues.splice(index, 1);
        saveQueues(queues);
    }
};

(window as any).deleteQueue = (index: number) => {
    const queues = getQueues();
    queues.splice(index, 1);
    saveQueues(queues);
};

queueForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = (document.getElementById("queueCode") as HTMLInputElement).value.toUpperCase();
    const name = (document.getElementById("queueName") as HTMLInputElement).value;
    
    const queues = getQueues();
    // Validasi duplikasi (case-insensitive)
    if (queues.find(q => q.code === code || q.name.toLowerCase() === name.toLowerCase())) {
        alert("Kode atau Nama antrian sudah digunakan!");
        return;
    }

    queues.push({ code, name, isActive: true });
    saveQueues(queues);
    queueForm.reset();
});

// --- PENERBITAN TIKET MANUAL ---
const manualTicketForm = document.getElementById("manualTicketForm") as HTMLFormElement;

manualTicketForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = (document.getElementById("queueSelect") as HTMLSelectElement).value;
    const priority = (document.getElementById("prioritySelect") as HTMLSelectElement).value as Priority;
    
    if (!code) return alert("Pilih jenis antrian");

    const tickets: Ticket[] = JSON.parse(localStorage.getItem("tickets") || "[]");
    
    // Cari nomor terakhir untuk kode ini
    const codeTickets = tickets.filter(t => t.queueCode === code);
    const nextNumber = codeTickets.length + 1;
    const ticketId = `${code}-${nextNumber.toString().padStart(3, '0')}`; // contoh: C-001

    const newTicket: Ticket = {
        id: ticketId,
        queueCode: code,
        priority: priority,
        status: "Menunggu",
        timestamp: Date.now()
    };

    tickets.push(newTicket);
    localStorage.setItem("tickets", JSON.stringify(tickets));
    alert(`Tiket ${ticketId} berhasil diterbitkan!`);
    manualTicketForm.reset();
});

// --- RESET ANTRIAN ---
document.getElementById("resetBtn")?.addEventListener("click", () => {
    if (confirm("Yakin ingin mereset seluruh data antrian hari ini?")) {
        localStorage.removeItem("tickets");
        alert("Antrian telah direset ke awal.");
    }
});

// Inisialisasi awal
renderQueues();