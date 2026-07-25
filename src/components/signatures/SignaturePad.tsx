import { useEffect, useRef, useState } from "react";

type SignaturePadProps = {
  disabled?: boolean;
  onChange: (dataUrl: string | null) => void;
};

export default function SignaturePad({
  disabled = false,
  onChange,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      const saved = hasInk ? canvas.toDataURL("image/png") : null;

      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(180 * ratio);

      const context = canvas.getContext("2d");
      if (!context) return;

      context.scale(ratio, ratio);
      context.lineWidth = 2.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#e2e8f0";

      if (saved) {
        const image = new Image();
        image.onload = () => context.drawImage(image, 0, 0, rect.width, 180);
        image.src = saved;
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [hasInk]);

  const point = (
    event:
      | React.PointerEvent<HTMLCanvasElement>
      | PointerEvent
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    canvas.setPointerCapture(event.pointerId);
    const current = point(event);

    context.beginPath();
    context.moveTo(current.x, current.y);
    drawingRef.current = true;
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !drawingRef.current) return;

    const context = canvasRef.current?.getContext("2d");
    if (!context) return;

    const current = point(event);
    context.lineTo(current.x, current.y);
    context.stroke();

    if (!hasInk) setHasInk(true);
  };

  const finish = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas || !hasInk) {
      onChange(null);
      return;
    }

    onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    drawingRef.current = false;
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-[180px] w-full touch-none rounded-xl border border-slate-600 bg-slate-950"
        onPointerDown={begin}
        onPointerMove={draw}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={finish}
        aria-label="Draw your signature"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Draw your signature using your finger, mouse, or stylus.
        </p>

        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasInk}
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-bold text-slate-200 disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
