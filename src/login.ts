import { UserSession } from "./types.js";

const loginForm = document.getElementById("loginForm") as HTMLFormElement;
const loginBtn = document.getElementById("loginBtn") as HTMLButtonElement;
const errorMsg = document.getElementById("errorMsg") as HTMLParagraphElement;

// Set state awal tombol
loginBtn.textContent = "Masuk";

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const usernameInput = (document.getElementById("username") as HTMLInputElement).value;
    const passwordInput = (document.getElementById("password") as HTMLInputElement).value;

    loginBtn.textContent = "Memproses...";
    loginBtn.disabled = true;
    errorMsg.style.display = "none";

    try {
        const response = await fetch('https://dummyjson.com/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: usernameInput,
                password: passwordInput,
                expiresInMins: 60,
            })
        });

        if (!response.ok) {
            throw new Error("Gagal login");
        }

        const data = await response.json();

        // Menyimpan sesi
        const session: UserSession = {
            token: data.accessToken,
            username: data.username,
            firstName: data.firstName,
            role: data.role // dummyjson API merespons dengan role
        };

        localStorage.setItem("session", JSON.stringify(session));

        // Auto Redirect Berdasarkan Role
        if (session.role === "admin" || session.role === "moderator") {
            window.location.href = "index.html"; // Dashboard Admin
        } else {
            window.location.href = "operator.html"; // User diarahkan ke operator (sesuai soal)
        }

    } catch (error) {
        errorMsg.style.display = "block";
        errorMsg.textContent = "Kredensial salah atau koneksi gagal.";
    } finally {
        loginBtn.textContent = "Masuk";
        loginBtn.disabled = false;
    }
});