// ==================== script2.js – Advanced Notepad with Image Support & Modern Features ====================
// Upgraded to work with script1.js (Voice Commands) and provide a smooth, modern editing experience.

(function() {
    // ---------- DOM Elements ----------
    let editorContainer;       // The editable div (contenteditable)
    let toolbar;               // Existing toolbar (for adding extra buttons if needed)
    
    // ---------- State ----------
    let currentFileName = null;           // For "Save As" / "Save Current"
    let historyStack = [];                // Stores HTML snapshots for undo/redo
    let historyIndex = -1;
    let isUndoRedoInProgress = false;     // Prevent recursion on input events
    let placeImageMode = false;            // Click-to-place image mode
    let fontScale = 1.0;                  // Base font size multiplier (1 = 16px)
    
    // ---------- Default Settings ----------
    const DEFAULT_FONT_SIZE_PX = 16;
    const MAX_HISTORY = 100;
    
    // ---------- Helper: Ensure Editor Exists ----------
    function ensureEditor() {
        if (!editorContainer || !document.body.contains(editorContainer)) {
            // Try to find existing editor with common IDs/classes
            editorContainer = document.getElementById('editor') || 
                              document.querySelector('.editor') || 
                              document.querySelector('[contenteditable="true"]');
            if (!editorContainer) {
                // Create a new editor div
                editorContainer = document.createElement('div');
                editorContainer.id = 'editor';
                editorContainer.setAttribute('contenteditable', 'true');
                editorContainer.className = 'modern-editor';
                editorContainer.style.cssText = `
                    width: 100%;
                    min-height: 60vh;
                    padding: 20px;
                    border: 1px solid #ccc;
                    border-radius: 12px;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    font-size: ${DEFAULT_FONT_SIZE_PX}px;
                    line-height: 1.6;
                    background: white;
                    color: black;
                    outline: none;
                    overflow-y: auto;
                    margin-top: 16px;
                    transition: all 0.2s ease;
                `;
                // Find a container to insert into (e.g., main or body)
                const main = document.querySelector('main') || document.body;
                main.appendChild(editorContainer);
            }
        }
        // Make sure it's editable
        editorContainer.contentEditable = 'true';
        return editorContainer;
    }
    
    // ---------- History Management (Undo/Redo) ----------
    function saveToHistory() {
        if (isUndoRedoInProgress) return;
        const currentHTML = editorContainer.innerHTML;
        // If same as last, don't push
        if (historyStack[historyIndex] === currentHTML) return;
        // Remove any forward history
        historyStack = historyStack.slice(0, historyIndex + 1);
        historyStack.push(currentHTML);
        if (historyStack.length > MAX_HISTORY) historyStack.shift();
        historyIndex = historyStack.length - 1;
    }
    
    function undo() {
        if (historyIndex > 0) {
            isUndoRedoInProgress = true;
            historyIndex--;
            editorContainer.innerHTML = historyStack[historyIndex];
            isUndoRedoInProgress = false;
        }
    }
    
    function redo() {
        if (historyIndex < historyStack.length - 1) {
            isUndoRedoInProgress = true;
            historyIndex++;
            editorContainer.innerHTML = historyStack[historyIndex];
            isUndoRedoInProgress = false;
        }
    }
    
    // Capture history on any input/change
    function bindHistoryEvents() {
        editorContainer.addEventListener('input', () => saveToHistory());
        editorContainer.addEventListener('blur', () => saveToHistory());
        // Also capture image insertion and other mutations via MutationObserver
        const observer = new MutationObserver(() => saveToHistory());
        observer.observe(editorContainer, { childList: true, subtree: true, attributes: true });
    }
    
    // ---------- Image Handling ----------
    async function insertImageFromFile(file, cursorPosition = null) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject('Not an image file');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'editor-image';
                img.style.cssText = 'max-width: 100%; height: auto; margin: 8px 0; border-radius: 8px; cursor: pointer;';
                img.alt = file.name;
                // Add double-click to resize (optional feature)
                img.ondblclick = () => resizeImage(img);
                
                // Insert at cursor or at end
                if (cursorPosition) {
                    // Restore selection and insert
                    const sel = window.getSelection();
                    if (sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(img);
                        range.collapse(false);
                    } else {
                        editorContainer.appendChild(img);
                    }
                } else {
                    editorContainer.appendChild(img);
                    editorContainer.appendChild(document.createElement('br'));
                }
                saveToHistory();
                resolve();
            };
            reader.onerror = () => reject('Failed to read image');
            reader.readAsDataURL(file);
        });
    }
    
    async function addNewImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await insertImageFromFile(file);
                } catch (err) {
                    console.error(err);
                    alert('ไม่สามารถเพิ่มรูปภาพได้');
                }
            }
        };
        input.click();
    }
    
    function removeSelectedImage() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const node = selection.getRangeAt(0).startContainer;
            const img = node.nodeType === Node.ELEMENT_NODE ? node.closest('img') : node.parentElement?.closest('img');
            if (img && img.tagName === 'IMG') {
                img.remove();
                saveToHistory();
                return;
            }
        }
        // Fallback: remove the first selected img (or none)
        const activeImg = editorContainer.querySelector('img:focus, img:hover');
        if (activeImg) activeImg.remove();
        else alert('กรุณาเลือกรูปที่ต้องการลบก่อน');
    }
    
    function enablePlaceImageByClick() {
        placeImageMode = !placeImageMode;
        if (placeImageMode) {
            editorContainer.style.cursor = 'crosshair';
            editorContainer.addEventListener('click', placeImageOnClick);
            alert('โหมดวางรูป: คลิกที่ตำแหน่งใดก็ได้ในเอกสารเพื่อแทรกรูป (จะเปิดหน้าต่างเลือกรูป)');
        } else {
            editorContainer.style.cursor = 'text';
            editorContainer.removeEventListener('click', placeImageOnClick);
        }
    }
    
    async function placeImageOnClick(e) {
        e.stopPropagation();
        // Get click coordinates relative to editor to insert at caret position
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        // Open file picker
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (ev) => {
            const file = ev.target.files[0];
            if (file) {
                await insertImageFromFile(file, true);
            }
            placeImageMode = false;
            editorContainer.style.cursor = 'text';
            editorContainer.removeEventListener('click', placeImageOnClick);
        };
        input.click();
    }
    
    function resizeImage(img) {
        const newWidth = prompt('ใส่ความกว้างใหม่ (px หรือ %):', img.width);
        if (newWidth) {
            if (newWidth.endsWith('%')) img.style.width = newWidth;
            else img.style.width = newWidth + 'px';
            img.style.height = 'auto';
            saveToHistory();
        }
    }
    
    // ---------- File Operations (.npd JSON containing HTML) ----------
    async function saveAllWithImages() {
        const data = {
            fileName: currentFileName || 'untitled.npd',
            content: editorContainer.innerHTML,
            lastModified: new Date().toISOString()
        };
        const json = JSON.stringify(data, null, 2);
        downloadFile(json, currentFileName || 'document.npd', 'application/json');
    }
    
    async function loadAllWithImages() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.npd,application/json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            try {
                const data = JSON.parse(text);
                editorContainer.innerHTML = data.content || '';
                currentFileName = data.fileName || file.name;
                // Reset history
                historyStack = [editorContainer.innerHTML];
                historyIndex = 0;
                saveToHistory();
            } catch (err) {
                alert('ไฟล์ .npd ไม่ถูกต้อง');
            }
        };
        input.click();
    }
    
    async function saveCurrentFile() {
        if (!currentFileName) {
            await saveAsNewFile();
        } else {
            const data = {
                fileName: currentFileName,
                content: editorContainer.innerHTML,
                lastModified: new Date().toISOString()
            };
            const json = JSON.stringify(data, null, 2);
            downloadFile(json, currentFileName, 'application/json');
        }
    }
    
    async function saveAsNewFile() {
        const name = prompt('ชื่อไฟล์ (.npd):', currentFileName || 'document.npd');
        if (name) {
            currentFileName = name.endsWith('.npd') ? name : name + '.npd';
            await saveCurrentFile();
        }
    }
    
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }
    
    async function openFile() {
        await loadAllWithImages(); // same behavior
    }
    
    // ---------- Export as HTML ----------
    async function exportAsHTML() {
        const style = document.createElement('style');
        style.textContent = `
            body { font-family: 'Segoe UI', sans-serif; padding: 40px; max-width: 900px; margin: auto; }
            img { max-width: 100%; height: auto; border-radius: 12px; margin: 16px 0; }
            .editor-image { display: block; }
        `;
        const fullHTML = `<!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>${currentFileName || 'เอกสาร'}</title></head>
        <body>${editorContainer.innerHTML}</body>
        </html>`;
        downloadFile(fullHTML, (currentFileName || 'document').replace('.npd', '') + '.html', 'text/html');
    }
    
    // ---------- Screenshot (requires html2canvas) ----------
    async function takeScreenshot() {
        if (typeof html2canvas === 'undefined') {
            // Dynamically load html2canvas
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = resolve;
                script.onerror = () => reject('Failed to load html2canvas');
                document.head.appendChild(script);
            });
        }
        try {
            const canvas = await html2canvas(editorContainer, { scale: 2, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.download = 'screenshot.png';
            link.href = canvas.toDataURL();
            link.click();
        } catch (err) {
            console.error(err);
            alert('ไม่สามารถจับภาพหน้าจอได้');
        }
    }
    
    // ---------- Text to Speech ----------
    function speakText() {
        const text = editorContainer.innerText || editorContainer.textContent;
        if (!text.trim()) {
            alert('ไม่มีข้อความให้อ่าน');
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }
    
    function readAloud() {
        speakText(); // alias
    }
    
    // ---------- Editor Appearance & Font ----------
    function increaseFont() {
        fontScale = Math.min(fontScale + 0.1, 2.5);
        editorContainer.style.fontSize = `${DEFAULT_FONT_SIZE_PX * fontScale}px`;
        localStorage.setItem('editorFontScale', fontScale);
    }
    
    function decreaseFont() {
        fontScale = Math.max(fontScale - 0.1, 0.6);
        editorContainer.style.fontSize = `${DEFAULT_FONT_SIZE_PX * fontScale}px`;
        localStorage.setItem('editorFontScale', fontScale);
    }
    
    function resetFont() {
        fontScale = 1.0;
        editorContainer.style.fontSize = `${DEFAULT_FONT_SIZE_PX}px`;
        localStorage.setItem('editorFontScale', fontScale);
    }
    
    function toggleBackgroundMode() {
        const isDark = editorContainer.classList.contains('dark-mode');
        if (isDark) {
            editorContainer.classList.remove('dark-mode');
            editorContainer.style.backgroundColor = '#ffffff';
            editorContainer.style.color = '#000000';
        } else {
            editorContainer.classList.add('dark-mode');
            editorContainer.style.backgroundColor = '#2d2d2d';
            editorContainer.style.color = '#f0f0f0';
            // Also adjust image borders
            const imgs = editorContainer.querySelectorAll('img');
            imgs.forEach(img => img.style.border = '1px solid #555');
        }
        localStorage.setItem('editorDarkMode', !isDark);
    }
    
    function clearAll() {
        if (confirm('ล้างเนื้อหาทั้งหมด?')) {
            editorContainer.innerHTML = '';
            saveToHistory();
        }
    }
    
    function showSummary() {
        const text = editorContainer.innerText.trim();
        const charCount = text.length;
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
        const imgCount = editorContainer.querySelectorAll('img').length;
        alert(`📊 สรุปเอกสาร\n📝 ตัวอักษร: ${charCount}\n📖 คำ: ${wordCount}\n🖼️ รูปภาพ: ${imgCount}`);
    }
    
    // ---------- Load saved preferences ----------
    function loadPreferences() {
        const savedFontScale = localStorage.getItem('editorFontScale');
        if (savedFontScale) {
            fontScale = parseFloat(savedFontScale);
            editorContainer.style.fontSize = `${DEFAULT_FONT_SIZE_PX * fontScale}px`;
        }
        const darkMode = localStorage.getItem('editorDarkMode') === 'true';
        if (darkMode) toggleBackgroundMode();
    }
    
    // ---------- Initialization ----------
    function init() {
        editorContainer = ensureEditor();
        // Save initial state to history
        historyStack = [editorContainer.innerHTML];
        historyIndex = 0;
        bindHistoryEvents();
        loadPreferences();
        
        // Make sure toolbar exists for potential extra buttons (optional)
        toolbar = document.querySelector('.toolbar') || document.querySelector('.button-group');
        if (toolbar) {
            // Optional: add visual indicators for voice command? But not required.
        }
        
        // Add keyboard shortcuts for undo/redo (Ctrl+Z / Ctrl+Y)
        editorContainer.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                redo();
            }
        });
        
        console.log('✅ script2.js อัปเกรดแล้ว – รองรับฟังก์ชันครบถ้วนสำหรับ Voice Command');
    }
    
    // ---------- Expose Global Functions (for script1.js) ----------
    window.openFile = openFile;
    window.saveAllWithImages = saveAllWithImages;
    window.loadAllWithImages = loadAllWithImages;
    window.clearAll = clearAll;
    window.undo = undo;
    window.redo = redo;
    window.addNewImage = addNewImage;
    window.removeSelectedImage = removeSelectedImage;
    window.showSummary = showSummary;
    window.exportAsHTML = exportAsHTML;
    window.takeScreenshot = takeScreenshot;
    window.toggleBackgroundMode = toggleBackgroundMode;
    window.increaseFont = increaseFont;
    window.decreaseFont = decreaseFont;
    window.resetFont = resetFont;
    window.enablePlaceImageByClick = enablePlaceImageByClick;
    window.speakText = speakText;
    window.readAloud = readAloud;
    window.saveCurrentFile = saveCurrentFile;
    window.saveAsNewFile = saveAsNewFile;
    
    // Start the editor when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();