import { useState } from 'react';

// ตรวจจับ in-app browser (LINE, Facebook, Twitter, Instagram)
const isInAppBrowser = () => {
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  return /Line|FBAN|FBAV|Twitter|Instagram|Messenger/i.test(ua);
};

const SleepTracker = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState(true);

  const sendToBackend = async (payload: any) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 
                   (window.location.hostname === 'localhost' 
                     ? 'http://localhost:8000' 
                     : 'https://sleep-api.up.railway.app');
    try {
      await fetch(`${baseUrl}/api/sleep-data?session_id=demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('Failed to send data:', e);
    }
  };

  // เรียกไมค์ทันทีเมื่อกดปุ่ม — ต้องอยู่ใน user gesture
  const requestMicAndStart = async () => {
    let audioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;

    try {
      // ขอ permission ทันที
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      setHasMicPermission(true);
      setIsTracking(true);

      // เริ่มส่งข้อมูลเสียง
      const interval = setInterval(() => {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        const sampleRate = audioContext!.sampleRate;
        const binHz = sampleRate / analyser.fftSize;
        let snoreEnergy = 0;
        const startBin = Math.floor(50 / binHz);
        const endBin = Math.min(Math.floor(300 / binHz), bufferLength - 1);
        for (let i = startBin; i <= endBin; i++) {
          snoreEnergy += dataArray[i];
        }

        sendToBackend({
          type: 'audio',
          timestamp: Math.floor(Date.now() / 1000),
          snoreEnergy,
          avgVolume: dataArray.reduce((a, b) => a + b, 0) / bufferLength,
        });
      }, 5000);

      // หยุด tracking
      const stopTracking = () => {
        setIsTracking(false);
        clearInterval(interval);
        if (stream) stream.getTracks().forEach(track => track.stop());
        if (audioContext) audioContext.close();
      };

      // เริ่ม motion capture
      const stopMotion = startMotionCapture();

      // บันทึก cleanup
      (window as any).sleepCleanup = () => {
        stopTracking();
        stopMotion?.();
      };

    } catch (err) {
      setHasMicPermission(false);
      if (isInAppBrowser()) {
        alert('กรุณาเปิดเว็บนี้ใน Chrome หรือ Safari โดยตรง เพื่อใช้ไมค์วิเคราะห์การกรน');
      } else {
        alert('ไม่สามารถใช้ไมค์ได้: ' + (err as Error).message);
      }
    }
  };

  const startMotionCapture = () => {
    const handleMotion = (e: DeviceMotionEvent) => {
      if (!e.accelerationIncludingGravity) return;
      const { x, y, z } = e.accelerationIncludingGravity;
      const safeX = x ?? 0;
      const safeY = y ?? 0;
      const safeZ = z ?? 0;
      const rms = Math.sqrt((safeX ** 2 + safeY ** 2 + safeZ ** 2) / 3);

      sendToBackend({
        type: 'motion',
        timestamp: Math.floor(Date.now() / 1000),
        rms,
        x: safeX,
        y: safeY,
        z: safeZ,
      });
    };

    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleMotion);
      return () => window.removeEventListener('devicemotion', handleMotion);
    }
  };

  const stopTracking = () => {
    const cleanup = (window as any).sleepCleanup;
    if (cleanup) cleanup();
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md text-center">
      {isInAppBrowser() && !isTracking && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded mb-4 text-sm">
          <strong>💡 แนะนำ:</strong> เปิดใน <strong>Chrome หรือ Safari</strong> เพื่อใช้ไมค์วิเคราะห์การกรน
        </div>
      )}

      {isTracking ? (
        <>
          <div className="text-green-500 text-lg font-semibold mb-2">
            {hasMicPermission ? 'กำลังวิเคราะห์การนอน...' : 'กำลังวิเคราะห์การเคลื่อนไหว...'}
          </div>
          <p className="text-gray-600 text-sm mb-4">
            {hasMicPermission 
              ? 'วางมือถือใกล้หมอน (เปิดไมค์ + เซนเซอร์)' 
              : 'วางมือถือบนเตียง (วิเคราะห์การเคลื่อนไหว)'}
          </p>
          <button
            onClick={stopTracking}
            className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-6 rounded-full transition"
          >
            หยุดการวิเคราะห์
          </button>
        </>
      ) : (
        <button
          onClick={requestMicAndStart}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-8 rounded-full text-lg transition shadow-md"
        >
          เริ่มวิเคราะห์การนอน
        </button>
      )}
    </div>
  );
};

export default SleepTracker;