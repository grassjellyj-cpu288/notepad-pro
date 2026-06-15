// ==================== script1.js – เสริมระบบเสียง + AI Voice Command (แก้ไขให้เสียงตอบกลับได้แน่นอน) ====================
(function() {
    // ฟังก์ชันรอให้ฟังก์ชันหลักโหลด
    function waitForEditorFunctions(callback) {
        if (typeof openFile !== 'undefined' && typeof saveAllWithImages !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForEditorFunctions(callback), 200);
        }
    }

    waitForEditorFunctions(() => {
        // สร้างปุ่มใหม่สำหรับ Voice Command
        const toolbar = document.querySelector('.toolbar') || document.querySelector('.button-group') || document.body;
        const voiceBtn = document.createElement('button');
        voiceBtn.id = 'aiVoiceBtn';
        voiceBtn.innerText = '🎙️ สั่งงานด้วยเสียง (AI)';
        voiceBtn.style.cssText = 'background: #ff8800; border: none; color: white; padding: 6px 12px; border-radius: 20px; margin: 5px; cursor: pointer; font-weight: bold;';
        toolbar.appendChild(voiceBtn);

        // ฟังก์ชันแสดง Toast บนหน้า (สำรองเมื่อเสียงไม่ทำงาน)
        function showToastMessage(msg, isError = false) {
            const existing = document.querySelector('.voice-toast');
            if (existing) existing.remove();
            const toast = document.createElement('div');
            toast.className = 'voice-toast';
            toast.textContent = msg;
            toast.style.cssText = `
                position: fixed; bottom: 20px; left: 20px; z-index: 9999;
                background: rgba(0,0,0,0.8); color: #ffd700; padding: 12px 20px;
                border-radius: 30px; font-size: 14px; font-family: monospace;
                border-left: 4px solid #ff8800; backdrop-filter: blur(8px);
                pointer-events: none; transition: 0.2s;
            `;
            if (isError) toast.style.color = '#ff8888';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }

        // ฟังก์ชันพูดตอบกลับ (ปรับปรุงให้แน่ใจว่าเสียงทำงาน)
        function speakResponse(message, isError = false) {
            if (!window.speechSynthesis) {
                showToastMessage(`⚠️ เบราว์เซอร์ไม่รองรับเสียง: ${message}`, true);
                console.warn('speechSynthesis ไม่พร้อม');
                return;
            }

            // ยกเลิก utterance ค้างเพื่อไม่ให้ค้าง
            window.speechSynthesis.cancel();

            // สร้าง utterance
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = 'th-TH';
            utterance.rate = 0.9;
            utterance.pitch = isError ? 1.2 : 1.0;
            utterance.volume = 1;

            // เลือกเสียงภาษาไทยถ้ามี (ช่วยให้พูดไทยชัดขึ้น)
            const voices = window.speechSynthesis.getVoices();
            const thaiVoice = voices.find(v => v.lang === 'th-TH');
            if (thaiVoice) utterance.voice = thaiVoice;

            // Event เพื่อดีบัก
            utterance.onstart = () => console.log(`🔊 กำลังพูด: "${message}"`);
            utterance.onerror = (e) => {
                console.error('Speech error:', e);
                showToastMessage(`🔇 เสียงไม่ทำงาน (ลองคลิกที่หน้าเว็บก่อน)`, true);
            };
            utterance.onend = () => console.log('✅ พูดจบ');

            // หน่วงเวลาเล็กน้อยเพื่อให้การ cancel เสร็จสมบูรณ์
            setTimeout(() => {
                window.speechSynthesis.speak(utterance);
            }, 50);
        }

        // เริ่มฟังคำสั่งเสียง
        function startListening() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                speakResponse('เบราว์เซอร์นี้ไม่รองรับการฟังเสียง', true);
                showToastMessage('❌ ไม่รองรับ SpeechRecognition', true);
                return;
            }

            const recognition = new SpeechRecognition();
            recognition.lang = 'th-TH';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            recognition.continuous = false;

            recognition.onstart = () => {
                showToastMessage('🎤 กำลังฟัง... พูดคำสั่งได้เลย');
                console.log('Listening started');
            };

            recognition.onerror = (event) => {
                console.error('Speech error:', event.error);
                let msg = 'ไม่เข้าใจคำสั่ง';
                if (event.error === 'not-allowed') msg = 'ไม่อนุญาตใช้ไมโครโฟน';
                else if (event.error === 'no-speech') msg = 'ไม่พบเสียงพูด';
                speakResponse(msg, true);
                showToastMessage(`❌ ${msg}`, true);
            };

            recognition.onresult = async (event) => {
                const command = event.results[0][0].transcript.trim().toLowerCase();
                console.log(`📝 คำสั่งเสียง: ${command}`);
                showToastMessage(`🔊 รับรู้คำสั่ง: "${command}"`);
                await executeCommand(command);
            };

            recognition.start();
        }

        // จับคู่คำสั่งเสียงกับฟังก์ชันของ Notepad
        async function executeCommand(command) {
            let actionPerformed = false;

            try {
                // เปิดไฟล์
                if (command.includes('เปิดไฟล์') || command.includes('เปิด')) {
                    await openFile();
                    actionPerformed = true;
                }
                // บันทึกไฟล์ (Save Current)
                else if (command.includes('บันทึกไฟล์') || command === 'บันทึก') {
                    if (typeof saveCurrentFile === 'function') {
                        await saveCurrentFile();
                    } else if (typeof saveAsNewFile === 'function') {
                        await saveAsNewFile();
                    } else {
                        await saveAllWithImages();
                    }
                    actionPerformed = true;
                }
                // บันทึกทั้งหมด (.npd)
                else if (command.includes('บันทึกทั้งหมด') || command.includes('เซฟทั้งหมด')) {
                    await saveAllWithImages();
                    actionPerformed = true;
                }
                // โหลดไฟล์ .npd
                else if (command.includes('โหลดไฟล์') || command.includes('โหลด')) {
                    await loadAllWithImages();
                    actionPerformed = true;
                }
                // ล้างทั้งหมด
                else if (command.includes('ล้างทั้งหมด') || command.includes('ล้าง')) {
                    clearAll();
                    actionPerformed = true;
                }
                // เลิกทำ
                else if (command.includes('เลิกทำ') || command === 'เลิก') {
                    undo();
                    actionPerformed = true;
                }
                // ทำซ้ำ
                else if (command.includes('ทำซ้ำ') || command.includes('redo')) {
                    redo();
                    actionPerformed = true;
                }
                // อ่านข้อความในเอกสาร
                else if (command.includes('อ่านข้อความ') || command.includes('อ่าน')) {
                    if (typeof speakText === 'function') speakText();
                    else if (typeof readAloud === 'function') readAloud();
                    else {
                        speakResponse('ไม่พบฟังก์ชันอ่านข้อความ', true);
                        actionPerformed = false;
                    }
                    if (actionPerformed !== false) actionPerformed = true;
                }
                // หยุดอ่าน
                else if (command.includes('หยุดอ่าน') || command.includes('หยุดพูด')) {
                    if (window.speechSynthesis) window.speechSynthesis.cancel();
                    actionPerformed = true;
                }
                // เพิ่มรูป
                else if (command.includes('เพิ่มรูป') || command.includes('แทรกรูป')) {
                    addNewImage();
                    actionPerformed = true;
                }
                // ลบรูปที่เลือก
                else if (command.includes('ลบรูป')) {
                    removeSelectedImage();
                    actionPerformed = true;
                }
                // สรุปข้อมูล
                else if (command.includes('สรุป') || command.includes('สถานะ')) {
                    showSummary();
                    actionPerformed = true;
                }
                // ส่งออก HTML
                else if (command.includes('ส่งออก html') || command.includes('export html')) {
                    await exportAsHTML();
                    actionPerformed = true;
                }
                // จับภาพหน้าจอ
                else if (command.includes('จับภาพ') || command.includes('สกรีนช็อต')) {
                    await takeScreenshot();
                    actionPerformed = true;
                }
                // เปลี่ยนพื้นหลัง
                else if (command.includes('สลับพื้นหลัง') || command.includes('เปลี่ยนพื้นหลัง')) {
                    toggleBackgroundMode();
                    actionPerformed = true;
                }
                // เพิ่มขนาดตัวอักษร
                else if (command.includes('เพิ่มขนาดตัวอักษร') || command.includes('ตัวใหญ่ขึ้น')) {
                    increaseFont();
                    actionPerformed = true;
                }
                // ลดขนาดตัวอักษร
                else if (command.includes('ลดขนาดตัวอักษร') || command.includes('ตัวเล็กลง')) {
                    decreaseFont();
                    actionPerformed = true;
                }
                // คืนค่าขนาดตัวอักษร
                else if (command.includes('คืนค่าขนาด') || command.includes('reset font')) {
                    resetFont();
                    actionPerformed = true;
                }
                // วางรูปอิสระ (เปิดโหมดคลิกวาง)
                else if (command.includes('วางรูปอิสระ') || command.includes('คลิกวางรูป')) {
                    enablePlaceImageByClick();
                    actionPerformed = true;
                }
                else {
                    speakResponse('ไม่รู้จักคำสั่งนี้', true);
                    showToastMessage('❓ ไม่รู้จักคำสั่ง', true);
                    return;
                }

                if (actionPerformed) {
                    // รอสักครู่ให้การทำงาน async เสร็จ
                    setTimeout(() => {
                        speakResponse('เรียบร้อยครับเจ้านาย');
                        showToastMessage('✅ เรียบร้อยครับเจ้านาย');
                    }, 500);
                }
            } catch (err) {
                console.error('Execute command error:', err);
                speakResponse('เกิดข้อผิดพลาดในการทำงาน', true);
                showToastMessage('⚠️ เกิดข้อผิดพลาด', true);
            }
        }

        // ผูกเหตุการณ์กับปุ่มใหม่
        voiceBtn.addEventListener('click', () => {
            startListening();
        });

        // โหลด voices ล่วงหน้า (ช่วยให้พูดได้ทันที)
        if (window.speechSynthesis) {
            window.speechSynthesis.getVoices();
        }

        console.log('✅ script1.js โหลดแล้ว – Voice Command + เสียงตอบกลับ "เรียบร้อยครับเจ้านาย" (พร้อม Toast สำรอง)');
    });
})();