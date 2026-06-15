// script5.js - เสียงพูดต้อนรับอัตโนมัติสำหรับ Notepad Pro Ultimate
(function() {
    // ฟังก์ชันพูดข้อความ
    function speakWelcome() {
        const message = "ขอต้อนรับสู่ Notepad Pro Ultimate ครับเจ้านายผม นายชด ยินดีรับใช้ครับผม";
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = "th-TH";    // ภาษาไทย
        utterance.rate = 0.9;        // ความเร็วพูด (0.9 = ช้าปานกลาง)
        utterance.pitch = 1.1;       // ระดับเสียงสูงขึ้นเล็กน้อย
        utterance.volume = 1;        // เต็มที่

        // ยกเลิกเสียงที่ค้างอยู่ก่อน (ป้องกัน overlap)
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }

    // รอให้หน้าโหลดเสร็จก่อน แล้วจึงพูด
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", speakWelcome);
    } else {
        // ถ้าโหลดเสร็จแล้ว ให้พูดทันที
        speakWelcome();
    }

    // สำรอง: ถ้าเบราว์เซอร์ปิดกั้น Autoplay ให้ลองพูดอีกครั้งเมื่อผู้ใช้คลิกที่ใดก็ได้ครั้งแรก
    let spoken = false;
    function trySpeakOnUserInteraction() {
        if (!spoken) {
            spoken = true;
            speakWelcome();
            // ลบ event listeners หลังจากพูดแล้ว
            document.removeEventListener("click", trySpeakOnUserInteraction);
            document.removeEventListener("keydown", trySpeakOnUserInteraction);
            document.removeEventListener("touchstart", trySpeakOnUserInteraction);
        }
    }

    // ตรวจสอบว่าพูดสำเร็จหรือไม่ (ถ้ายังไม่พูดภายใน 1 วินาที แสดงว่าถูกปิดกั้น)
    setTimeout(() => {
        if (!spoken) {
            // ยังไม่พูด = โดน Autoplay policy ให้รอผู้ใช้คลิก
            document.addEventListener("click", trySpeakOnUserInteraction);
            document.addEventListener("keydown", trySpeakOnUserInteraction);
            document.addEventListener("touchstart", trySpeakOnUserInteraction);
        }
    }, 1000);
})();
