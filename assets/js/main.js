const SUPABASE_URL = 'https://ryhtskxqlxrgodnmoxcx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5aHRza3hxbHhyZ29kbm1veGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTIzMDcsImV4cCI6MjAyOTQyNzc3M30.5bA4DpArsnrrVu44pehNppyUHd8aGzQqxKgHnfDnwB0';

const sb_client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    const navItems = document.querySelectorAll('.nav-item');
    const logoutButton = document.getElementById('logout-button');

    if (window.location.pathname.includes('login.html')) {
        lucide.createIcons();
        return;
    }

    if (!sessionStorage.getItem('user')) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(sessionStorage.getItem('user'));
    if (user.role === 'admin') {
        document.querySelector('[data-page="absensi.html"]').style.display = 'none';
    } else {
        document.querySelector('[data-page="data perangkat.html"]').style.display = 'none';
        document.querySelector('[data-page="pengaturan jam.html"]').style.display = 'none';
        document.querySelector('[data-page="laporan rekap.html"]').style.display = 'none';
    }

    const loadPage = async (page) => {
        try {
            const response = await fetch(page);
            const content = await response.text();
            mainContent.innerHTML = content;
            lucide.createIcons(); // Refresh icons

            if (page === 'data perangkat.html') {
                await getPerangkat();
            } else if (page === 'absensi.html') {
                checkLocation();
            }
        } catch (error) {
            console.error('Error loading page:', error);
            mainContent.innerHTML = '<p>Gagal memuat halaman.</p>';
        }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            if (page) {
                loadPage(page);

                // Handle active state
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });

    logoutButton.addEventListener('click', handleLogout);

    // Load default page
    loadPage('beranda.html');
});

async function handleLogin() {
    const nipd = document.getElementById('nipd').value;
    const pass = document.getElementById('pass').value;
    console.log(`Mencoba login dengan NIPD: ${nipd}, Password: ${pass}`);

    const { data, error } = await sb_client
        .from('perangkat')
        .select('*')
        .eq('nipd', nipd)
        .single();

    // Log the result from Supabase
    console.log("Data dari Supabase:", data);
    console.log("Error dari Supabase:", error);

    if (error || !data) {
        alert('Login Gagal. Cek console browser untuk detail (tekan F12). NIPD mungkin tidak ditemukan atau ada masalah koneksi.');
        console.error("Kesalahan saat mengambil data atau NIPD tidak ditemukan.", error);
        return;
    }

    console.log("Data pengguna ditemukan:", data);
    console.log(`Password dari DB: '${data.password}', Password yang dimasukkan: '${pass}'`);

    if (data.password !== pass) {
        alert('Password salah. Cek console browser untuk detail (tekan F12).');
        console.error("Perbandingan password gagal.");
        return;
    }

    console.log("Login berhasil! Mengarahkan ke index.html");
    sessionStorage.setItem('user', JSON.stringify(data));
    window.location.href = 'index.html';
}

function handleLogout() {
    sessionStorage.removeItem('user');
    window.location.href = 'login.html';
}

async function getPerangkat() {
    const { data, error } = await sb_client
        .from('perangkat')
        .select('*');

    if (error) {
        console.error('Error fetching perangkat:', error);
        return;
    }

    const userTableBody = document.getElementById('userTableBody');
    userTableBody.innerHTML = ''; // Clear existing data

    data.forEach(perangkat => {
        const row = `
            <tr id="row-${perangkat.id}">
                <td><strong>${perangkat.nama}</strong></td>
                <td>${perangkat.nipd}</td>
                <td>${perangkat.jabatan}</td>
                <td align="right">
                    <button onclick="deletePerangkat(${perangkat.id})" style="color:var(--danger); background:none; border:none; cursor:pointer;">
                        <i data-lucide="trash-2" size="16"></i>
                    </button>
                </td>
            </tr>
        `;
        userTableBody.insertAdjacentHTML('beforeend', row);
    });
    lucide.createIcons();
}

async function addPerangkat() {
    const newName = document.getElementById('newName').value;
    const newNIPD = document.getElementById('newNIPD').value;
    const newJab = document.getElementById('newJab').value;

    if (!newName || !newNIPD || !newJab) {
        alert('Harap isi semua kolom!');
        return;
    }

    const { data, error } = await sb_client
        .from('perangkat')
        .insert([{ nama: newName, nipd: newNIPD, jabatan: newJab }]);

    if (error) {
        console.error('Error adding perangkat:', error);
        alert('Gagal menambahkan data perangkat.');
        return;
    }

    closeModal();
    await getPerangkat();
    alert('Data berhasil disimpan!');
}

async function deletePerangkat(id) {
    if (confirm('Hapus data ini?')) {
        const { error } = await sb_client
            .from('perangkat')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting perangkat:', error);
            alert('Gagal menghapus data perangkat.');
            return;
        }

        await getPerangkat();
        alert('Data berhasil dihapus!');
    }
}

function openModal() {
    document.getElementById('modalAdd').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalAdd').style.display = 'none';
    document.getElementById('newName').value = '';
    document.getElementById('newNIPD').value = '';
    document.getElementById('newJab').value = '';
}

function checkLocation() {
    const KANTOR_LAT = -7.382104;
    const KANTOR_LNG = 109.658302;
    const MAX_DISTANCE = 50; // meters

    const absenButton = document.querySelector('.btn-absensi');
    const statusBar = document.querySelector('.status-bar');

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            const distance = haversineDistance(
                { lat: KANTOR_LAT, lng: KANTOR_LNG },
                { lat: userLat, lng: userLng }
            );

            if (distance <= MAX_DISTANCE) {
                absenButton.disabled = false;
                absenButton.textContent = 'AMBIL FOTO & ABSEN MASUK';
                statusBar.innerHTML = '<i data-lucide="check-circle-2" size="18"></i> TERKUNCI DI AREA KANTOR';
                statusBar.style.color = 'var(--success)';
            } else {
                absenButton.disabled = true;
                absenButton.textContent = 'ANDA BERADA DI LUAR JANGKAUAN';
                statusBar.innerHTML = '<i data-lucide="alert-triangle" size="18"></i> ANDA BERADA DI LUAR JANGKAUAN';
                statusBar.style.color = 'var(--danger)';
            }
            lucide.createIcons();
        }, () => {
            alert('Tidak bisa mendapatkan lokasi. Pastikan GPS Anda aktif.');
        });
    } else {
        alert('Geolocation tidak didukung oleh browser ini.');
    }
}

function haversineDistance(coords1, coords2) {
    function toRad(x) {
        return x * Math.PI / 180;
    }

    const R = 6371; // km
    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const lat1 = toRad(coords1.lat);
    const lat2 = toRad(coords2.lat);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    return d * 1000; // meters
}