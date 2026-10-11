export interface UserSession {
    token: string;
    username: string;
    firstName: string;
    role: string;
}

export interface QueueType {
    code: string; // contoh: 'C'
    name: string; // contoh: 'Farmasi'
    isActive: boolean;
}

export type Priority = "Normal" | "Lansia" | "Disabilitas" | "VIP";
export type TicketStatus = "Menunggu" | "Dipanggil" | "Selesai" | "Dilewati";

export interface Ticket {
    id: string; // format: Kode-Nomor (A-001)
    queueCode: string;
    priority: Priority;
    status: TicketStatus;
    timestamp: number;
}