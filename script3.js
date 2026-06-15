// ==================== script3.js – Zip + Password Encryption + ป้องกัน Developer Tools ====================
(function() {
    // -------------------- คลาสป้องกัน DevTools --------------------
    class DevToolsProtector {
        constructor() {
            this.init();
        }

        init() {
            // ป้องกันคลิกขวา
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                return false;
            });

            // ป้องกันแป้นพิมพ์ลัด
            window.addEventListener('keydown', (e) => {
                // F12
                if (e.key === 'F12' || e.keyCode === 123) {
                    e.preventDefault();
                    this.showWarning();
                    return false;
                }
                // Ctrl+Shift+I (Windows/Linux)
                if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) {
                    e.preventDefault();
                    this.showWarning();
                    return false;
                }
                // Ctrl+Shift+J (Console)
                if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74)) {
                    e.preventDefault();
                    this.showWarning();
                    return false;
                }
                // Ctrl+Shift+C (Inspector)
                if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67)) {
                    e.preventDefault();
                    this.showWarning();
                    return false;
                }
                // Ctrl+U (View Source)
                if (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) {
                    e.preventDefault();
                    this.showWarning();
                    return false;
                }
                // Ctrl+Shift+U (อีกทาง)
                if (e.ctrlKey && e.shiftKey && (e.key === 'U' || e.key === 'u')) {
                    e.preventDefault();
                    this.showWarning();
                    return false;
                }
            });

            // ตรวจสอบการเปิด DevTools โดยดูขนาดหน้าจอ (ตรวจจับ when devtools docked)
            this.detectDevTools();

            // ล้าง console log (เพื่อไม่ให้เห็นข้อความแจ้งเตือน)
            setInterval(() => {
                if (typeof console !== 'undefined' && console.clear) {
                    console.clear();
                }
            }, 1000);
        }

        detectDevTools() {
            let check = () => {
                const threshold = 160; // ความกว้าง/สูงที่ผิดปกติ
                const widthDiff = window.outerWidth - window.innerWidth;
                const heightDiff = window.outerHeight - window.innerHeight;
                if (widthDiff > threshold || heightDiff > threshold) {
                    this.showWarning(true);
                }
                setTimeout(check, 2000);
            };
            check();
        }

        showWarning(isPersistent = false) {
            const msg = isPersistent ? '⚠️ ตรวจพบ Developer Tools! กรุณาปิดเพื่อใช้งานต่อ' : '⛔ ไม่สามารถใช้เครื่องมือนักพัฒนาบนเว็บนี้ได้';
            alert(msg);
            // ถ้าตรวจพบซ้ำ ให้ redirect หรือปิดหน้า? เลือกใช้แค่เตือน
            if (isPersistent) {
                // ตัวเลือก: ปิดหน้า หรือ ล็อกการทำงานชั่วคราว
                document.body.innerHTML = '<div style="text-align:center; margin-top:50px;"><h1>🚫 ไม่อนุญาตให้ใช้ Developer Tools</h1><p>กรุณาปิด DevTools แล้วรีเฟรชหน้า</p></div>';
            }
        }
    }

    // -------------------- ส่วนของ Zip + ล็อกเดิม (เริ่ม) --------------------
    let JSZip = null;
    let lockUntil = 0;
    
    function speakResponse(message, isError = false) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'th-TH';
        utterance.rate = 0.9;
        utterance.pitch = isError ? 1.2 : 1.0;
        utterance.volume = 1;
        const voices = window.speechSynthesis.getVoices();
        const thaiVoice = voices.find(v => v.lang === 'th-TH');
        if (thaiVoice) utterance.voice = thaiVoice;
        setTimeout(() => window.speechSynthesis.speak(utterance), 50);
    }
    
    function loadJSZip() {
        return new Promise((resolve, reject) => {
            if (window.JSZip) {
                JSZip = window.JSZip;
                resolve(JSZip);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => {
                JSZip = window.JSZip;
                resolve(JSZip);
            };
            script.onerror = () => reject('โหลด JSZip ไม่สำเร็จ');
            document.head.appendChild(script);
        });
    }

    function getEditor() {
        let editor = document.getElementById('editor');
        if (!editor) editor = document.querySelector('.editor');
        if (!editor) editor = document.querySelector('[contenteditable="true"]');
        return editor;
    }

    function getCurrentDocumentData() {
        const editor = getEditor();
        if (!editor) throw new Error('ไม่พบตัวแก้ไขเอกสาร');
        let fileName = 'document';
        if (window.currentFileName) fileName = window.currentFileName.replace(/\.npd$/i, '');
        return {
            fileName: fileName,
            content: editor.innerHTML,
            lastModified: new Date().toISOString()
        };
    }

    async function encryptData(plaintext, password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
        const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, passwordKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
        const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        result.set(salt, 0);
        result.set(iv, salt.length);
        result.set(new Uint8Array(encrypted), salt.length + iv.length);
        return result;
    }

    async function decryptData(encryptedData, password) {
        const salt = encryptedData.slice(0, 16);
        const iv = encryptedData.slice(16, 28);
        const ciphertext = encryptedData.slice(28);
        const encoder = new TextDecoder();
        const passwordKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
        const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, passwordKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return encoder.decode(decrypted);
    }

    function downloadBlob(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    async function saveAsZip() {
        try {
            await loadJSZip();
            const data = getCurrentDocumentData();
            const zip = new JSZip();
            zip.file('document.npd', JSON.stringify(data, null, 2));
            const blob = await zip.generateAsync({ type: 'blob' });
            downloadBlob(blob, `${data.fileName}.zip`);
            alert('✅ บันทึกเป็น Zip (ไม่ล็อก) สำเร็จ');
        } catch (err) {
            alert('❌ ' + err.message);
        }
    }

    async function saveAsZipWithPassword() {
        const password = prompt('🔒 ตั้งรหัสผ่านสำหรับล็อกเอกสาร:');
        if (!password) return;
        if (password !== prompt('ยืนยันรหัสผ่านอีกครั้ง:')) {
            alert('รหัสผ่านไม่ตรงกัน');
            return;
        }
        try {
            await loadJSZip();
            const data = getCurrentDocumentData();
            const encryptedBytes = await encryptData(JSON.stringify(data, null, 2), password);
            const zip = new JSZip();
            zip.file('encrypted.bin', encryptedBytes);
            zip.file('meta.json', JSON.stringify({ originalName: data.fileName, timestamp: data.lastModified }));
            const blob = await zip.generateAsync({ type: 'blob' });
            downloadBlob(blob, `${data.fileName}_locked.zip`);
            alert('✅ บันทึก Zip พร้อมล็อกรหัสผ่านเรียบร้อย');
        } catch (err) {
            alert('❌ การเข้ารหัสล้มเหลว: ' + err.message);
        }
    }

    function isLocked() {
        if (Date.now() < lockUntil) {
            const remainSec = Math.ceil((lockUntil - Date.now()) / 1000);
            alert(`🔒 ระบบถูกล็อกเนื่องจากรหัสผ่านผิดพลาด กรุณารออีก ${remainSec} วินาที`);
            return true;
        }
        return false;
    }

    function setLock(minutes) {
        lockUntil = Date.now() + (minutes * 60 * 1000);
    }

    async function openZip() {
        if (isLocked()) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                await loadJSZip();
                const zip = await JSZip.loadAsync(file);
                const encryptedFile = zip.file('encrypted.bin');
                if (encryptedFile) {
                    const password = prompt('🔐 ไฟล์นี้ถูกล็อกด้วยรหัสผ่าน กรุณากรอกรหัสผ่าน:');
                    if (!password) return;
                    try {
                        const encryptedBytes = await encryptedFile.async('uint8array');
                        const decryptedJson = await decryptData(encryptedBytes, password);
                        const data = JSON.parse(decryptedJson);
                        const editor = getEditor();
                        if (editor) {
                            editor.innerHTML = data.content || '';
                            if (typeof window.saveToHistory === 'function') window.saveToHistory();
                            alert(`✅ ปลดล็อกและเปิดสำเร็จ: ${data.fileName}`);
                            speakResponse('รหัสถูกต้องครับเจ้านาย');
                        }
                    } catch (err) {
                        speakResponse('รหัสผิด คุณไม่ใช่เจ้านายผม ไฟล์จะปิดล็อกเป็นเวลา 3 นาที', true);
                        setLock(3);
                        alert('❌ รหัสผ่านไม่ถูกต้อง! ระบบจะล็อกการเปิดไฟล์เป็นเวลา 3 นาที');
                        return;
                    }
                    return;
                }
                const npdFile = zip.file('document.npd');
                if (!npdFile) throw new Error('ไม่พบไฟล์ document.npd หรือ encrypted.bin ใน Zip');
                const jsonStr = await npdFile.async('string');
                const data = JSON.parse(jsonStr);
                const editor = getEditor();
                if (editor) {
                    editor.innerHTML = data.content || '';
                    if (typeof window.saveToHistory === 'function') window.saveToHistory();
                    alert(`✅ เปิด Zip สำเร็จ: ${data.fileName}`);
                }
            } catch (err) {
                if (!isLocked()) alert('❌ เปิด Zip ไม่สำเร็จ: ' + err.message);
            }
        };
        input.click();
    }

    async function openZipWithPassword() {
        if (isLocked()) return;
        const password = prompt('🔐 กรอกรหัสผ่านเพื่อปลดล็อก:');
        if (!password) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                await loadJSZip();
                const zip = await JSZip.loadAsync(file);
                const encryptedFile = zip.file('encrypted.bin');
                if (!encryptedFile) throw new Error('ไม่พบข้อมูลที่เข้ารหัส (encrypted.bin)');
                const encryptedBytes = await encryptedFile.async('uint8array');
                const decryptedJson = await decryptData(encryptedBytes, password);
                const data = JSON.parse(decryptedJson);
                const editor = getEditor();
                if (editor) {
                    editor.innerHTML = data.content || '';
                    if (typeof window.saveToHistory === 'function') window.saveToHistory();
                    alert(`✅ ปลดล็อกและเปิดสำเร็จ: ${data.fileName}`);
                    speakResponse('รหัสถูกต้องครับเจ้านาย');
                }
            } catch (err) {
                speakResponse('รหัสผิด คุณไม่ใช่เจ้านายผม ไฟล์จะปิดล็อกเป็นเวลา 3 นาที', true);
                setLock(3);
                alert('❌ รหัสผ่านไม่ถูกต้อง! ระบบจะล็อกการเปิดไฟล์เป็นเวลา 3 นาที');
            }
        };
        input.click();
    }

    // ---------- ปุ่ม Glassmorphism (กระจกใส) ----------
    function addZipButtons() {
        const tryAdd = () => {
            let container = document.querySelector('.toolbar') || 
                           document.querySelector('.button-group') ||
                           document.querySelector('.editor-toolbar') ||
                           document.getElementById('toolbar');
            
            if (!container) {
                const editor = getEditor();
                if (editor && editor.parentNode) {
                    container = document.createElement('div');
                    container.className = 'zip-toolbar glass-toolbar';
                    container.style.cssText = `
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        gap: 10px;
                        margin-bottom: 16px;
                        padding: 8px 16px;
                        background: rgba(255, 255, 255, 0.2);
                        backdrop-filter: blur(12px);
                        border-radius: 48px;
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                    `;
                    editor.parentNode.insertBefore(container, editor);
                } else {
                    return false;
                }
            }
            
            if (document.getElementById('zip-btn-group')) return true;
            
            const btnGroup = document.createElement('div');
            btnGroup.id = 'zip-btn-group';
            btnGroup.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center;';
            
            const createGlassBtn = (text, title, baseColor, onClick) => {
                const rgba = (hex, alpha) => {
                    const r = parseInt(hex.slice(1,3), 16);
                    const g = parseInt(hex.slice(3,5), 16);
                    const b = parseInt(hex.slice(5,7), 16);
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };
                const btn = document.createElement('button');
                btn.innerText = text;
                btn.title = title;
                btn.style.cssText = `
                    background: ${rgba(baseColor, 0.75)};
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    color: white;
                    padding: 5px 12px;
                    font-size: 12px;
                    font-weight: 500;
                    border-radius: 32px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    line-height: 1.4;
                    white-space: nowrap;
                    backdrop-filter: blur(4px);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                `;
                btn.onclick = onClick;
                btn.onmouseover = () => {
                    btn.style.transform = 'scale(1.02)';
                    btn.style.background = rgba(baseColor, 0.9);
                };
                btn.onmouseout = () => {
                    btn.style.transform = 'scale(1)';
                    btn.style.background = rgba(baseColor, 0.75);
                };
                return btn;
            };
            
            btnGroup.appendChild(createGlassBtn('📦 ZIP', 'บันทึกเป็น Zip (ไม่ล็อก)', '#4CAF50', saveAsZip));
            btnGroup.appendChild(createGlassBtn('🔒 ZIP Lock', 'บันทึก Zip + รหัสผ่าน', '#f44336', saveAsZipWithPassword));
            btnGroup.appendChild(createGlassBtn('📂 เปิด ZIP', 'เปิด Zip (อัตโนมัติทั้งล็อก/ไม่ล็อก)', '#2196F3', openZip));
            btnGroup.appendChild(createGlassBtn('🔓 เปิด Lock', 'เปิดเฉพาะ Zip ที่ถูกล็อก', '#ff9800', openZipWithPassword));
            
            container.appendChild(btnGroup);
            return true;
        };
        
        if (!tryAdd()) {
            let attempts = 0;
            const interval = setInterval(() => {
                if (tryAdd() || ++attempts > 20) clearInterval(interval);
            }, 300);
        }
    }

    // -------------------- เริ่มต้นทุกอย่าง --------------------
    // 1. สร้าง instance ป้องกัน DevTools
    const protector = new DevToolsProtector();
    
    // 2. ประกาศ global functions
    window.saveAsZip = saveAsZip;
    window.saveAsZipWithPassword = saveAsZipWithPassword;
    window.openZip = openZip;
    window.openZipWithPassword = openZipWithPassword;

    // 3. เพิ่มปุ่ม Zip
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addZipButtons);
    else addZipButtons();
    setTimeout(addZipButtons, 1000);
    
    console.log('✅ script3.js โหลดแล้ว – ป้องกัน DevTools, พื้นหลังกระจกใส, เสียงตอบรับ, ล็อก 3 นาที');
})();