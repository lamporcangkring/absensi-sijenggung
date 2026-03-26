const SUPABASE_URL = 'https://ryhtskxqlxrgodnmoxcx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5kd_o_sNhWmSegWYPaf_og_Co3-XQj6';

const sb_client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Fungsi untuk cek session di setiap halaman
function checkSession() {
    const user = JSON.parse(sessionStorage.getItem('user'));
    const isLoginPage = window.location.pathname.includes('login.html');

    if (!user && !isLoginPage) {
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

// Inisialisasi Lucide Icons jika ada
if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

async function handleLogin() {
    const nipd = document.getElementById('nipd').value;
    const pass = document.getElementById('pass').value;

    if (!nipd || !pass) {
        alert('Harap isi NIPD dan Password!');
        return;
    }

    const { data, error } = await sb_client
        .from('perangkat')
        .select('*')
        .eq('nipd', nipd)
        .single();

    if (error || !data) {
        alert('Login Gagal: NIPD tidak ditemukan.');
        return;
    }

    if (data.password !== pass) {
        alert('Password salah.');
        return;
    }

    sessionStorage.setItem('user', JSON.stringify(data));
    
    if (data.role === 'admin') {
        window.location.href = 'dashboard admin.html';
    } else {
        window.location.href = 'beranda.html';
    }
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
    if (!userTableBody) return;
    
    userTableBody.innerHTML = '';

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

    const { error } = await sb_client
        .from('perangkat')
        .insert([{ 
            nama: newName, 
            nipd: newNIPD, 
            jabatan: newJab,
            password: '123', // Default password
            role: 'perangkat' // Default role
        }]);

    if (error) {
        console.error('Error adding perangkat:', error);
        alert('Gagal menambahkan data perangkat: ' + error.message);
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

// --- ABSENSI LOGIC ---
async function initCamera() {
    const video = document.getElementById('webcam');
    if (!video) return;
    const errorMsg = document.querySelector('.no-camera-msg');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" }, 
            audio: false 
        });
        video.srcObject = stream;
        if (errorMsg) errorMsg.style.display = 'none';
    } catch (err) {
        console.error("Gagal akses kamera: ", err);
        if (errorMsg) {
            errorMsg.innerHTML = '<span style="color: #dc3545">Gagal akses kamera.</span>';
        }
    }
}

async function checkLocation() {
    // Default values
    let KANTOR_LAT = -7.382104;
    let KANTOR_LNG = 109.658302;
    let MAX_DISTANCE = 50; // meters

    // Try to get from config table
    const { data: config } = await sb_client
        .from('config')
        .select('*')
        .eq('id', 1)
        .single();
    
    if (config) {
        KANTOR_LAT = parseFloat(config.lat);
        KANTOR_LNG = parseFloat(config.lng);
        MAX_DISTANCE = parseInt(config.radius);
    }

    const absenButton = document.getElementById('absensiButton');
    const gpsStatus = document.querySelector('.gps-status');

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            const distance = haversineDistance(
                { lat: KANTOR_LAT, lng: KANTOR_LNG },
                { lat: userLat, lng: userLng }
            );

            if (distance <= MAX_DISTANCE) {
                if (absenButton) {
                    absenButton.disabled = false;
                    absenButton.style.background = 'var(--success-green)';
                    absenButton.textContent = 'AMBIL FOTO & ABSEN MASUK';
                }
                if (gpsStatus) {
                    gpsStatus.innerHTML = '<i data-lucide="check-circle" size="18"></i> LOKASI AMAN: DALAM AREA KANTOR';
                    gpsStatus.style.color = 'var(--success-green)';
                    gpsStatus.style.background = '#e7f3ef';
                }
            } else {
                if (absenButton) {
                    absenButton.disabled = true;
                    absenButton.style.background = '#ccc';
                    absenButton.textContent = 'ANDA DI LUAR JANGKAUAN';
                }
                if (gpsStatus) {
                    gpsStatus.innerHTML = '<i data-lucide="alert-triangle" size="18"></i> DI LUAR JANGKAUAN (' + Math.round(distance) + 'm)';
                    gpsStatus.style.color = '#dc3545';
                    gpsStatus.style.background = '#fdecea';
                }
            }
            lucide.createIcons();
        }, (err) => {
            console.error('Geolocation error:', err);
            alert('Gagal mendapatkan lokasi: ' + err.message + '. Pastikan GPS aktif dan izin diberikan.');
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    }
}

function haversineDistance(coords1, coords2) {
    function toRad(x) { return x * Math.PI / 180; }
    const R = 6371; // km
    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(toRad(coords1.lat)) * Math.cos(toRad(coords2.lat));
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // meters
}

function setTodayDate() {
    const display = document.getElementById('currentDateDisplay');
    if (!display) return;
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    display.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

async function updateDashboardStats() {
    // Get Total Perangkat
    const { count: totalPerangkat } = await sb_client
        .from('perangkat')
        .select('*', { count: 'exact', head: true });

    // Get Today's Attendance
    const today = new Date().toISOString().split('T')[0];
    const { count: totalHadir } = await sb_client
        .from('presensi')
        .select('*', { count: 'exact', head: true })
        .eq('tanggal', today);

    // Update UI if elements exist
    const totalEl = document.querySelector('.card:nth-child(1) h2');
    const hadirEl = document.querySelector('.card:nth-child(2) h2');
    
    if (totalEl) totalEl.textContent = totalPerangkat || 0;
    if (hadirEl) hadirEl.textContent = totalHadir || 0;
}

// --- CONFIGURATION LOGIC ---
async function loadConfig() {
    try {
        const { data, error } = await sb_client
            .from('config')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) throw error;

        if (data) {
            const fields = {
                'jamMasuk': data.jam_masuk,
                'toleransi': data.toleransi,
                'jamPulang': data.jam_pulang,
                'lat': data.lat,
                'lng': data.lng,
                'radius': data.radius
            };

            for (const [id, value] of Object.entries(fields)) {
                const el = document.getElementById(id);
                if (el) el.value = value;
            }
            return data;
        }
    } catch (err) {
        console.warn('Gagal memuat konfigurasi dari database, menggunakan default.', err);
        return null;
    }
}

async function saveConfig(btn) {
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Menyimpan...';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const config = {
        id: 1,
        jam_masuk: document.getElementById('jamMasuk')?.value,
        toleransi: parseInt(document.getElementById('toleransi')?.value) || 0,
        jam_pulang: document.getElementById('jamPulang')?.value,
        lat: parseFloat(document.getElementById('lat')?.value) || 0,
        lng: parseFloat(document.getElementById('lng')?.value) || 0,
        radius: parseInt(document.getElementById('radius')?.value) || 0,
    };

    try {
        const { error } = await sb_client
            .from('config')
            .upsert([config], { onConflict: 'id' });

        if (error) throw error;
        alert('✅ Pengaturan Berhasil Disimpan!');
    } catch (err) {
        console.error('Error saving config:', err);
        alert('❌ Gagal menyimpan: ' + (err.message || 'Cek console browser (F12)'));
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
