import React, { useRef, useEffect } from 'react';

interface WaveformProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
}

export const Waveform: React.FC<WaveformProps> = ({ analyserNode, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!isRecording || !analyserNode || !canvas) {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
        if (canvas) {
            const canvasCtx = canvas.getContext('2d');
            canvasCtx?.clearRect(0, 0, canvas.width, canvas.height);
        }
      return;
    }

    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    analyserNode.fftSize = 128;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameId.current = requestAnimationFrame(draw);
      analyserNode.getByteFrequencyData(dataArray);
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength);
      let x = 0;

      const isDarkMode = document.documentElement.classList.contains('dark');
      canvasCtx.fillStyle = isDarkMode ? 'rgba(120, 113, 108, 0.6)' : 'rgba(168, 162, 158, 0.6)';

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        if (barHeight > 1) { // Only draw if there's significant sound
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        }
        x += barWidth;
      }
    };

    draw();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isRecording, analyserNode]);

  if (!isRecording) return null;

  return (
    <canvas ref={canvasRef} width="300px" height="30px" className="w-full h-[30px]"></canvas>
  );
};
