import { useState, useEffect } from 'react';

const SleepTracker = () => {
  const [isTracking, setIsTracking] = useState(false);

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
      console.error('Failed to send ', e);
    }
  };

  const startAudioCapture = async () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const interval = setInterval(() => {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        const sampleRate = ctx.sampleRate;
        const binHz = sampleRate / analyser.fftSize;
        let snoreEnergy = 0;
        const startBin = Math.floor(50 / binHz);
        const endBin = Math.min(Math.floor(300 / binHz), bufferLength - 1);
        for (let i = startBin; i <= endBin; i++) {
          snoreEnergy += dataArray[i];
        }

        // ✅ ส่ง payload จริง ไม่ใช่ 'data'
        sendToBackend({
          type: 'audio',
          timestamp: Math.floor(Date.now() / 1000),
          snoreEnergy,
          avgVolume: dataArray.reduce((a, b) => a + b, 0) / bufferLength,
        });
      }, 5000);

      return () => {
        clearInterval(interval);
        stream.getTracks().forEach(track => track.stop());
        ctx.close();
      };
    } catch (err) {
      alert('ไม่สามารถใช้ไมค์ได้: ' + (err as Error).message);
    }
  };

  const startMotionCapture = () => {
    const handleMotion = (e: DeviceMotionEvent) => {
      if (!e.accelerationIncludingGravity) return;
      const { x, y, z } = e.accelerationIncludingGravity;

      // ✅ แทน null ด้วย 0
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

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    if (isTracking) {
      startAudioCapture().then(stopAudio => {
        const stopMotion = startMotionCapture();
        cleanup = () => {
          stopAudio?.();
          stopMotion?.();
        };
      });
    }
    return () => cleanup?.();
  }, [isTracking]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md text-center">
      {isTracking ? (
        <>
          <div className="text-green-500 text-lg font-semibold mb-2">กำลังวิเคราะห์การนอน...</div>
          <p className="text-gray-600 text-sm mb-4">วางมือถือใกล้หมอน (เปิดไมค์ + เซนเซอร์)</p>
          <button
            onClick={() => setIsTracking(false)}
            className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-6 rounded-full transition"
          >
            หยุดการวิเคราะห์
          </button>
        </>
      ) : (
        <button
          onClick={() => setIsTracking(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-8 rounded-full text-lg transition shadow-md"
        >
          เริ่มวิเคราะห์การนอน
        </button>
      )}
    </div>
  );
};

export default SleepTracker;