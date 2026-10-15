const API_LOGIN = "https://dummyjson.com/auth/login";
const API_ME = "https://dummyjson.com/auth/me";
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const errorMsg = document.getElementById("errorMsg");
/** Error untuk kredensial yang ditolak server, dibedakan dari gangguan jaringan. */
class InvalidCredentialsError extends Error {
}
// Set state awal tombol
loginBtn.textContent = "Masuk";
function showError(message) {
    errorMsg.style.display = "block";
    errorMsg.textContent = message;
}
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById("username").value;
    const passwordInput = document.getElementById("password").value;
    loginBtn.textContent = "Memproses...";
    loginBtn.disabled = true;
    errorMsg.style.display = "none";
    try {
        // 1) Login: mendapatkan token. Respons ini TIDAK berisi role.
        const response = await fetch(API_LOGIN, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: usernameInput,
                password: passwordInput,
                expiresInMins: 60,
            }),
        });
        if (!response.ok) {
            throw new InvalidCredentialsError("Gagal login");
        }
        const data = (await response.json());
        // 2) Ambil profil lengkap dengan token. Role (admin/moderator/user) ada di sini.
        const meResponse = await fetch(API_ME, {
            headers: { Authorization: `Bearer ${data.accessToken}` },
        });
        if (!meResponse.ok) {
            throw new Error("Gagal mengambil data pengguna");
        }
        const me = (await meResponse.json());
        // Menyimpan sesi
        const session = {
            token: data.accessToken,
            username: data.username,
            firstName: data.firstName,
            role: me.role ?? "user",
        };
        localStorage.setItem("session", JSON.stringify(session));
        // Auto Redirect Berdasarkan Role (moderator disamakan dengan admin)
        if (session.role === "admin" || session.role === "moderator") {
            window.location.href = "index.html"; // Dashboard Admin
        }
        else {
            window.location.href = "operator.html"; // User diarahkan ke operator (sesuai soal)
        }
    }
    catch (error) {
        if (error instanceof InvalidCredentialsError) {
            showError("Username atau password salah.");
        }
        else if (error instanceof TypeError) {
            showError("Koneksi jaringan gagal. Periksa internet Anda lalu coba lagi.");
        }
        else {
            showError("Terjadi kesalahan saat masuk. Silakan coba lagi.");
        }
    }
    finally {
        loginBtn.textContent = "Masuk";
        loginBtn.disabled = false;
    }
});
export {};