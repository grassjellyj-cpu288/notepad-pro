// ==================== Notepad Pro Ultimate - Main Script (Enhanced) ====================
// ตัวแปรหลัก
const editor = document.getElementById('editor');
const lines = document.getElementById('lines');
const fileStatus = document.getElementById('fileStatus');
const charCount = document.getElementById('charCount');
const imgInput = document.getElementById('imgInput');
const colorPicker = document.getElementById('colorPicker');

let currentFileHandle = null;
let currentUtterance = null;
let currentLineHighlight = null;
let dragTarget = null;
let dragStartX = 0, dragStartY = 0, initialLeft = 0, initialTop = 0;
let lastFocusedCard = null;
let waitingForImagePlace = false;
let placeClickHandler = null;
let currentFontSize = 14;

// ตัวแปรสำหรับ Find
let lastSearchTerm = "";

// ========== UNDO/REDO SYSTEM ==========
let history = [];
let historyIndex = -1;
let isUndoRedoAction = false;

function saveToHistory() {
    if (isUndoRedoAction) return;
    
    const currentContent = editor.innerHTML;
    if (historyIndex >= 0 && history[historyIndex] === currentContent) return;
    
    // ตัด history ที่อยู่ถัดจาก index ปัจจุบัน
    history = history.slice(0, historyIndex + 1);
    history.push(currentContent);
    historyIndex++;
    
    // จำกัดประวัติไว้ที่ 100 รายการ
    if (history.length > 100) {
        history.shift();
        historyIndex--;
    }
}

function undo() {
    if (historyIndex > 0) {
        isUndoRedoAction = true;
        historyIndex--;
        editor.innerHTML = history[historyIndex];
        restoreImageCardListeners();
        updateLines();
        localStorage.setItem('notepad_content', editor.innerHTML);
        isUndoRedoAction = false;
        showToast('↩️ เลิกทำ');
    } else {
        showToast('ไม่มีประวัติให้เลิกทำ', true);
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        isUndoRedoAction = true;
        historyIndex++;
        editor.innerHTML = history[historyIndex];
        restoreImageCardListeners();
        updateLines();
        localStorage.setItem('notepad_content', editor.innerHTML);
        isUndoRedoAction = false;
        showToast('↪️ ทำซ้ำ');
    } else {
        showToast('ไม่มีประวัติให้ทำซ้ำ', true);
    }
}

function restoreImageCardListeners() {
    // คืนค่า event listeners ให้กับ image cards และ overlays
    document.querySelectorAll('.text-overlay').forEach(overlay => {
        if (!overlay.dataset.dragBound) {
            makeOverlayDraggable(overlay);
        }
        // ✅ Fix 4: เพิ่ม input handler สำหรับบันทึกการพิมพ์บน overlay
        if (!overlay.hasInputHandler) {
            const inputHandler = () => {
                saveToHistory();
                localStorage.setItem('notepad_content', editor.innerHTML);
            };
            overlay.addEventListener('input', inputHandler);
            overlay.hasInputHandler = true;
        }
    });
    
    document.querySelectorAll('.image-card').forEach(card => {
        const btn = card.querySelector('.free-move-btn');
        if (btn && !btn.dataset.listenerBound) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (card.classList.contains('floating')) {
                    setFloatingMode(card, false);
                    newBtn.innerText = '🔄 วางอิสระ';
                } else {
                    setFloatingMode(card, true);
                    newBtn.innerText = '📌 คงที่ (inline)';
                }
            });
            newBtn.dataset.listenerBound = 'true';
        }
    });
}

// ========== DEBOUNCE UTILITY ==========
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ========== UTILITIES ==========
function showToast(msg, isError = false) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    if (isError) toast.style.color = '#ff8888';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
}

function updateCharCount() {
    const text = editor.innerText;
    const chars = text.length;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    charCount.textContent = `${chars} ตัวอักษร | ${words} คำ`;
}

// ========== LINE NUMBERS ==========
function updateLines() {
    const text = editor.innerText;
    const lineArray = text.split(/\r?\n/);
    const lineCount = Math.max(lineArray.length, 1);
    lines.innerHTML = '';
    for (let i = 1; i <= lineCount; i++) {
        const div = document.createElement('div');
        div.textContent = i;
        lines.appendChild(div);
    }
    highlightCurrentLine();
    updateCharCount();
}

function highlightCurrentLine() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const preRange = range.cloneRange();
    preRange.selectNodeContents(editor);
    preRange.setEnd(range.endContainer, range.endOffset);
    const lineIdx = (preRange.toString().match(/\n/g) || []).length;
    if (currentLineHighlight !== undefined) {
        const prev = lines.children[currentLineHighlight];
        if (prev) prev.classList.remove('current-line');
    }
    const curr = lines.children[lineIdx];
    if (curr) {
        curr.classList.add('current-line');
        currentLineHighlight = lineIdx;
    }
}

function syncScroll() {
    if (editor.scrollHeight > editor.clientHeight) {
        const ratio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
        const lineMax = lines.scrollHeight - lines.clientHeight;
        lines.scrollTop = ratio * lineMax;
    }
}

// ========== FONT SIZE ==========
function setEditorFontSize(size) {
    currentFontSize = Math.min(32, Math.max(8, size));
    editor.style.fontSize = currentFontSize + 'px';
    document.querySelectorAll('.text-overlay').forEach(overlay => {
        overlay.style.fontSize = Math.max(10, currentFontSize - 2) + 'px';
    });
    localStorage.setItem('editor_font_size', currentFontSize);
}
function increaseFont() { setEditorFontSize(currentFontSize + 2); showToast(`🔤 ขนาดตัวอักษร: ${currentFontSize}px`); }
function decreaseFont() { setEditorFontSize(currentFontSize - 2); showToast(`🔤 ขนาดตัวอักษร: ${currentFontSize}px`); }
function resetFont() { setEditorFontSize(14); showToast('คืนค่าขนาดตัวอักษร 14px'); }

// ========== RESIZE IMAGE ==========
function showResizeDialog(card) {
    const img = card.querySelector('img');
    const currentWidth = img.offsetWidth;
    const currentHeight = img.offsetHeight;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); display: flex; justify-content: center;
        align-items: center; z-index: 10000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: linear-gradient(135deg, #1e1e2a, #2a2a3a);
        padding: 24px; border-radius: 20px; color: white;
        border: 1px solid #ffd700; min-width: 300px;
    `;
    
    dialog.innerHTML = `
        <h3 style="margin-bottom: 20px;">🖼️ ปรับขนาดรูปภาพ</h3>
        <div style="margin-bottom: 15px;">
            <label>ความกว้าง (px): </label>
            <input type="number" id="resizeWidth" value="${currentWidth}" 
                   style="width: 100%; padding: 8px; margin-top: 5px; border-radius: 8px;">
        </div>
        <div style="margin-bottom: 20px;">
            <label>ความสูง (px): </label>
            <input type="number" id="resizeHeight" value="${currentHeight}" 
                   style="width: 100%; padding: 8px; margin-top: 5px; border-radius: 8px;">
        </div>
        <div style="display: flex; gap: 10px;">
            <button id="resizeConfirm" style="flex:1; padding: 10px; background: #ffd700; border: none; border-radius: 8px; cursor: pointer;">✅ ยืนยัน</button>
            <button id="resizeCancel" style="flex:1; padding: 10px; background: #555; border: none; border-radius: 8px; cursor: pointer;">❌ ยกเลิก</button>
        </div>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    const widthInput = dialog.querySelector('#resizeWidth');
    const heightInput = dialog.querySelector('#resizeHeight');
    const confirmBtn = dialog.querySelector('#resizeConfirm');
    const cancelBtn = dialog.querySelector('#resizeCancel');
    
    // เก็บบันทึกอัตราส่วนเดิม
    const aspectRatio = currentWidth / currentHeight;
    
    widthInput.addEventListener('input', () => {
        const newWidth = parseInt(widthInput.value);
        if (!isNaN(newWidth)) {
            heightInput.value = Math.round(newWidth / aspectRatio);
        }
    });
    
    heightInput.addEventListener('input', () => {
        const newHeight = parseInt(heightInput.value);
        if (!isNaN(newHeight)) {
            widthInput.value = Math.round(newHeight * aspectRatio);
        }
    });
    
    confirmBtn.onclick = () => {
        const newWidth = parseInt(widthInput.value);
        const newHeight = parseInt(heightInput.value);
        
        if (newWidth > 0 && newHeight > 0) {
            img.style.width = newWidth + 'px';
            img.style.height = newHeight + 'px';
            img.style.maxWidth = 'none';
            showToast(`✨ ปรับขนาดรูปเป็น ${newWidth}x${newHeight}px`);
            saveToHistory();
            localStorage.setItem('notepad_content', editor.innerHTML);
        } else {
            showToast('กรุณาใส่ขนาดที่ถูกต้อง', true);
        }
        modal.remove();
    };
    
    cancelBtn.onclick = () => modal.remove();
}

// ========== DRAG สำหรับ FLOATING CARD ==========
function makeCardDraggable(card) {
    if (!card.classList.contains('floating')) return;
    const handle = card.querySelector('.drag-handle') || card;
    handle.style.cursor = 'grab';
    
    // ป้องกัน event listener ซ้ำซ้อน
    if (card.dataset.dragBound === 'true') return;
    card.dataset.dragBound = 'true';
    
    handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('.remove-img-btn') || e.target.closest('.add-text-btn') || 
            e.target.closest('.free-move-btn') || e.target.closest('.resize-img-btn')) return;
        e.preventDefault();
        dragTarget = card;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const leftVal = parseInt(card.style.left);
        const topVal = parseInt(card.style.top);
        initialLeft = isNaN(leftVal) ? 50 : leftVal;
        initialTop = isNaN(topVal) ? 50 : topVal;
        card.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    });
}

document.addEventListener('mousemove', (e) => {
    if (!dragTarget) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;
    const maxX = editor.clientWidth - dragTarget.offsetWidth;
    const maxY = editor.clientHeight - dragTarget.offsetHeight;
    newLeft = Math.min(Math.max(0, newLeft), maxX);
    newTop = Math.min(Math.max(0, newTop), maxY);
    dragTarget.style.left = newLeft + 'px';
    dragTarget.style.top = newTop + 'px';
    localStorage.setItem('notepad_content', editor.innerHTML);
});

// ✅ Fix 1 & 2: บันทึก History และ LocalStorage เมื่อหยุดลาก (ทั้ง overlay และ card)
document.addEventListener('mouseup', () => {
    if (dragTarget) {
        const wasOverlay = dragTarget.classList?.contains('text-overlay');
        const wasCard = dragTarget.classList?.contains('image-card');
        dragTarget.style.cursor = '';
        dragTarget = null;
        document.body.style.userSelect = '';
        if (wasOverlay || wasCard) {
            saveToHistory();
            localStorage.setItem('notepad_content', editor.innerHTML);
        }
    }
});

// ========== จัดการโหมดลอยอิสระ ==========
function setFloatingMode(card, enable, leftPos = null, topPos = null) {
    if (enable) {
        if (card.classList.contains('floating')) return;
        const rect = card.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        let left = leftPos !== null ? leftPos : (rect.left - editorRect.left);
        let top = topPos !== null ? topPos : (rect.top - editorRect.top);
        card.classList.add('floating');
        card.style.position = 'absolute';
        card.style.left = left + 'px';
        card.style.top = top + 'px';
        card.style.margin = '0';
        if (!card.querySelector('.drag-handle')) {
            const handle = document.createElement('div');
            handle.className = 'drag-handle';
            handle.innerText = '⋮⋮ ลากเพื่อย้าย ⋮⋮';
            handle.style.cursor = 'grab';
            handle.style.fontSize = '10px';
            handle.style.marginBottom = '6px';
            card.prepend(handle);
        }
        makeCardDraggable(card);
    } else {
        if (!card.classList.contains('floating')) return;
        card.classList.remove('floating');
        card.style.position = '';
        card.style.left = '';
        card.style.top = '';
        const handle = card.querySelector('.drag-handle');
        if (handle) handle.remove();
        card.style.margin = '12px 16px 12px 8px';
        delete card.dataset.dragBound;   // ✅ Fix 2: ล้าง dragBound เพื่อให้ binding ใหม่ได้เมื่อเปิดโหมดลอยอีกครั้ง
    }
    saveToHistory();
    localStorage.setItem('notepad_content', editor.innerHTML);
}

// ========== สร้างการ์ดรูป ==========
function createImageCard(imageSrc, overlayData = null, floatingData = null) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'image-card';
    cardDiv.setAttribute('data-img-src', imageSrc);

    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'img-wrapper';
    const img = document.createElement('img');
    img.src = imageSrc;
    img.style.maxWidth = '220px';
    img.style.maxHeight = '200px';
    imgWrapper.appendChild(img);

    if (overlayData && overlayData.text) {
        const overlay = document.createElement('div');
        overlay.className = 'text-overlay';
        overlay.setAttribute('contenteditable', 'true');
        overlay.innerText = overlayData.text;
        overlay.style.left = (overlayData.left || 12) + 'px';
        overlay.style.top = (overlayData.top || 12) + 'px';
        makeOverlayDraggable(overlay);
        // ✅ Fix 4: เพิ่ม input handler ให้ overlay ที่สร้างใหม่
        const inputHandler = () => {
            saveToHistory();
            localStorage.setItem('notepad_content', editor.innerHTML);
        };
        overlay.addEventListener('input', inputHandler);
        overlay.hasInputHandler = true;
        imgWrapper.appendChild(overlay);
    }
    cardDiv.appendChild(imgWrapper);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'image-card-buttons';
    const removeBtn = document.createElement('button'); removeBtn.innerText = '🗑️ ลบรูป'; removeBtn.className = 'remove-img-btn';
    const addTextBtn = document.createElement('button'); addTextBtn.innerText = '➕ ข้อความบนรูป'; addTextBtn.className = 'add-text-btn';
    const freeMoveBtn = document.createElement('button'); freeMoveBtn.innerText = '🔄 วางอิสระ'; freeMoveBtn.className = 'free-move-btn';
    const resizeBtn = document.createElement('button'); resizeBtn.innerText = '📏 ปรับขนาด'; resizeBtn.className = 'resize-img-btn';
    btnGroup.appendChild(removeBtn);
    btnGroup.appendChild(addTextBtn);
    btnGroup.appendChild(freeMoveBtn);
    btnGroup.appendChild(resizeBtn);
    cardDiv.appendChild(btnGroup);

    freeMoveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cardDiv.classList.contains('floating')) {
            setFloatingMode(cardDiv, false);
            freeMoveBtn.innerText = '🔄 วางอิสระ';
            showToast('รูปกลับสู่รูปแบบ inline แล้ว');
        } else {
            setFloatingMode(cardDiv, true);
            freeMoveBtn.innerText = '📌 คงที่ (inline)';
            showToast('รูปอยู่ในโหมดวางอิสระ ลากได้ทุกที่');
        }
    });
    
    resizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showResizeDialog(cardDiv);
    });

    if (floatingData && floatingData.enabled) {
        setFloatingMode(cardDiv, true, floatingData.left, floatingData.top);
        freeMoveBtn.innerText = '📌 คงที่ (inline)';
    }
    return cardDiv;
}

// ========== DRAGGABLE TEXT OVERLAY ==========
function makeOverlayDraggable(overlay) {
    if (!overlay || overlay.dataset.dragBound === 'true') return;
    overlay.dataset.dragBound = 'true';
    
    overlay.addEventListener('mousedown', (e) => {
        if (e.target !== overlay) return;
        if (window.getSelection().toString()) return; // กำลังเลือกข้อความ
        e.preventDefault();
        dragTarget = overlay;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const left = parseInt(overlay.style.left);
        const top = parseInt(overlay.style.top);
        initialLeft = isNaN(left) ? 10 : left;
        initialTop = isNaN(top) ? 10 : top;
        overlay.classList.add('dragging');
        document.body.style.userSelect = 'none';
    });
}

// ========== INSERT IMAGE แบบปกติ (inline) ==========
function insertImageAtCursor(imageDataUrl, customOverlay = null) {
    const card = createImageCard(imageDataUrl, customOverlay, null);
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        editor.appendChild(card);
        editor.appendChild(document.createElement('br'));
        updateLines();
        saveToHistory();
        localStorage.setItem('notepad_content', editor.innerHTML);
        showToast(`เพิ่มรูปสำเร็จ (คลิก "วางอิสระ" เพื่อลากวางได้อิสระ)`);
        return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(card);
    const br = document.createElement('br');
    range.setStartAfter(card);
    range.insertNode(br);
    range.setStartAfter(br);
    selection.removeAllRanges();
    selection.addRange(range);
    updateLines();
    saveToHistory();
    localStorage.setItem('notepad_content', editor.innerHTML);
    showToast(`✨ เพิ่มรูปแล้ว! กดปุ่ม "วางอิสระ" เพื่อลากรูปไปที่ใดก็ได้`);
}

function addNewImage() { imgInput.click(); }
imgInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => insertImageAtCursor(ev.target.result, null);
    reader.readAsDataURL(file);
    imgInput.value = '';
};

// ========== วางรูปอิสระโดยคลิกตำแหน่ง ==========
function createFloatingCardAt(x, y, imageDataUrl) {
    const card = createImageCard(imageDataUrl, null, null);
    setFloatingMode(card, true, x, y);
    editor.appendChild(card);
    updateLines();
    saveToHistory();
    localStorage.setItem('notepad_content', editor.innerHTML);
    showToast('วางรูปอิสระสำเร็จ (สามารถลากย้ายได้)');
    return card;
}

function requestImagePlaceAt(clientX, clientY) {
    const editorRect = editor.getBoundingClientRect();
    let x = clientX - editorRect.left;
    let y = clientY - editorRect.top;
    x = Math.min(Math.max(0, x), editor.clientWidth - 50);
    y = Math.min(Math.max(0, y), editor.clientHeight - 50);

    const fakeInput = document.createElement('input');
    fakeInput.type = 'file';
    fakeInput.accept = 'image/*';
    fakeInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                createFloatingCardAt(x, y, ev.target.result);
            };
            reader.readAsDataURL(file);
        }
        fakeInput.remove();
    };
    fakeInput.click();
}

function enablePlaceImageByClick() {
    if (waitingForImagePlace) {
        showToast('ยกเลิกโหมดรอคลิก', false);
        waitingForImagePlace = false;
        if (placeClickHandler) {
            editor.removeEventListener('click', placeClickHandler);
            placeClickHandler = null;
        }
        return;
    }
    waitingForImagePlace = true;
    showToast('📍 คลิกที่ตำแหน่งในเอกสารเพื่อวางรูปอิสระ (คลิกปุ่มเดิมอีกครั้งเพื่อยกเลิก)', false);
    if (placeClickHandler) editor.removeEventListener('click', placeClickHandler);
    placeClickHandler = (e) => {
        if (!waitingForImagePlace) return;
        e.stopPropagation();
        e.preventDefault();
        const clickX = e.clientX;
        const clickY = e.clientY;
        waitingForImagePlace = false;
        editor.removeEventListener('click', placeClickHandler);
        placeClickHandler = null;
        requestImagePlaceAt(clickX, clickY);
    };
    editor.addEventListener('click', placeClickHandler);
}

// ========== DRAG & DROP รูปจากภายนอก ==========
function setupDragAndDrop() {
    editor.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    editor.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                const rect = editor.getBoundingClientRect();
                let x = e.clientX - rect.left;
                let y = e.clientY - rect.top;
                x = Math.min(Math.max(0, x), editor.clientWidth - 50);
                y = Math.min(Math.max(0, y), editor.clientHeight - 50);
                createFloatingCardAt(x, y, ev.target.result);
            };
            reader.readAsDataURL(file);
        } else {
            showToast('กรุณาลากเฉพาะไฟล์รูปภาพ', true);
        }
    });
}

// ========== Event Delegation สำหรับปุ่มใน card ==========
editor.addEventListener('click', (e) => {
    const card = e.target.closest('.image-card');
    if (card) lastFocusedCard = card;
    if (e.target.classList.contains('remove-img-btn')) {
        e.stopPropagation(); 
        card?.remove(); 
        updateLines(); 
        saveToHistory();
        localStorage.setItem('notepad_content', editor.innerHTML); 
        showToast("ลบรูป");
    }
    else if (e.target.classList.contains('add-text-btn')) {
        e.stopPropagation();
        const wrapper = card?.querySelector('.img-wrapper');
        if (wrapper) {
            addTextOverlayToImage(wrapper, "📝 พิมพ์ข้อความ", 15, 15);
            saveToHistory();
            localStorage.setItem('notepad_content', editor.innerHTML);
            showToast("✅ เพิ่มกล่องข้อความบนรูป (ลากได้)");
        }
    }
});

function addTextOverlayToImage(wrapper, text, left = 15, top = 15) {
    if (wrapper.querySelector('.text-overlay')) { showToast("มีข้อความอยู่แล้ว", false); return; }
    const overlay = document.createElement('div');
    overlay.className = 'text-overlay';
    overlay.setAttribute('contenteditable', 'true');
    overlay.innerText = text;
    overlay.style.left = left + 'px';
    overlay.style.top = top + 'px';
    makeOverlayDraggable(overlay);
    const inputHandler = () => {
        saveToHistory();
        localStorage.setItem('notepad_content', editor.innerHTML);
    };
    overlay.addEventListener('input', inputHandler);
    overlay.hasInputHandler = true;
    wrapper.appendChild(overlay);
    return overlay;
}

function removeSelectedImage() {
    if (lastFocusedCard && lastFocusedCard.isConnected) {
        lastFocusedCard.remove();
        updateLines();
        saveToHistory();
        localStorage.setItem('notepad_content', editor.innerHTML);
        showToast("ลบรูปที่เลือก");
        lastFocusedCard = null;
    } else showToast("คลิกที่รูปหรือข้อความบนรูปก่อน", true);
}

// ========== บันทึก / โหลด .npd (สมบูรณ์) ==========
async function saveAllWithImages() {
    try {
        const contentHTML = editor.innerHTML;
        const cards = document.querySelectorAll('.image-card');
        const imagesMeta = [];
        for (let card of cards) {
            const img = card.querySelector('img');
            const imgWrapper = card.querySelector('.img-wrapper');
            const overlay = imgWrapper?.querySelector('.text-overlay');
            let overlayInfo = overlay ? { 
                text: overlay.innerText, 
                left: overlay.style.left, 
                top: overlay.style.top 
            } : null;
            let floatingInfo = null;
            if (card.classList.contains('floating')) {
                floatingInfo = { 
                    enabled: true, 
                    left: card.style.left, 
                    top: card.style.top 
                };
            }
            // บันทึกขนาดรูปด้วย
            const imgSize = {
                width: img.style.width || img.offsetWidth + 'px',
                height: img.style.height || img.offsetHeight + 'px'
            };
            imagesMeta.push({ 
                imgSrc: img.src, 
                overlay: overlayInfo, 
                floating: floatingInfo,
                imgSize: imgSize
            });
        }
        const saveObj = { 
            version: "7.0_enhanced", 
            timestamp: new Date().toISOString(), 
            content: contentHTML, 
            imagesMeta,
            fontSize: currentFontSize
        };
        const jsonStr = JSON.stringify(saveObj);
        const fileName = prompt("ชื่อไฟล์ .npd:", `notepad_${new Date().toLocaleDateString('th-TH').replace(/\//g, '-')}`);
        if (!fileName) return;
        const fullName = fileName.endsWith('.npd') ? fileName : fileName + '.npd';
        const handle = await window.showSaveFilePicker({ suggestedName: fullName, types: [{ description: 'Notepad Pro Data', accept: { 'application/json': ['.npd'] } }] });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        showToast(`💾 บันทึกข้อความ+รูป+ตำแหน่งอิสระ (${cards.length} รูป)`);
    } catch (e) { }
}

async function loadAllWithImages() {
    try {
        const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Notepad Pro Data', accept: { 'application/json': ['.npd'] } }] });
        const file = await handle.getFile();
        const data = JSON.parse(await file.text());
        if (data.content) {
            editor.innerHTML = data.content;
            
            // คืนค่าขนาดตัวอักษร
            if (data.fontSize) setEditorFontSize(data.fontSize);
            
            // คืนค่า image cards และตำแหน่ง
            await new Promise(resolve => setTimeout(resolve, 100));
            
            document.querySelectorAll('.text-overlay').forEach(overlay => {
                if (!overlay.dataset.dragBound) makeOverlayDraggable(overlay);
            });
            
            document.querySelectorAll('.image-card').forEach((card, index) => {
                // คืนค่าขนาดรูป
                if (data.imagesMeta && data.imagesMeta[index] && data.imagesMeta[index].imgSize) {
                    const img = card.querySelector('img');
                    if (img && data.imagesMeta[index].imgSize.width) {
                        img.style.width = data.imagesMeta[index].imgSize.width;
                        img.style.height = data.imagesMeta[index].imgSize.height;
                    }
                }
                
                const btn = card.querySelector('.free-move-btn');
                if (btn) {
                    const newBtn = btn.cloneNode(true);
                    btn.parentNode.replaceChild(newBtn, btn);
                    newBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (card.classList.contains('floating')) {
                            setFloatingMode(card, false);
                            newBtn.innerText = '🔄 วางอิสระ';
                        } else {
                            setFloatingMode(card, true);
                            newBtn.innerText = '📌 คงที่ (inline)';
                        }
                    });
                }
                
                if (data.imagesMeta && data.imagesMeta[index] && data.imagesMeta[index].floating) {
                    const f = data.imagesMeta[index].floating;
                    if (f.enabled) {
                        setFloatingMode(card, true, parseFloat(f.left), parseFloat(f.top));
                        const freeBtn = card.querySelector('.free-move-btn');
                        if (freeBtn) freeBtn.innerText = '📌 คงที่ (inline)';
                    }
                }
            });
            
            updateLines();
            showToast(`โหลดไฟล์สำเร็จ (${document.querySelectorAll('.image-card').length} รูป)`);
            saveToHistory();
            localStorage.setItem('notepad_content', editor.innerHTML);
        }
    } catch (e) { 
        console.error(e);
        showToast('โหลดไม่สำเร็จ', true); 
    }
}

// ========== ฟังก์ชันอื่น ๆ ==========
// ✅ Fix 3: เพิ่มฟังก์ชัน saveAsNewFile
async function saveAsNewFile() {
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: 'document.txt',
            types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(editor.innerText);
        await writable.close();
        currentFileHandle = handle;
        showToast('💾 บันทึกเป็นไฟล์ใหม่');
    } catch(e) {
        if (e.name !== 'AbortError') showToast('บันทึกไม่สำเร็จ', true);
    }
}

// ✅ Fix 3: แก้ไข openFile ให้ set currentFileHandle
async function openFile() {
    try {
        const [h] = await window.showOpenFilePicker();
        currentFileHandle = h;
        const f = await h.getFile();
        editor.innerHTML = await f.text();
        updateLines();
        saveToHistory();
        localStorage.setItem('notepad_content', editor.innerHTML);
        showToast(`เปิด ${f.name}`);
    } catch (e) { }
}

// ✅ Fix 3: แก้ไข saveCurrentFile ให้ใช้ saveAsNewFile เมื่อไม่มี currentFileHandle
async function saveCurrentFile() {
    if (!currentFileHandle) return saveAsNewFile();
    try {
        const writable = await currentFileHandle.createWritable();
        await writable.write(editor.innerHTML);
        await writable.close();
        showToast('บันทึกสำเร็จ');
    } catch (e) {
        saveAsNewFile();
    }
}

// ---------- ฟังก์ชันส่งออก HTML พร้อมฉากหลัง (✅ Fix 5: ใช้ background mode ปัจจุบัน) ----------
function generateFullHTML() {
    const isImageMode = document.body.classList.contains('bg-image-mode');
    const backgroundStyle = isImageMode
        ? "background: url('https://od.lk/s/N18yODQ0OTcyMDBf/789.jpg') no-repeat center center fixed; background-size: cover;"
        : "background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); background-attachment: fixed;";

    const opacity = document.getElementById('opacitySlider').value / 100;
    const fontSize = currentFontSize || 14;
    const editorContent = editor.innerHTML;

    return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Notepad Pro - บันทึกพร้อมฉากหลัง</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'SF Mono', 'Courier New', monospace;
    min-height: 100vh;
    color: #ffffff;
    ${backgroundStyle}
  }
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-width: 100%;
    overflow: hidden;
  }
  .editor-wrapper {
    display: flex;
    flex: 1;
    position: relative;
    overflow: hidden;
    background: rgba(0, 0, 0, ${opacity});
  }
  #editor {
    flex: 1;
    background: rgba(0, 0, 0, ${opacity * 0.7});
    padding: 12px 20px;
    outline: none;
    overflow-y: auto;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-size: ${fontSize}px;
    line-height: 1.6;
    font-family: inherit;
    color: #f0f0f0;
    min-width: 0;
    position: relative;
  }
  .image-card {
    display: inline-block;
    margin: 12px 16px 12px 8px;
    border: 1px solid rgba(255, 215, 0, 0.8);
    border-radius: 20px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    padding: 10px;
    box-shadow: 0 6px 16px rgba(0,0,0,0.5);
    vertical-align: top;
  }
  .image-card.floating {
    position: absolute;
    display: block;
    margin: 0;
    cursor: default;
    z-index: 100;
    width: auto;
  }
  .image-card.floating .drag-handle {
    background: rgba(255,215,0,0.3);
    border-radius: 20px;
    padding: 2px 8px;
    font-size: 11px;
    text-align: center;
    margin-bottom: 6px;
    display: inline-block;
  }
  .img-wrapper {
    position: relative;
    display: inline-block;
    border-radius: 14px;
    overflow: hidden;
    background: #1e1e2a;
  }
  .img-wrapper img {
    max-width: 220px;
    max-height: 200px;
    display: block;
    object-fit: contain;
  }
  .text-overlay {
    position: absolute;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    color: #ffec80;
    font-size: ${Math.max(10, fontSize - 2)}px;
    font-weight: bold;
    padding: 6px 12px;
    border-radius: 40px;
    border: 1px solid #ffd700;
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-word;
    max-width: 90%;
    cursor: default;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    z-index: 10;
  }
  .image-card-buttons {
    display: none;
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); border-radius: 10px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,215,0,0.5); border-radius: 10px; }
</style>
</head>
<body>
<div class="app-container">
  <div class="editor-wrapper">
    <div id="editor">${editorContent}</div>
  </div>
</div>
</body>
</html>`;
}

async function exportAsHTML() {
    try {
        const fullHtml = generateFullHTML();
        const handle = await window.showSaveFilePicker({
            suggestedName: 'notepad_export.html',
            types: [{ description: 'HTML Document', accept: { 'text/html': ['.html'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(fullHtml);
        await writable.close();
        showToast('ส่งออก HTML พร้อมฉากหลังสำเร็จ (Ctrl+E)');
    } catch (e) {
        if (e.name !== 'AbortError') showToast('ส่งออกไม่สำเร็จ', true);
    }
}

async function saveAsPythonFile() {
    showToast('⚠️ บันทึกเฉพาะข้อความ', true);
    const name = prompt('Python:', 'script.py');
    if (!name) return;
    const handle = await window.showSaveFilePicker({ suggestedName: name });
    const w = await handle.createWritable();
    await w.write(`# Python export\n${editor.innerText}`);
    await w.close();
}

function clearAll() {
    if (confirm('ล้างทั้งหมด?')) {
        editor.innerHTML = '';
        updateLines();
        saveToHistory();
        localStorage.setItem('notepad_content', '');
        showToast('ล้าง');
    }
}
function showSummary() {
    const imgs = document.querySelectorAll('.image-card').length;
    const float = document.querySelectorAll('.image-card.floating').length;
    showToast(`📊 ตัวอักษร:${editor.innerText.length} รูป:${imgs} (ลอย:${float})`);
}
function speakText() {
    const t = editor.innerText.trim();
    if (!t) return;
    if (currentUtterance) speechSynthesis.cancel();
    currentUtterance = new SpeechSynthesisUtterance(t);
    currentUtterance.lang = 'th-TH';
    currentUtterance.onend = () => { currentUtterance = null; document.getElementById('btnSpeak')?.classList.remove('speaking'); };
    document.getElementById('btnSpeak')?.classList.add('speaking');
    speechSynthesis.speak(currentUtterance);
}
function startVoiceCommand() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('ไม่รองรับ', true); return; }
    const rec = new SR();
    rec.lang = 'th-TH';
    rec.onstart = () => showToast('🎤 ฟัง...');
    rec.onresult = (e) => {
        const cmd = e.results[0][0].transcript.toLowerCase();
        showToast(`พูด: ${cmd}`);
        if (cmd.includes('เปิด')) openFile();
        else if (cmd.includes('เซฟทั้งหมด')) saveAllWithImages();
        else if (cmd.includes('โหลด')) loadAllWithImages();
        else if (cmd.includes('รูป')) addNewImage();
        else if (cmd.includes('ลบรูป')) removeSelectedImage();
        else if (cmd.includes('อ่าน')) speakText();
        else if (cmd.includes('ล้าง')) clearAll();
        else if (cmd.includes('เลิกทำ')) undo();
        else if (cmd.includes('ทำซ้ำ')) redo();
        else showToast('ไม่รู้จัก', true);
    };
    rec.start();
}
function openColorPicker() {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) { showToast('เลือกข้อความ', true); return; }
    colorPicker.click();
}
colorPicker.addEventListener('input', (e) => document.execCommand('foreColor', false, e.target.value));

// Opacity & Background
function adjustOpacity(val) {
    const op = Math.min(0.6, Math.max(0.1, val));
    document.querySelector('.editor-wrapper').style.backgroundColor = `rgba(0,0,0,${op})`;
    editor.style.backgroundColor = `rgba(0,0,0,${op * 0.7})`;
    lines.style.backgroundColor = `rgba(0,0,0,${op * 0.8 + 0.2})`;
    document.querySelectorAll('.image-card').forEach(c => c.style.backgroundColor = `rgba(0,0,0,${op * 0.85})`);
    document.getElementById('opacityValue').innerText = Math.round(op * 100) + '%';
    localStorage.setItem('editor_opacity', op);
}
function initOpacity() {
    const saved = localStorage.getItem('editor_opacity');
    const slider = document.getElementById('opacitySlider');
    const val = saved ? parseFloat(saved) : 0.25;
    slider.value = val * 100;
    adjustOpacity(val);
    slider.oninput = (e) => adjustOpacity(e.target.value / 100);
    document.getElementById('resetOpacityBtn').onclick = () => { slider.value = 25; adjustOpacity(0.25); showToast('รีเซ็ต'); };
}
function initBackground() {
    if (localStorage.getItem('bg_mode') === 'gradient') {
        document.body.classList.remove('bg-image-mode');
        document.body.classList.add('bg-gradient-mode');
    } else document.body.classList.add('bg-image-mode');
}
function toggleBackgroundMode() {
    document.body.classList.toggle('bg-image-mode');
    document.body.classList.toggle('bg-gradient-mode');
    localStorage.setItem('bg_mode', document.body.classList.contains('bg-image-mode') ? 'image' : 'gradient');
}

// ========== จับภาพหน้าจอ (รวมพื้นหลัง) ==========
async function takeScreenshot() {
    const el = document.body;
    if (typeof html2canvas === 'undefined') { 
        showToast('html2canvas ไม่พร้อม', true); 
        return; 
    }
    showToast('📸 จับภาพรวมพื้นหลัง...');
    try {
        const canvas = await html2canvas(el, {
            scale: 2,
            backgroundColor: null,
            useCORS: true,
            logging: false,
            windowWidth: document.documentElement.scrollWidth,
            windowHeight: document.documentElement.scrollHeight
        });
        const link = document.createElement('a');
        link.download = `screenshot_${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        showToast('📸 บันทึกภาพเรียบร้อย (รวมพื้นหลังแล้ว)');
    } catch(e) { 
        console.error(e);
        showToast('จับภาพล้มเหลว', true); 
    }
}

// ========== FIND (ค้นหา) ด้วย Ctrl+F และ F3 ==========
function findText(term, forward = true) {
    if (!term || term.trim() === "") return false;
    const found = window.find(term, false, false, forward);
    if (found) {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
        showToast(`พบ "${term}"`);
    } else {
        showToast(`ไม่พบ "${term}"`, true);
    }
    return found;
}

function showFindDialog() {
    const term = prompt("🔍 ค้นหา (ใส่คำที่ต้องการ):", lastSearchTerm);
    if (term !== null && term.trim() !== "") {
        lastSearchTerm = term;
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        findText(lastSearchTerm, true);
    }
}

function findNext() {
    if (!lastSearchTerm) {
        showFindDialog();
        return;
    }
    findText(lastSearchTerm, true);
}

// ========== Keyboard Shortcuts ==========
document.addEventListener('keydown', (e) => {
    const inEditable = e.target.closest('[contenteditable="true"]');
    if (inEditable && (e.key === '7' || e.key === '8' || e.key === '9')) return;
    
    // Undo/Redo
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
    }
    if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
    }
    
    // ค้นหา
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        showFindDialog();
        return;
    }
    if (e.key === 'F3') {
        e.preventDefault();
        findNext();
        return;
    }
    
    // คีย์ลัดอื่น ๆ
    if (e.key === '7') { e.preventDefault(); saveAllWithImages(); }
    else if (e.key === '8') { e.preventDefault(); saveAsPythonFile(); }
    else if (e.key === '9') { e.preventDefault(); loadAllWithImages(); }
    else if (e.ctrlKey && e.key === 'o') { e.preventDefault(); openFile(); }
    else if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveCurrentFile(); }
    else if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportAsHTML(); }
    else if (e.key === 'Escape') { if (currentUtterance) speechSynthesis.cancel(); }
});

// ========== INIT ==========
function initEditor() {
    const saved = localStorage.getItem('notepad_content');
    const savedFont = localStorage.getItem('editor_font_size');
    if (saved) editor.innerHTML = saved;
    else editor.innerHTML = '<span style="color:#ffd700;">✨ Notepad Pro Ultimate ✨<br><br>✅ คลิกปุ่ม📍 แล้วคลิกตำแหน่งใดก็ได้ → วางรูปอิสระทันที<br>✅ ลากรูปจากเครื่องหรือเว็บมาวางในเอกสารได้เลย<br>✅ วางรูปอิสระ: ลากรูปไปที่ใดก็ได้<br>✅ ปรับขนาดตัวอักษร: A+ / A-<br>✅ ปรับขนาดรูป: กดปุ่ม "📏 ปรับขนาด"<br>✅ Ctrl+Z เลิกทำ, Ctrl+Y ทำซ้ำ<br>✅ พิมพ์ข้อความบนรูป ลากได้<br>✅ 7=บันทึก, 9=โหลด, 8=Python<br>✅ Ctrl+F ค้นหา, F3 ค้นหาถัดไป</span>';
    if (savedFont) setEditorFontSize(parseInt(savedFont));
    else setEditorFontSize(14);
    updateLines();
    
    // ใช้ debounced version สำหรับ performance
    const debouncedUpdate = debounce(() => {
        updateLines();
        localStorage.setItem('notepad_content', editor.innerHTML);
    }, 300);
    
    editor.addEventListener('input', () => {
        debouncedUpdate();
        if (!isUndoRedoAction) saveToHistory();
    });
    editor.addEventListener('scroll', syncScroll);
    editor.addEventListener('keyup', highlightCurrentLine);
    document.querySelectorAll('.text-overlay').forEach(overlay => makeOverlayDraggable(overlay));
    
    // บันทึก history เริ่มต้น
    saveToHistory();
}

// ผูก events ปุ่ม
document.getElementById('btnOpen')?.addEventListener('click', openFile);
document.getElementById('btnSave')?.addEventListener('click', saveCurrentFile);
document.getElementById('btnSaveAs')?.addEventListener('click', exportAsHTML);
document.getElementById('btnSaveAll')?.addEventListener('click', saveAllWithImages);
document.getElementById('btnLoadAll')?.addEventListener('click', loadAllWithImages);
document.getElementById('btnExportHTML')?.addEventListener('click', exportAsHTML);
document.getElementById('btnSummary')?.addEventListener('click', showSummary);
document.getElementById('btnPython')?.addEventListener('click', saveAsPythonFile);
document.getElementById('btnImage')?.addEventListener('click', addNewImage);
document.getElementById('btnFloatingPlace')?.addEventListener('click', enablePlaceImageByClick);
document.getElementById('btnRemoveSelectedImg')?.addEventListener('click', removeSelectedImage);
document.getElementById('btnColor')?.addEventListener('click', openColorPicker);
document.getElementById('btnSpeak')?.addEventListener('click', speakText);
document.getElementById('btnVoice')?.addEventListener('click', startVoiceCommand);
document.getElementById('btnClear')?.addEventListener('click', clearAll);
document.getElementById('btnScreenshot')?.addEventListener('click', takeScreenshot);
document.getElementById('toggleBgBtn')?.addEventListener('click', toggleBackgroundMode);
document.getElementById('fontIncrease')?.addEventListener('click', increaseFont);
document.getElementById('fontDecrease')?.addEventListener('click', decreaseFont);
document.getElementById('fontReset')?.addEventListener('click', resetFont);
document.getElementById('btnUndo')?.addEventListener('click', undo);
document.getElementById('btnRedo')?.addEventListener('click', redo);

// เริ่มต้น
initEditor();
initBackground();
initOpacity();
setupDragAndDrop();
setTimeout(() => showToast("🚀 รองรับ Ctrl+Z/Y เลิกทำ/ทำซ้ำ, ปรับขนาดรูปได้, Ctrl+F ค้นหา"), 800);