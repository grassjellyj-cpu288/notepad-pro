// ==================== script4.js – ระบบล้างขยะ โปร่งใส ไม่ยุ่งกับไฟล์อื่น ====================
// ฟังก์ชัน: ล้าง localStorage, clear console, revoke object URLs, เคลียร์ speech synthesis ค้าง, 
//          และแจ้งเตือนด้วยเสียงแบบเดียวกับ script1/3
(function() {
    // ---------- พูดตอบกลับ (ใช้ร่วมกับ speechSynthesis) ----------
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

    // ---------- แสดง Toast เล็ก ๆ (ไม่รบกวน UI) ----------
    function showToast(msg, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed; bottom: 80px; right: 20px; z-index: 10000;
            background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
            color: ${isError ? '#ff8888' : '#ccff88'};
            padding: 8px 16px; border-radius: 40px;
            font-size: 13px; font-family: monospace;
            border-left: 3px solid ${isError ? '#f44336' : '#4caf50'};
            pointer-events: none; transition: 0.2s;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    // ---------- ฟังก์ชันล้างขยะหลัก ----------
    function clearGarbage() {
        let clearedItems = [];

        // 1. ล้าง LocalStorage (ยกเว้น key ที่จำเป็น ตามที่ต้องการ)
        //    แต่เพื่อความปลอดภัย จะล้างเฉพาะ key ที่เกี่ยวกับ editor, zip, voice ถ้ามี
        const keysToKeep = ['editorFontScale', 'editorDarkMode']; // ค่าที่ script2 ใช้อาจเก็บไว้
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!keysToKeep.includes(key)) {
                    localStorage.removeItem(key);
                    clearedItems.push(`localStorage:${key}`);
                }
            }
        } catch(e) { console.warn(e); }

        // 2. เคลียร์ speechSynthesis ค้าง
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            clearedItems.push('speechSynthesis (ยกเลิกการพูดค้าง)');
        }

        // 3. รีโวค Object URLs ทั้งหมดที่อาจค้าง (หา <img> ที่ src ขึ้นต้นด้วย blob:)
        const images = document.querySelectorAll('img[src^="blob:"]');
        images.forEach(img => {
            const url = img.src;
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
                clearedItems.push(`revoke blob: ${url.substring(0, 50)}...`);
            }
        });

        // 4. เคลียร์ console (ถ้าต้องการ)
        if (typeof console !== 'undefined' && console.clear) {
            console.clear();
            clearedItems.push('console.clear()');
        }

        // 5. พยายามกระตุ้น GC (ไม่สามารถบังคับได้ แต่ hint)
        if (window.gc) {
            window.gc();
            clearedItems.push('window.gc() hint');
        } else if (typeof globalThis.gc === 'function') {
            globalThis.gc();
        }

        // 6. ล้าง history ของ editor ถ้าสามารถเข้าถึงได้โดยไม่รบกวนเจ้าของ
        //    (ใช้ optional chaining อย่างนุ่มนวล)
        if (typeof window.historyStack !== 'undefined' && Array.isArray(window.historyStack)) {
            const oldLen = window.historyStack.length;
            window.historyStack = [window.historyStack[window.historyIndex] || ''];
            window.historyIndex = 0;
            clearedItems.push(`editor history (ลดจาก ${oldLen} → 1)`);
        }

        // 7. ล้างตัวแปรชั่วคราวที่เราสร้างเอง (ถ้ามี)
        if (window._tempData) delete window._tempData;

        // สรุปผล
        const msg = `🗑️ ล้างขยะเสร็จสิ้น: ${clearedItems.length} รายการ`;
        showToast(msg);
        speakResponse('ล้างขยะโปรแกรมเรียบร้อยครับเจ้านาย');
        console.log(msg, clearedItems);
        return clearedItems;
    }

    // ---------- เพิ่มปุ่มล้างขยะแบบ Glassmorphism (กระจกใส) ----------
    function addCleanButton() {
        // หา toolbar หรือสร้าง container ใหม่
        const tryAdd = () => {
            let container = document.querySelector('.toolbar') || 
                           document.querySelector('.button-group') ||
                           document.querySelector('.editor-toolbar') ||
                           document.getElementById('toolbar');
            
            if (!container) {
                const editor = document.getElementById('editor') || document.querySelector('[contenteditable="true"]');
                if (editor && editor.parentNode) {
                    container = document.createElement('div');
                    container.className = 'clean-toolbar glass-toolbar';
                    container.style.cssText = `
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        gap: 10px;
                        margin-bottom: 12px;
                        padding: 6px 14px;
                        background: rgba(255, 255, 255, 0.2);
                        backdrop-filter: blur(12px);
                        border-radius: 40px;
                        border: 1px solid rgba(255, 255, 255, 0.3);
                    `;
                    editor.parentNode.insertBefore(container, editor);
                } else {
                    return false;
                }
            }

            if (document.getElementById('clean-btn-group')) return true;

            const btnGroup = document.createElement('div');
            btnGroup.id = 'clean-btn-group';
            btnGroup.style.cssText = 'display: flex; gap: 8px; align-items: center;';

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
                    border: 1px solid rgba(255,255,255,0.4);
                    color: white;
                    padding: 5px 12px;
                    font-size: 12px;
                    font-weight: 500;
                    border-radius: 32px;
                    cursor: pointer;
                    transition: 0.2s;
                    backdrop-filter: blur(4px);
                `;
                btn.onclick = onClick;
                btn.onmouseover = () => btn.style.transform = 'scale(1.02)';
                btn.onmouseout = () => btn.style.transform = 'scale(1)';
                return btn;
            };

            btnGroup.appendChild(createGlassBtn('🗑️ ล้างขยะ', 'ล้าง cache, console, blob URLs, และหน่วยความจำชั่วคราว', '#9c27b0', clearGarbage));
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

    // ---------- เริ่มต้น ----------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addCleanButton);
    } else {
        addCleanButton();
    }
    setTimeout(addCleanButton, 1000);

    // เปิดเผยฟังก์ชันล้างขยะให้ script อื่นเรียกใช้ได้ (ไม่บังคับ)
    window.clearGarbage = clearGarbage;

    console.log('✅ script4.js โหลดแล้ว – ระบบล้างขยะ (ไม่ยุ่งกับไฟล์อื่น)');
})();