import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from 'fabric';

interface CanvasMockup {
  url: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  lockedInDev: boolean;
  imageWidth: number;
  imageHeight: number;
}

interface CanvasWrapperProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvas?: Canvas | null;
  zoom: number;
  editorMode?: 'dev' | 'prod';
  mockup?: CanvasMockup;
  showSafeArea?: boolean;
  showTrimArea?: boolean;
  fitToScreenRequest?: number;
  canvasDimensions?: { width: number; height: number };
  onZoomChange?: (zoom: number) => void;
  onCanvasDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  onMockupChange?: (mockup?: CanvasMockup) => void;
}

const CANVAS_DPI = 150;
const SAFE_AREA_INSET_INCHES = 0.25;
const TRIM_AREA_INSET_INCHES = 0.125;
const BASE_CONTROL_CORNER_SIZE = 10;
const BASE_CONTROL_TOUCH_CORNER_SIZE = 24;
const BASE_CONTROL_PADDING = 6;
const BASE_BORDER_SCALE_FACTOR = 1.6;
const CONTROL_ACCENT_COLOR = '#06b6d4';
const CONTROL_ACCENT_BORDER = 'rgba(8, 145, 178, 0.95)';
const CONTROL_SELECTION_FILL = 'rgba(6, 182, 212, 0.08)';

const CanvasWrapper: React.FC<CanvasWrapperProps> = ({
  canvasRef,
  canvas,
  zoom,
  editorMode = 'dev',
  mockup,
  showSafeArea = true,
  showTrimArea = true,
  fitToScreenRequest = 0,
  canvasDimensions = { width: 800, height: 600 },
  onZoomChange,
  onCanvasDimensionsChange,
  onMockupChange
}) => {
  const [viewportPosition, setViewportPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(zoom);
  const previousDimensionsRef = useRef(canvasDimensions);
  const mockupInteractionRef = useRef<{ mode: 'drag' | 'scale'; startX: number; startY: number; startMockup: CanvasMockup } | null>(null);
  const [isMockupSelected, setIsMockupSelected] = useState(false);

  const hasVisibleMockup = Boolean(mockup?.url && mockup.visible);
  const canEditMockup = editorMode === 'dev' && Boolean(mockup) && !mockup?.lockedInDev;

  useEffect(() => {
    if (!mockup?.url) {
      setIsMockupSelected(false);
    }
  }, [mockup?.url]);

  useEffect(() => {
    if (!mockupInteractionRef.current) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!mockup || !canEditMockup || !onMockupChange) return;

      const state = mockupInteractionRef.current;
      if (!state) return;

      const deltaX = (event.clientX - state.startX) / Math.max(zoom, 0.1);
      const deltaY = (event.clientY - state.startY) / Math.max(zoom, 0.1);

      if (state.mode === 'drag') {
        onMockupChange({
          ...state.startMockup,
          x: state.startMockup.x + deltaX,
          y: state.startMockup.y + deltaY,
        });
        return;
      }

      const deltaScale = (deltaX + deltaY) / 320;
      onMockupChange({
        ...state.startMockup,
        scale: Math.max(0.05, state.startMockup.scale * (1 + deltaScale)),
      });
    };

    const handlePointerUp = () => {
      mockupInteractionRef.current = null;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [canEditMockup, mockup, onMockupChange, zoom]);

  const startMockupInteraction = (mode: 'drag' | 'scale', event: React.PointerEvent) => {
    if (!mockup || !canEditMockup) return;
    event.preventDefault();
    event.stopPropagation();
    setIsMockupSelected(true);
    mockupInteractionRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startMockup: { ...mockup },
    };
    document.body.style.cursor = mode === 'drag' ? 'grabbing' : 'nwse-resize';
  };

  // Handle viewport panning and zooming (like Adobe Illustrator)
  useEffect(() => {
    const getTouchPanAnchor = (touchEvent: TouchEvent) => {
      if (touchEvent.touches.length >= 2) {
        const first = touchEvent.touches[0];
        const second = touchEvent.touches[1];
        return {
          x: (first.clientX + second.clientX) / 2,
          y: (first.clientY + second.clientY) / 2,
        };
      }

      const first = touchEvent.touches[0];
      return { x: first.clientX, y: first.clientY };
    };

    const getTouchDistance = (touchEvent: TouchEvent) => {
      if (touchEvent.touches.length < 2) return 0;
      const first = touchEvent.touches[0];
      const second = touchEvent.touches[1];
      return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    };

    const shouldStartTouchPan = (touchEvent: TouchEvent, target: HTMLElement) => {
      const isOnCanvasViewport = target.closest('.canvas-viewport');
      const isOnZoomMenu = target.closest('.zoom-menu');
      const isOnResizeHandle = target.classList.contains('resize-handle');

      if (!isOnCanvasViewport || isOnZoomMenu || isOnResizeHandle) {
        return false;
      }

      if (touchEvent.touches.length >= 2) {
        return true;
      }

      if (touchEvent.touches.length === 1 && Math.abs(zoom - 1) > 0.001) {
        return !canvas?.getActiveObject();
      }

      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're currently editing text
      const activeElement = document.activeElement;
      const isEditingInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true'
      );
      
      // Check if Fabric.js text is being edited
      const activeObject = canvas?.getActiveObject();
      const isEditingFabricText = activeObject && 
        activeObject.type === 'text' && 
        (activeObject as any).isEditing === true;
      
      const isEditingText = isEditingInput || isEditingFabricText;

      // Only handle space/h keys if not editing text
      if ((e.code === 'Space' || e.key.toLowerCase() === 'h') && !isEditingText) {
        e.preventDefault();
        setIsSpacePressed(true);
        document.body.style.cursor = 'grab';
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Check if we're currently editing text
      const activeElement = document.activeElement;
      const isEditingInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true'
      );
      
      // Check if Fabric.js text is being edited
      const activeObject = canvas?.getActiveObject();
      const isEditingFabricText = activeObject && 
        activeObject.type === 'text' && 
        (activeObject as any).isEditing === true;
      
      const isEditingText = isEditingInput || isEditingFabricText;

      // Only handle space/h keys if not editing text
      if ((e.code === 'Space' || e.key.toLowerCase() === 'h') && !isEditingText) {
        setIsSpacePressed(false);
        document.body.style.cursor = 'default';
        setIsPanning(false);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isOnCanvas = target.closest('.canvas-viewport');
      const isOnResizeHandle = target.classList.contains('resize-handle');
      const isOnZoomMenu = target.closest('.zoom-menu');
      
      // Hide zoom menu if clicking outside of it
      if (!isOnZoomMenu && showZoomMenu) {
        setShowZoomMenu(false);
      }
      
      if (isOnResizeHandle) {
        if (editorMode === 'prod') {
          return;
        }
        e.preventDefault();
        setIsResizing(true);
        setResizeHandle(target.dataset.handle || '');
        setLastMousePos({ x: e.clientX, y: e.clientY });
        document.body.style.cursor = target.style.cursor;
        return;
      }
      
      if (isOnCanvas && (e.ctrlKey || e.metaKey || isSpacePressed)) {
        e.preventDefault();
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
        document.body.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizeHandle) {
        e.preventDefault();
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        
        let newWidth = canvasDimensions.width;
        let newHeight = canvasDimensions.height;
        
        // Handle different resize directions
        if (resizeHandle.includes('e')) newWidth += deltaX;
        if (resizeHandle.includes('w')) newWidth -= deltaX;
        if (resizeHandle.includes('s')) newHeight += deltaY;
        if (resizeHandle.includes('n')) newHeight -= deltaY;
        
        // Apply minimum constraints
        newWidth = Math.max(200, newWidth);
        newHeight = Math.max(150, newHeight);
        
        onCanvasDimensionsChange?.({ width: newWidth, height: newHeight });
        setLastMousePos({ x: e.clientX, y: e.clientY });
      } else if (isPanning) {
        e.preventDefault();
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        
        setViewportPosition(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));
        
        setLastMousePos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsPanning(false);
      setIsResizing(false);
      setResizeHandle('');
      if (document.body.style.cursor === 'grabbing') {
        document.body.style.cursor = isSpacePressed ? 'grab' : 'default';
      } else if (isResizing) {
        document.body.style.cursor = 'default';
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const isOnZoomMenu = target.closest('.zoom-menu');

      if (!isOnZoomMenu && showZoomMenu) {
        setShowZoomMenu(false);
      }

      if (!shouldStartTouchPan(e, target)) {
        return;
      }

      e.preventDefault();
      const anchor = getTouchPanAnchor(e);
      setIsPanning(true);
      setLastMousePos(anchor);

      if (e.touches.length >= 2) {
        pinchStartDistanceRef.current = getTouchDistance(e);
        pinchStartZoomRef.current = zoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPanning || e.touches.length === 0) {
        return;
      }

      e.preventDefault();

      if (e.touches.length >= 2) {
        const distance = getTouchDistance(e);
        const pinchStartDistance = pinchStartDistanceRef.current;

        if (pinchStartDistance && distance > 0) {
          const scaledZoom = pinchStartZoomRef.current * (distance / pinchStartDistance);
          const clampedZoom = Math.max(0.1, Math.min(5, scaledZoom));
          onZoomChange?.(clampedZoom);
        }
      }

      const anchor = getTouchPanAnchor(e);
      const deltaX = anchor.x - lastMousePos.x;
      const deltaY = anchor.y - lastMousePos.y;

      setViewportPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));

      setLastMousePos(anchor);
    };

    const handleTouchEnd = () => {
      setIsPanning(false);
      pinchStartDistanceRef.current = null;
      pinchStartZoomRef.current = zoom;
    };

    const handleWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement)?.closest('.canvas-viewport')) {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        const newZoom = Math.max(0.1, Math.min(5, zoom + delta));
        onZoomChange?.(newZoom);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
      document.body.style.cursor = 'default';
    };
  }, [isPanning, isResizing, resizeHandle, lastMousePos, zoom, isSpacePressed, canvasDimensions, onZoomChange, onCanvasDimensionsChange, showZoomMenu, canvas, editorMode]);

  // Zoom controls
  const zoomIn = () => {
    const newZoom = Math.min(5, zoom + 0.25);
    onZoomChange?.(newZoom);
  };

  const zoomOut = () => {
    const newZoom = Math.max(0.1, zoom - 0.25);
    onZoomChange?.(newZoom);
  };

  const calculateFitZoom = (width: number, height: number) => {
    if (!containerRef.current) return null;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width - 100;
    const containerHeight = containerRect.height - 100;

    if (containerWidth <= 0 || containerHeight <= 0) {
      return null;
    }

    const scaleX = containerWidth / width;
    const scaleY = containerHeight / height;
    return Math.max(0.1, Math.min(scaleX, scaleY, 1));
  };

  const zoomToFit = () => {
    const newZoom = calculateFitZoom(canvasDimensions.width, canvasDimensions.height);
    if (!newZoom) return;

    onZoomChange?.(newZoom);
    // Center the artboard
    setViewportPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!fitToScreenRequest) return;
    zoomToFit();
  }, [fitToScreenRequest]);

  useEffect(() => {
    const prev = previousDimensionsRef.current;
    const changed = prev.width !== canvasDimensions.width || prev.height !== canvasDimensions.height;

    if (!changed) {
      return;
    }

    previousDimensionsRef.current = canvasDimensions;

    const fitZoom = calculateFitZoom(canvasDimensions.width, canvasDimensions.height);
    if (fitZoom !== null) {
      onZoomChange?.(fitZoom);
      setViewportPosition({ x: 0, y: 0 });
    }
  }, [canvasDimensions, onZoomChange]);

  useEffect(() => {
    if (!canvas) return;

    const zoomSafe = Math.max(zoom, 0.1);
    const cornerSize = Math.min(220, Math.max(10, BASE_CONTROL_CORNER_SIZE / zoomSafe));
    const touchCornerSize = Math.min(320, Math.max(24, BASE_CONTROL_TOUCH_CORNER_SIZE / zoomSafe));
    const controlPadding = Math.min(48, Math.max(4, BASE_CONTROL_PADDING / zoomSafe));
    const borderScaleFactor = Math.min(24, Math.max(1.2, BASE_BORDER_SCALE_FACTOR / zoomSafe));

    canvas.getObjects().forEach((obj: any) => {
      obj.set({
        cornerSize,
        touchCornerSize,
        padding: controlPadding,
        borderScaleFactor,
        cornerStyle: 'circle',
        transparentCorners: false,
        cornerColor: CONTROL_ACCENT_COLOR,
        cornerStrokeColor: '#ffffff',
        borderColor: CONTROL_ACCENT_BORDER,
      });
      if (typeof obj.setCoords === 'function') {
        obj.setCoords();
      }
    });

    const activeObject = canvas.getActiveObject() as any;
    if (activeObject) {
      activeObject.set({
        cornerSize,
        touchCornerSize,
        padding: controlPadding,
        borderScaleFactor,
        cornerStyle: 'circle',
        transparentCorners: false,
        cornerColor: CONTROL_ACCENT_COLOR,
        cornerStrokeColor: '#ffffff',
        borderColor: CONTROL_ACCENT_BORDER,
      });
      if (typeof activeObject.setCoords === 'function') {
        activeObject.setCoords();
      }
    }

    canvas.selectionLineWidth = Math.min(8, Math.max(1.5, 2 / zoomSafe));
    canvas.selectionColor = CONTROL_SELECTION_FILL;
    canvas.selectionBorderColor = CONTROL_ACCENT_BORDER;
    canvas.selectionDashArray = [4 / zoomSafe, 3 / zoomSafe];
    canvas.requestRenderAll();
  }, [canvas, zoom]);

  const resetZoom = () => {
    onZoomChange?.(1);
    setViewportPosition({ x: 0, y: 0 });
  };

  const safeInsetPx = SAFE_AREA_INSET_INCHES * CANVAS_DPI;
  const trimInsetPx = TRIM_AREA_INSET_INCHES * CANVAS_DPI;
  const centeredOffsetX = -(canvasDimensions.width * (zoom - 1)) / 2;
  const centeredOffsetY = -(canvasDimensions.height * (zoom - 1)) / 2;
  const zoomSafeValue = Math.max(zoom, 0.1);
  const safeAreaStrokeWidth = 1.5 / zoomSafeValue;
  const trimAreaStrokeWidth = 1.5 / zoomSafeValue;
  const shouldRenderSafeArea =
    showSafeArea &&
    canvasDimensions.width > safeInsetPx * 2 &&
    canvasDimensions.height > safeInsetPx * 2;
  const shouldRenderTrimArea =
    showTrimArea &&
    canvasDimensions.width > trimInsetPx * 2 &&
    canvasDimensions.height > trimInsetPx * 2;

  return (
    <div 
      ref={containerRef}
      className="canvas-viewport flex-1 bg-gray-100 relative overflow-hidden"
      style={{
        background: 'radial-gradient(circle, #e5e5e5 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        backgroundPosition: `${viewportPosition.x % 20}px ${viewportPosition.y % 20}px`,
        touchAction: 'none'
      }}
    >
      {/* Artboard container */}
      <div 
        ref={artboardRef}
        className="artboard-container absolute"
        style={{
          transform: `translate(${viewportPosition.x + centeredOffsetX}px, ${viewportPosition.y + centeredOffsetY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          left: '50%',
          top: '50%',
          marginLeft: `${-canvasDimensions.width / 2}px`,
          marginTop: `${-canvasDimensions.height / 2}px`
        }}
      >
        {mockup?.url && mockup.visible && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'visible',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          >
            <div
              onPointerDown={(event) => startMockupInteraction('drag', event)}
              style={{
                position: 'absolute',
                left: `${mockup.x}px`,
                top: `${mockup.y}px`,
                width: `${mockup.imageWidth}px`,
                height: `${mockup.imageHeight}px`,
                transform: `translate(-50%, -50%) scale(${mockup.scale}) rotate(${mockup.rotation}deg)`,
                transformOrigin: 'center center',
                opacity: mockup.opacity,
                pointerEvents: canEditMockup ? 'auto' : 'none',
                cursor: canEditMockup ? 'grab' : 'default',
                border: isMockupSelected && canEditMockup ? '1px dashed rgba(6, 182, 212, 0.85)' : 'none',
              }}
            >
              <img
                src={mockup.url}
                alt="Canvas mockup backdrop"
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
              {isMockupSelected && canEditMockup && (
                <div
                  onPointerDown={(event) => startMockupInteraction('scale', event)}
                  style={{
                    position: 'absolute',
                    right: '-6px',
                    bottom: '-6px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '9999px',
                    background: '#06b6d4',
                    border: '2px solid #ffffff',
                    cursor: 'nwse-resize',
                    pointerEvents: 'auto',
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Artboard shadow */}
        {!hasVisibleMockup && (
          <div 
            className="artboard-shadow absolute bg-black opacity-20 rounded-lg"
            style={{
              width: `${canvasDimensions.width}px`,
              height: `${canvasDimensions.height}px`,
              transform: 'translate(4px, 4px)',
              zIndex: 1
            }}
          />
        )}
        
        {/* Main artboard */}
        <div 
          className="artboard relative rounded-lg overflow-hidden"
          style={{
            width: `${canvasDimensions.width}px`,
            height: `${canvasDimensions.height}px`,
            backgroundColor: hasVisibleMockup ? 'transparent' : '#ffffff',
            zIndex: 2,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
          }}
        >
          <canvas
            ref={canvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            style={{
              display: 'block',
              width: '100%',
              height: '100%'
            }}
          />

          {shouldRenderSafeArea && (
            <>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  left: `${safeInsetPx}px`,
                  top: `${safeInsetPx}px`,
                  width: `${canvasDimensions.width - safeInsetPx * 2}px`,
                  height: `${canvasDimensions.height - safeInsetPx * 2}px`,
                  border: `${safeAreaStrokeWidth}px dashed rgba(14, 116, 144, 0.9)`,
                  borderRadius: '2px',
                  zIndex: 6,
                }}
              />
            </>
          )}

          {shouldRenderTrimArea && (
            <>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  left: `${trimInsetPx}px`,
                  top: `${trimInsetPx}px`,
                  width: `${canvasDimensions.width - trimInsetPx * 2}px`,
                  height: `${canvasDimensions.height - trimInsetPx * 2}px`,
                  border: `${trimAreaStrokeWidth}px dotted rgba(217, 119, 6, 0.95)`,
                  borderRadius: '2px',
                  zIndex: 5,
                }}
              />
            </>
          )}
          
          {/* Resize handles */}
          {editorMode === 'dev' && (
            <>
              <div className="resize-handle resize-handle-n" data-handle="n" style={{
                position: 'absolute',
                top: '-4px',
                left: '50%',
                width: '8px',
                height: '8px',
                marginLeft: '-4px',
                backgroundColor: '#3b82f6',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'n-resize',
                zIndex: 10
              }} />
              <div className="resize-handle resize-handle-s" data-handle="s" style={{
                position: 'absolute',
                bottom: '-4px',
                left: '50%',
                width: '8px',
                height: '8px',
                marginLeft: '-4px',
                backgroundColor: '#3b82f6',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 's-resize',
                zIndex: 10
              }} />
              <div className="resize-handle resize-handle-w" data-handle="w" style={{
                position: 'absolute',
                left: '-4px',
                top: '50%',
                width: '8px',
                height: '8px',
                marginTop: '-4px',
                backgroundColor: '#3b82f6',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'w-resize',
                zIndex: 10
              }} />
              <div className="resize-handle resize-handle-e" data-handle="e" style={{
                position: 'absolute',
                right: '-4px',
                top: '50%',
                width: '8px',
                height: '8px',
                marginTop: '-4px',
                backgroundColor: '#3b82f6',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'e-resize',
                zIndex: 10
              }} />
              <div className="resize-handle resize-handle-nw" data-handle="nw" style={{
                position: 'absolute',
                top: '-4px',
                left: '-4px',
                width: '8px',
                height: '8px',
                backgroundColor: '#3b82f6',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'nw-resize',
                zIndex: 10
              }} />
              <div className="resize-handle resize-handle-ne" data-handle="ne" style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '8px',
                height: '8px',
                backgroundColor: '#3b82f6',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'ne-resize',
                zIndex: 10
              }} />
              <div className="resize-handle resize-handle-sw" data-handle="sw" style={{
                position: 'absolute',
                bottom: '-4px',
                left: '-4px',
                width: '8px',
                height: '8px',
                backgroundColor: '#3b82f6',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'sw-resize',
                zIndex: 10
              }} />
              <div className="resize-handle resize-handle-se" data-handle="se" style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                width: '8px',
                height: '8px',
                backgroundColor: '#3b82f6',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'se-resize',
                zIndex: 10
              }} />
            </>
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="zoom-menu absolute top-4 right-4">
        {/* Zoom badge - always visible */}
        <div 
          onClick={() => setShowZoomMenu(!showZoomMenu)}
          className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          {Math.round(zoom * 100)}%
        </div>
        
        {/* Expandable menu - only visible when showZoomMenu is true */}
        {showZoomMenu && (
          <div 
            ref={zoomMenuRef}
            className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden min-w-32"
          >
            <div className="p-2 space-y-1">
              <button
                onClick={zoomIn}
                className="w-full px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
              >
                Zoom In (+)
              </button>
              <button
                onClick={zoomOut}
                className="w-full px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
              >
                Zoom Out (-)
              </button>
              <button
                onClick={zoomToFit}
                className="w-full px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
              >
                Fit to Screen
              </button>
              <button
                onClick={resetZoom}
                className="w-full px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
              >
                Reset (100%)
              </button>
            </div>
          </div>
        )}
      </div>


    </div>
  );
};

export default CanvasWrapper;
